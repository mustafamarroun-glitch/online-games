import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL(process.argv[2] || 'https://mustafamarroun-glitch.github.io/online-games/');
if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Use a public HTTPS URL.');
const manifest = JSON.parse(await readFile(resolve(root, '.local/deployment/package-manifest.json'), 'utf8'));
const names = ['index.html', 'launcher.html', 'coi-bootstrap.js', 'coi-direct.js', 'coi-serviceworker.js',
  'harness/launcher.js', 'harness/launcher-archive-specs.js', 'harness/build-info.json',
  'harness/launcher-desktop-apps.js', 'harness/launcher-archive-download.mjs', 'harness/launcher-backup-zip.mjs', 'harness/launcher.css',
  'dist-threaded-release/cnc-port.js', 'dist-threaded-release/cnc-port.wasm', 'dist-threaded-release/cnc-port.worker.js',
  'harness/vendor/7z-wasm/7zz.wasm', 'source/index.html', 'source/source-manifest.json',
  'source/NewShoes-source.zip.part01', 'source/NewShoes-source.zip.part02', 'LICENSE.md', 'project-info.json'];
names.push('manifest.webmanifest', 'VERSION_2.md', 'harness/launcher-winchester.mjs', 'harness/launcher-winchester.css', 'harness/launcher-entry.mjs', 'harness/launcher-os-shutdown.mjs', 'harness/launcher-build-info.js', 'harness/assets/winchester/mark.svg', 'harness/assets/winchester/home.webp', 'harness/assets/winchester/icon-192.png', 'harness/assets/winchester/icon-512.png');
names.push('harness/launcher-device-transfer.mjs', 'harness/device-transfer-network.mjs', 'harness/device-transfer-network.json', 'harness/launcher-transfer-network.css', 'source/project/TRANSFER_FIX.md');
names.push('harness/launcher-san-andreas.mjs', 'SAN_ANDREAS.md', ...manifest.pages.filter(file => file.name.startsWith('games/san-andreas/')).map(file => file.name));
names.push('VERSION_3.md','SECURITY_REVIEW.md','harness/device-transfer-validation.mjs','harness/device-transfer-protocol.mjs','harness/archive-transfer-validation.mjs','harness/launcher-asset-manager.mjs','harness/mod-package-store.mjs','harness/launcher-games.mjs','harness/launcher-hardware-info.js','harness/vendor/trystero-transfer-nostr.min.mjs','source/project/overrides/build/package.json','source/project/overrides/build/package-lock.json');
names.push('VERSION_4.md', 'YURIS_REVENGE.md', 'YURIS_MULTIPLAYER.md', 'harness/launcher-yuri.mjs', 'harness/launcher-yuri-library.mjs', ...manifest.pages.filter(file => file.name.startsWith('games/yuris-revenge/') || /harness\/assets\/winchester\/(flow|hills)/.test(file.name)).map(file => file.name));
const checked = [];
for (let offset = 0; offset < names.length; offset += 4) {
  const results = await Promise.allSettled(names.slice(offset, offset + 4).map(async name => {
    let response;
    try {
      response = await fetch(new URL(name, base), { signal: AbortSignal.timeout(60000), cache: 'no-store' });
    } catch (error) { throw new Error(`${name}: ${error.message}`); }
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const expected = manifest.pages.find(file => file.name === name);
    if (createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw new Error(`${name}: checksum mismatch`);
    if (name.endsWith('.wasm') && !response.headers.get('content-type')?.includes('application/wasm')) throw new Error(`${name}: incorrect MIME type`);
    return { name, bytes: bytes.length, sha256: expected.sha256, status: response.status };
  }));
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
    checked.push(result.value);
  }
  console.log(`Checked ${checked.length}/${names.length} HTTPS publication files.`);
}
const report = { checkedAt: new Date().toISOString(), publicUrl: base.href, checksums: 'passed', checked,
  browserEngineBoot: 'checked separately through the real browser', macOS: 'unverified', multiplayer: 'unverified' };
await writeFile(resolve(root, '.local/hosted-deployment-verification.json'), JSON.stringify(report, null, 2));
console.log(`Verified ${checked.length} public HTTPS files, including engine WASM, worker, complete source parts, and license: ${base.href}`);
