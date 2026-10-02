import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../',import.meta.url);
const patches = {vitest:'4.1.11',nanoid:'3.3.18',postcss:'8.5.23',sharp:'0.35.4',undici:'7.29.1'};
for (const [name,version] of Object.entries(patches)) {
  const response = await fetch(`https://registry.npmjs.org/${name}/${version}`,{signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Patch unavailable: ${name}@${version}`);
  const info = await response.json();
  if (info.version !== version || info.name !== name) throw new Error('Registry metadata mismatch');
}
const output = new URL('overrides/build/',root);
await mkdir(output,{recursive:true});
const pkg = JSON.parse(await readFile(new URL('vendor/NewShoes-main/WebAssembly/package.json',root),'utf8'));
pkg.devDependencies.vitest = patches.vitest;
pkg.overrides = {...pkg.overrides,sharp:patches.sharp,nanoid:patches.nanoid,postcss:patches.postcss,undici:patches.undici};
await writeFile(new URL('package.json',output),JSON.stringify(pkg,null,2)+'\n');
await writeFile(new URL('package-lock.json',output),await readFile(new URL('vendor/NewShoes-main/WebAssembly/package-lock.json',root)));
// npm is a local, verified tool only; no third-party lifecycle scripts are run.
const npmVersion = '11.6.4';
const response = await fetch(`https://registry.npmjs.org/npm/${npmVersion}`,{signal:AbortSignal.timeout(30000)});
if (!response.ok) throw new Error('Could not obtain npm metadata');
const info = await response.json();
if (!info.dist.tarball.startsWith('https://registry.npmjs.org/npm/')) throw new Error('Unexpected npm package origin');
const archive = await fetch(info.dist.tarball,{signal:AbortSignal.timeout(30000)});
if (!archive.ok) throw new Error('Could not obtain npm tool');
const bytes = Buffer.from(await archive.arrayBuffer());
if (`sha512-${createHash('sha512').update(bytes).digest('base64')}` !== info.dist.integrity) throw new Error('npm tool checksum mismatch');
await writeFile(new URL('.local/npm-tool.tgz',root),bytes);
console.log(`Prepared dependency patches and integrity-verified npm ${npmVersion} tool archive.`);
