import { readFile, writeFile, mkdir, copyFile, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, basename } from 'node:path';
import { PAGES_HARNESS_FILES, PAGES_DEPENDENCY_FILES, PAGES_RUNTIME_FILES } from '../vendor/NewShoes-main/WebAssembly/tools/pages_site_manifest.mjs';
import { SECURITY_META } from '../deployment/security-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(resolve(root, 'deployment/project.json'), 'utf8'));
const branding = JSON.parse(await readFile(resolve(root, 'deployment/branding.json'), 'utf8'));
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
    let bytes;
    if (PAGES_DEPENDENCY_FILES.includes(name)) {
      try { bytes = await get(`node_modules/7z-wasm/${basename(name)}`); }
      catch (error) {
        if (!String(error.message).endsWith('HTTP 404')) throw error;
        bytes = await get(name); // The retained compiled website already contains this dependency.
      }
    } else bytes = await get(name);
    if (name.endsWith('/analytics.mjs')) bytes = Buffer.from(bytes.toString().replaceAll('__GA_MEASUREMENT_ID__', ''));
    if (/\/(mod-package-worker|custom-map-package-worker)\.mjs$/.test(name)) {
      bytes = Buffer.from(bytes.toString().replaceAll('../node_modules/7z-wasm/', './vendor/7z-wasm/'));
    }
    await put(name, bytes);
  }));
}
// Local preview and deployment use the exact same project overlays.
async function packageOverrides(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await packageOverrides(resolve(directory, entry.name), name + '/');
    else if (entry.isFile() && name !== 'play.html') await put(`harness/${name}`, await readFile(resolve(directory, entry.name)));
  }
}
await packageOverrides(resolve(root, 'overrides/harness'));
// A separate engine and AGPL corresponding source, never the user's installation.
const sanAndreas = JSON.parse(await readFile(resolve(root, 'experiments/san-andreas/provenance.json'), 'utf8'));
for (const file of sanAndreas.artifacts) {
  if (file.path.split('/').some(part => part.startsWith('.'))) continue;
  const bytes = await readFile(resolve(root, 'experiments/san-andreas', file.path));
  if (hash(bytes) !== file.sha256) throw new Error(`Changed San Andreas artifact: ${file.path}`);
  await put(`games/san-andreas/${file.path.replace(/^runtime\//, '')}`, bytes);
}
await put('games/san-andreas/provenance.json', JSON.stringify(sanAndreas, null, 2));
if (hash(bytesByName.get('dist-threaded-release/cnc-port.wasm')) !== config.runtimeWasmSha256) {
  throw new Error('This is not the verified locally compiled engine.');
}
for (const name of ['coi-bootstrap.js', 'coi-direct.js', 'coi-serviceworker.js']) {
  const overlay = ['coi-bootstrap.js','coi-serviceworker.js'].includes(name);
  await put(name, await readFile(overlay ? resolve(root,'overrides/pages',name) : resolve(source, 'WebAssembly/pages', name)));
}
const sourceUrl = `https://github.com/Agusx1211/NewShoes/tree/${config.upstreamCommit}`;
const discovery = `<meta name="description" content="Zero Hour browser desktop testing beta. Import compatible local game files.">\n<meta name="robots" content="noindex,nofollow">`;
let bootstrap = await readFile(resolve(source, 'WebAssembly/pages/index.html'), 'utf8');
bootstrap = bootstrap.replace('<!-- __PUBLIC_PROJECT_DISCOVERY__ -->', discovery)
  .replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${SECURITY_META}`)
  .replace('<!-- __PUBLIC_PROJECT_SUMMARY__ -->', `<section class="project-summary"><h2>${escape(config.name)} · testing beta</h2><p>Import compatible game files locally. macOS and internet multiplayer testing are pending.</p></section>`)
  .replaceAll('__PAGES_SOURCE_URL__', './source/index.html');
bootstrap = bootstrap.replaceAll('Project New Shoes', branding.name)
  .replaceAll('./harness/assets/brand/project-new-shoes.ico', './harness/assets/winchester/mark.svg')
  .replaceAll('./harness/assets/brand/project-new-shoes-apple-touch.png', './harness/assets/winchester/icon-192.png');
await put('index.html', bootstrap);
let launcher = await readFile(resolve(root, 'overrides/harness/play.html'), 'utf8');
launcher = launcher.replace('<!-- __PUBLIC_PROJECT_DISCOVERY__ -->', discovery)
  .replace(/<title>[^<]*<\/title>/, `<title>${escape(config.name)} · ${escape(branding.edition)}</title>`)
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
// The V2 launcher overlay already guards the unsupported disc entry.
await put('harness/launcher.js', launcherJs);
const manifest = JSON.parse(bytesByName.get('harness/manifest.webmanifest'));
await put('manifest.webmanifest', JSON.stringify({ ...manifest, name: config.name, short_name: config.name,
  start_url: './', scope: './', icons: manifest.icons.map(icon => ({ ...icon, src: './harness/' + icon.src.replace(/^\.\//, '') })) }, null, 2));
await put('harness/play.html', '<!doctype html><meta charset="utf-8"><title>Open browser desktop</title><script src="../coi-direct.js"></script><a href="../">Open desktop</a>');
// The branded overlay includes project version and original engine provenance.
await put('project-info.json', JSON.stringify(config, null, 2));
await put('VERSION_2.md', await readFile(resolve(root,'VERSION_2.md')));
await put('VERSION_3.md', await readFile(resolve(root,'VERSION_3.md')));
await put('SECURITY_REVIEW.md', await readFile(resolve(root,'SECURITY_REVIEW.md')));
await put('SAN_ANDREAS.md', '# San Andreas in Winchester OS\n\nOpen Game Library → San Andreas → Play, or use its desktop/Start shortcut. It runs in a Winchester OS window. Select your own installation folder containing data and models. Files are read locally; game data is not hosted.\n\nThis is an OpenSA 0.2.0 solo exploration and driving prototype. Original missions and multiplayer are unavailable. It uses a police character, not CJ, and does not execute the original game or its native plugins.\n\nBrowsers without showDirectoryPicker use a folder-upload control. The word upload in the browser dialog means allowing this local application to read the selection; files are not sent to a server. The fallback remembers files for the current desktop session; select again after refreshing Winchester OS. Native folder handles can be remembered where supported.\n\nOpenSA copyright 2026 Aleksandrov Sergey; AGPL-3.0-only. Baseline: https://github.com/Avatarchik/opensa at d30f4e8ad2d41a9c7965c1416d7e857b5ef5f7e6. [Complete license](games/san-andreas/LICENSE) · [Complete modified source](games/san-andreas/OpenSA-preview-source.zip) · [Provenance](games/san-andreas/provenance.json).\n');
await put('.nojekyll', '');
await put('LICENSE.md', await readFile(resolve(source, 'LICENSE.md')));
let legal = await readFile(resolve(source, 'WebAssembly/pages/legal.html'), 'utf8');
legal = legal.replaceAll('__PAGES_SOURCE_URL__', './source/index.html')
  .replace(/<section>\s*<h2>Browser video runtime<\/h2>[\s\S]*?<\/section>/,
    '<section><h2>Testing beta</h2><p>This build adapts the importer for a combined English installation. macOS, multiplayer, other editions, and optional movies remain unverified. Retail game files are not included.</p></section>');
legal = legal.replace('</body>', '<section><h2>San Andreas exploration engine</h2><p>OpenSA code copyright 2026 Aleksandrov Sergey, licensed under AGPL-3.0. This modified engine is an experimental solo browser runtime. Game files are supplied locally by each player.</p><p><a href="games/san-andreas/LICENSE">Complete AGPL license</a> · <a href="games/san-andreas/OpenSA-preview-source.zip">Complete corresponding source</a> · <a href="games/san-andreas/provenance.json">Engine provenance</a></p></section></body>');
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
const sourceFiles = ['Dockerfile', 'compose.yaml', '.dockerignore', 'Start-Local.ps1', 'TRANSFER_FIX.md',
  'VERSION_3.md', 'SECURITY_REVIEW.md', 'tools/create-security-overrides.mjs', 'deployment/security-policy.mjs',
  'tools/audit-dependencies.mjs', 'tools/prepare-build-dependencies.mjs', 'tools/verify-security.mjs', 'tools/verify-v3-browser.cjs', 'tools/verify-v3-engine.cjs', 'tools/verify-game-render-security.cjs', 'tools/backup-project.py',
  'tools/patch-opensa-build-dependencies.mjs', 'tools/verify-transfer-browser.cjs', 'tools/verify-transfer-recovery.cjs', 'tools/verify-transfer-website-relay.cjs', 'tools/verify-winchester-ui.cjs', 'tools/verify-hosted-deployment.mjs',
  'Start-SanAndreas.ps1', 'tools/serve-san-andreas-preview.mjs', 'tools/package-san-andreas-preview.py',
  'tools/create-combined-overrides.mjs', 'tools/serve-local-preview.mjs', 'tools/fetch-prebuilt-runtime.ps1',
  'tools/package-deployment.mjs', 'tools/verify-deployment.mjs', 'tools/prepare-github-repository.mjs', 'tools/create-backup-overrides.mjs', 'tools/create-winchester-overrides.mjs', 'tools/create-transfer-overrides.mjs', 'deployment/project.json', 'deployment/branding.json'];
async function listOverrideSources(directory, prefix = 'overrides/') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await listOverrideSources(resolve(directory, entry.name), prefix + entry.name + '/');
    else if (entry.isFile()) sourceFiles.push(prefix + entry.name);
  }
}
await listOverrideSources(resolve(root, 'overrides'));
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
