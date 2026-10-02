import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = process.argv[2] || 'pages';
if (!['pages','cloudflare'].includes(host)) throw new Error('Choose pages or cloudflare.');
const artifact = resolve(root, '.local/deployment', host);
const manifest = JSON.parse(await readFile(resolve(root,'.local/deployment/package-manifest.json'),'utf8'));
const expected = new Map(manifest.pages.map(file => [file.name,file]));
if (host === 'cloudflare') for (const name of ['_headers','_redirects','retire-service-worker.js']) expected.set(name,null);
const actual=[];
async function walk(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    const path=resolve(directory,entry.name);
    const info=await lstat(path);
    if (info.isSymbolicLink()) throw new Error(`Symlink: ${path}`);
    if (info.isDirectory()) await walk(path);
    else if (info.isFile()) actual.push(relative(artifact,path).replaceAll('\\','/'));
    else throw new Error(`Unsupported file: ${path}`);
  }
}
await walk(artifact);
if (JSON.stringify(actual.sort()) !== JSON.stringify([...expected.keys()].sort())) throw new Error('Unexpected or missing deployment files.');
let total=0;
for (const name of actual) {
  if (/\.(big|iso|bin|cue|sav|rep|cncdump)$/i.test(name) || /(^|\/)(\.env|\.git|\.certs|AGENTS_PRIVATE\.md)(\/|$)/i.test(name)) throw new Error(`Private/retail file: ${name}`);
  const bytes=await readFile(resolve(artifact,name)); total+=bytes.length;
  if (bytes.length>25*1024*1024) throw new Error(`File exceeds 25 MiB: ${name}`);
  const changed = host==='cloudflare' && ['index.html','coi-serviceworker.js'].includes(name);
  if (!changed && expected.get(name) && createHash('sha256').update(bytes).digest('hex')!==expected.get(name).sha256) throw new Error(`Checksum mismatch: ${name}`);
  if (/\.(js|mjs|html|json|css|md|txt)$/.test(name)) {
    const text=bytes.toString();
    // /home/web_user is Emscripten's virtual browser filesystem, not a host path.
    if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|C:\\Users\\|\/Users\/|\/home\/(?!web_user\b)/.test(text)) throw new Error(`Sensitive host content: ${name}`);
    if (name.endsWith('.mjs') || name.endsWith('.js')) {
      const imports=[...text.matchAll(/(?:from\s*|import\s*\(|import\s*)["'](\.{1,2}\/[^"']+)["']/g)].map(match=>match[1]);
      for (const specifier of imports) {
        // Downloadable build sources resolve against the full reconstructed source, not the website.
        if (name.startsWith('source/')) continue;
        const destination=resolve(artifact,name,'..',specifier.split('?')[0]);
        const relativeName=relative(artifact,destination).replaceAll('\\','/');
        if (!expected.has(relativeName)) throw new Error(`Unresolved module: ${name} -> ${specifier}`);
      }
    }
  }
}
const license=await readFile(resolve(artifact,'LICENSE.md'),'utf8');
const originalLicense=await readFile(resolve(root,'vendor/NewShoes-main/LICENSE.md'),'utf8');
if (license!==originalLicense || !license.includes('GNU General Public License')) throw new Error('Missing or changed complete license.');
const launcher=await readFile(resolve(artifact,host==='pages'?'launcher.html':'index.html'),'utf8');
if (!launcher.includes('<base href="./harness/">') || !launcher.includes('source/index.html')) throw new Error('Missing root routing or source notice.');
const sourceManifest=JSON.parse(await readFile(resolve(artifact,'source/source-manifest.json'),'utf8'));
const parts=await Promise.all(sourceManifest.parts.map(part=>readFile(resolve(artifact,'source',part.name))));
if (createHash('sha256').update(Buffer.concat(parts)).digest('hex')!==sourceManifest.originalZipSha256) throw new Error('Corresponding source reconstruction failed.');
if (host==='cloudflare') {
  const headers=await readFile(resolve(artifact,'_headers'),'utf8');
  if (!headers.includes('Cross-Origin-Opener-Policy: same-origin') || !headers.includes('Cross-Origin-Embedder-Policy: require-corp')) throw new Error('Missing direct isolation headers.');
}
console.log(JSON.stringify({host,files:actual.length,totalBytes:total,retailArchives:0,sourceReconstruction:'passed',moduleGraph:'passed',checksums:'passed'},null,2));
