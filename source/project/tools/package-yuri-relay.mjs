import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, '.local/ra2-vm/source');
const git = process.env.WINCHESTER_GIT || 'git';
const commit = 'a10ac9899c258b01be1edd80492397e9de225ba5';
if (execFileSync(git, ['-c', `safe.directory=${source.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() !== commit) throw new Error('Unexpected relay source revision.');
const target = resolve(root, 'experiments/yuri-relay');
await mkdir(resolve(target, 'licenses/ws'), { recursive: true });
const require = createRequire(resolve(source, 'packages/relay/package.json'));
await require('esbuild').build({ absWorkingDir: resolve(source, 'packages/relay'), entryPoints: ['./src/server/gameRelay.ts'], bundle: true, platform: 'node', target: 'es2022', format: 'cjs', external: ['bufferutil', 'utf-8-validate'], outfile: resolve(target, 'relay.cjs') });
for (const name of ['LICENSE', 'RELAY_PROTOCOL.md']) await copyFile(resolve(source, 'packages/relay', name), resolve(target, name));
await copyFile(resolve(source, 'packages/relay/node_modules/ws/LICENSE'), resolve(target, 'licenses/ws/LICENSE'));
const { zipSync } = createRequire(resolve(source, 'package.json'))('fflate');
const archive = {};
const names = execFileSync(git, ['-c', `safe.directory=${source.replaceAll('\\', '/')}`, 'ls-files', '-z', 'packages/relay'], { cwd: source }).toString().split('\0');
for (const name of names.filter(Boolean)) archive[name] = new Uint8Array(await readFile(resolve(source, name)));
for (const name of ['tools/serve-yuri-multiplayer.mjs', 'tools/package-yuri-relay.mjs', 'tools/verify-yuri-multiplayer.mjs', 'tools/verify-yuri-friends-game.mjs', 'Start-YuriMultiplayer.ps1', 'Stop-YuriMultiplayer.ps1', 'YURIS_MULTIPLAYER.md']) archive['winchester/' + name] = new Uint8Array(await readFile(resolve(root, name)));
archive['WINCHESTER_BUILD.txt'] = new TextEncoder().encode(`Pinned RA2 VM ${commit}. The relay uses the upstream GameRelay unchanged. Build its standalone bundle using tools/package-yuri-relay.mjs with the pinned workspace dependencies; the source package specifies pnpm 11.24.0. No game data is included.\n`);
await writeFile(resolve(target, 'Yuri-relay-source.zip'), zipSync(archive));
const artifacts = [];
async function inventory(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await inventory(resolve(directory, entry.name), name + '/');
    else if (name !== 'provenance.json') {
      const bytes = await readFile(resolve(directory, entry.name));
      artifacts.push({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
}
await inventory(target);
await writeFile(resolve(target, 'provenance.json'), JSON.stringify({ engine: 'RA2 VM relay', commit, license: 'GPL-3.0-or-later', changes: ['Unmodified upstream relay in a standalone Node bundle', 'Inventory-only engine hosting and a random room', 'Temporary Cloudflare tunnel started separately'], artifacts }, null, 2));
console.log(JSON.stringify({ artifacts: artifacts.length, commit }));
