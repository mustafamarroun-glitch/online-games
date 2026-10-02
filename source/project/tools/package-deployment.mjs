import { readFile, writeFile, mkdir, copyFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, basename } from 'node:path';
import { PAGES_HARNESS_FILES, PAGES_DEPENDENCY_FILES, PAGES_RUNTIME_FILES } from '../vendor/NewShoes-main/WebAssembly/tools/pages_site_manifest.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'deployment/project.json'), 'utf8'));
const source = resolve(root, 'vendor/NewShoes-main');
const target = resolve(root, '.local/deployment');
const server = new URL(process.env.DEPLOYMENT_SOURCE || 'http://localhost:8081');
if (!['localhost', '127.0.0.1'].includes(server.hostname)) throw new Error('Use the verified local compiler server.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const baseZip = await readFile(resolve(root, 'NewShoes-source.zip'));
if (hash(baseZip) !== config.sourceZipSha256) throw new Error('Source ZIP checksum mismatch.');
// Only generated deployment output may be replaced. Never scan/copy game directories.
if (target !== resolve(root, '.local/deployment')) throw new Error('Unsafe output directory.');
await rm(target, { recursive: true, force: true });
const pages = resolve(target, 'pages');
const cloudflare = resolve(target, 'cloudflare');
await mkdir(pages, { recursive: true });
const bytesByName = new Map();
async function put(name, bytes) {
  const path = resolve(pages, name);
  if (!path.startsWith(pages + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error(`Unsafe destination: ${name}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  bytesByName.set(name, Buffer.from(bytes));
}
async function get(name) {
  const response = await fetch(new URL(name, server));
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const files = [...PAGES_HARNESS_FILES.map(name => `harness/${name}`), ...PAGES_DEPENDENCY_FILES,
  ...PAGES_RUNTIME_FILES.map(name => `dist-threaded-release/${name}`)];
for (let offset = 0; offset < files.length; offset += 8) {
  await Promise.all(files.slice(offset, offset + 8).map(async name => {
    let bytes = await get(PAGES_DEPENDENCY_FILES.includes(name) ? `node_modules/7z-wasm/${basename(name)}` : name);
    if (name.endsWith('/analytics.mjs')) bytes = Buffer.from(bytes.toString().replaceAll('__GA_MEASUREMENT_ID__', ''));
    if (/\/(mod-package-worker|custom-map-package-worker)\.mjs$/.test(name)) {
      bytes = Buffer.from(bytes.toString().replaceAll('../node_modules/7z-wasm/', './vendor/7z-wasm/'));
    }
    await put(name, bytes);
  }));
}
for (const name of ['launcher-desktop-apps.js', 'launcher-archive-download.mjs', 'launcher-backup-zip.mjs']) {
  await put(`harness/${name}`, await readFile(resolve(root, 'overrides/harness', name)));
}
await put('harness/launcher.css', bytesByName.get('harness/launcher.css').toString() + '\n' +
  await readFile(resolve(root, 'overrides/harness/launcher-backup.css'), 'utf8'));
if (hash(bytesByName.get('dist-threaded-release/cnc-port.wasm')) !== config.runtimeWasmSha256) {
  throw new Error('This is not the verified locally compiled engine.');
}
for (const name of ['coi-bootstrap.js', 'coi-direct.js', 'coi-serviceworker.js']) {
  await put(name, await readFile(resolve(source, 'WebAssembly/pages', name)));
}
const sourceUrl = `https://github.com/Agusx1211/NewShoes/tree/${config.upstreamCommit}`;
const discovery = `<meta name="description" content="Zero Hour browser desktop testing beta. Import compatible local game files.">\n<meta name="robots" content="noindex,nofollow">`;
let bootstrap = await readFile(resolve(source, 'WebAssembly/pages/index.html'), 'utf8');
bootstrap = bootstrap.replace('<!-- __PUBLIC_PROJECT_DISCOVERY__ -->', discovery)
  .replace('<!-- __PUBLIC_PROJECT_SUMMARY__ -->', `<section class="project-summary"><h2>${escape(config.name)} · testing beta</h2><p>Import compatible game files locally. macOS and internet multiplayer testing are pending.</p></section>`)
  .replaceAll('__PAGES_SOURCE_URL__', './source/index.html');
await put('index.html', bootstrap);
let launcher = (await get('harness/play.html')).toString();
launcher = launcher.replace('<!-- __PUBLIC_PROJECT_DISCOVERY__ -->', discovery)
  .replace(/<title>[^<]*<\/title>/, `<title>${escape(config.name)}: Zero Hour browser desktop</title>`)
  .replace('<head>\n', '<head>\n    <base href="./harness/">\n    <script src="../coi-direct.js"></script>\n')
  .replace('href="./manifest.webmanifest"', 'href="../manifest.webmanifest"')
  .replace('Expand a set to inspect its archives', 'Expand the installed library to download one ZIP or individual archives')
  .replace(/<p class="about-legal">[\s\S]*?<\/p>/,
    '<p class="about-legal">Modified browser software, 2026. Copyright © Electronic Arts Inc. and Project New Shoes contributors. GPLv3 with additional terms; no warranty. <a href="../legal.html">License and notices</a> · <a href="../source/index.html">Corresponding source</a> · <a href="../project-info.json">Beta status</a></p>')
  .replace('Choose your original Generals and Zero Hour disc images, or an existing Zero Hour installation. We only inspect the files needed to prepare the game.',
    'This testing beta supports the validated combined English installation. Select its Data folder; game files remain local. Other editions need compatibility testing.')
  .replace(/<button type="button" class="source-card" id="pickImageButton">[\s\S]*?<\/button>/,
    '<button type="button" class="source-card" id="pickImageButton" disabled hidden aria-hidden="true">Disc import is not available in this beta profile.</button>');
await put('launcher.html', launcher);
let launcherJs = bytesByName.get('harness/launcher.js').toString();
launcherJs = launcherJs.replace('"installed and ready without the original media"', '"installed in this browser"');
// Keep unsupported original-disc import visibly disabled when launcher busy state changes.
launcherJs += '\nconst betaDiscPicker = document.querySelector("#pickImageButton");\nif (betaDiscPicker) betaDiscPicker.hidden = true;\n';
await put('harness/launcher.js', launcherJs);
const manifest = JSON.parse(bytesByName.get('harness/manifest.webmanifest'));
await put('manifest.webmanifest', JSON.stringify({ ...manifest, name: config.name, short_name: config.name,
  start_url: './', scope: './', icons: manifest.icons.map(icon => ({ ...icon, src: './harness/' + icon.src.replace(/^\.\//, '') })) }, null, 2));
await put('harness/play.html', '<!doctype html><meta charset="utf-8"><title>Open browser desktop</title><script>location.replace(new URL("../",location.href));</script><a href="../">Open desktop</a>');
await put('harness/build-info.json', JSON.stringify({ schema:'cnc.harness-build-info.v1', release:{version:'0.8.4-beta'},
  git:{commit:config.upstreamCommit, shortCommit:config.upstreamCommit.slice(0,7), dirty:true},
  generatedAt:new Date().toISOString(), assetProfile:config.assetProfile,
  modifications:'Combined archive profile and deployment packaging; see corresponding source.' }, null, 2));
await put('project-info.json', JSON.stringify(config, null, 2));
await put('.nojekyll', '');
await put('LICENSE.md', await readFile(resolve(source, 'LICENSE.md')));
let legal = await readFile(resolve(source, 'WebAssembly/pages/legal.html'), 'utf8');
legal = legal.replaceAll('__PAGES_SOURCE_URL__', './source/index.html')
  .replace(/<section>\s*<h2>Browser video runtime<\/h2>[\s\S]*?<\/section>/,
    '<section><h2>Testing beta</h2><p>This build adapts the importer for a combined English installation. macOS, multiplayer, other editions, and optional movies remain unverified. Retail game files are not included.</p></section>');
await put('legal.html', legal);
// Ship the exact base source plus our complete build/import/package modifications.
// Split the ZIP so the same artifact also fits Cloudflare's 25 MiB per-file cap.
const partSize = 16 * 1024 * 1024;
const parts = [];
for (let start = 0, number = 1; start < baseZip.length; start += partSize, number++) {
  const name = `NewShoes-source.zip.part${String(number).padStart(2,'0')}`;
  const bytes = baseZip.subarray(start, start + partSize);
  await put(`source/${name}`, bytes);
  parts.push({ name, bytes:bytes.length, sha256:hash(bytes) });
}
const sourceFiles = ['Dockerfile', 'compose.yaml', '.dockerignore', 'Start-Local.ps1',
  'tools/create-combined-overrides.mjs', 'tools/serve-local-preview.mjs', 'tools/fetch-prebuilt-runtime.ps1',
  'tools/package-deployment.mjs', 'tools/verify-deployment.mjs', 'tools/create-backup-overrides.mjs', 'deployment/project.json',
  ...['launcher-archive-specs.js','launcher-asset-manager.mjs','launcher-asset-worker.js','launcher-desktop-apps.js','launcher-archive-download.mjs','launcher-backup-zip.mjs','launcher-backup.css'].map(name => `overrides/harness/${name}`)];
for (const name of sourceFiles) await put(`source/project/${name}`, await readFile(resolve(root, name)));
await put('source/source-manifest.json', JSON.stringify({ upstreamCommit:config.upstreamCommit,
  originalZipSha256:config.sourceZipSha256, parts, projectFiles:sourceFiles,
  packagingChanges:['Root launcher, isolation bootstrap, truthful beta status, unsupported disc entry hidden, analytics disabled, notice links'] }, null, 2));
await put('source/index.html', `<!doctype html><meta charset="utf-8"><title>Corresponding source</title><h1>Corresponding source for this beta</h1><p>Upstream <a href="${sourceUrl}">${config.upstreamCommit}</a>; unmodified exact local source ZIP supplied below.</p><ul>${parts.map(part=>`<li><a href="${part.name}">${part.name}</a></li>`).join('')}</ul><p>Concatenate parts in numeric order to reconstruct NewShoes-source.zip. SHA-256: ${config.sourceZipSha256}.</p><p>POSIX: <code>cat NewShoes-source.zip.part01 NewShoes-source.zip.part02 &gt; NewShoes-source.zip</code></p><p>Windows Command Prompt: <code>copy /b NewShoes-source.zip.part01+NewShoes-source.zip.part02 NewShoes-source.zip</code></p><p>Extract it inside Linux and apply the files below before building with the supplied Dockerfile.</p><ul>${sourceFiles.map(name=>`<li><a href="project/${name}">${name}</a></li>`).join('')}</ul><a href="../LICENSE.md">Complete license</a> · <a href="source-manifest.json">Source manifest</a>`);
await mkdir(cloudflare, { recursive:true });
for (const [name, bytes] of bytesByName) {
  const destination=resolve(cloudflare,name); await mkdir(dirname(destination),{recursive:true}); await writeFile(destination,bytes);
}
await writeFile(resolve(cloudflare,'index.html'),launcher.replace('<script src="../coi-direct.js"></script>','<script defer src="../retire-service-worker.js"></script>'));
for (const name of ['coi-serviceworker.js','retire-service-worker.js']) {
  await copyFile(resolve(source,'WebAssembly/cloudflare',name),resolve(cloudflare,name));
}
await writeFile(resolve(cloudflare,'_headers'),'/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: public, max-age=0, must-revalidate\n');
await writeFile(resolve(cloudflare,'_redirects'),'/launcher.html / 302\n/harness/play.html / 302\n');
await writeFile(resolve(target,'package-manifest.json'),JSON.stringify({ generatedAt:new Date().toISOString(),
  source:server.origin, config, pages:[...bytesByName].map(([name,bytes])=>({ name,bytes:bytes.length,sha256:hash(bytes) })) },null,2));
console.log(`Packaged ${bytesByName.size} allowlisted files. GitHub: ${pages}. Cloudflare: ${cloudflare}.`);
