import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifact = resolve(root, '.local/deployment/pages');
const destination = resolve(root, '.local/github-pages');
const manifest = JSON.parse(await readFile(resolve(root, '.local/deployment/package-manifest.json'), 'utf8'));
const expected = new Set([...manifest.pages.map(file => file.name), 'README.md', '.gitignore']);
await mkdir(destination, { recursive: true });
// Preserve this checkout across subsequent deployments, but refuse unrelated files.
async function inspect(path, prefix = '') {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (!prefix && entry.name === '.git') continue;
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${name}`);
    if (entry.isDirectory()) await inspect(resolve(path, entry.name), name + '/');
    else if (!expected.has(name)) throw new Error(`Unexpected publication file: ${name}`);
  }
}
await inspect(destination);
for (const file of manifest.pages) {
  const bytes = await readFile(resolve(artifact, file.name));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Changed artifact: ${file.name}`);
  const target = resolve(destination, file.name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(artifact, file.name), target);
}
await writeFile(resolve(destination, '.gitignore'), '*.big\n*.iso\n*.sav\n*.rep\n.env*\n');
await writeFile(resolve(destination, 'README.md'), `# Winchester OS — Home Edition

**Version ${manifest.config.projectVersion} — testing preview.** A nostalgic personal gaming desktop based on [Project New Shoes](https://github.com/Agusx1211/NewShoes), with the locally compiled Zero Hour engine.

Original Winchester branding and landscape wallpaper, a personal desktop name, three window colors, Simple/All shortcuts, and compact Settings. [V2 release notes](VERSION_2.md). The preserved V1 baseline is tagged v1.0.0.

The site imports compatible game archives locally. Retail game data is not hosted or distributed here. Windows browser skirmish, sound, save/load, and desktop controls were tested. macOS gameplay, internet multiplayer, other editions, and long matches still need verification.

V2 interface and migration checks passed locally and through the GitHub-style package. Engine artifacts are unchanged from V1; gameplay was not rerun for this identity milestone.

## Play

Open this repository's GitHub Pages website in current desktop Chrome. Select your compatible combined English installation's Data folder, install it in the browser, and launch Zero Hour. Choose Solo Play → Skirmish and enter a player name. Ctrl+Alt+Escape returns to the desktop. Each browser and website origin maintains its own local library.

## Build and license

Upstream revision: ${manifest.config.upstreamCommit}. The threaded runtime was compiled locally with Docker and Emscripten 3.1.6. GitHub Pages browser isolation is supplied by the upstream service worker.

[Complete license](LICENSE.md) · [Notices](legal.html) · [Corresponding source and modifications](source/index.html) · [Beta status](project-info.json)

The source archive is split into two downloadable parts; reconstruction instructions and checksums are provided. Original archives are not modified. Optional movie playback is not included in this beta.
`);
console.log(`Prepared ${manifest.pages.length + 2} reviewed publication files at ${destination}`);
