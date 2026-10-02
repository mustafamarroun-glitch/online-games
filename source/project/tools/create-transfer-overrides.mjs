import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
// File sharing needs a small warm offer pool; each speculative offer can
// allocate TURN resources. Keep multiplayer's upstream library unchanged.
const transferLibrary = await readFile(new URL('vendor/NewShoes-main/WebAssembly/harness/vendor/trystero-nostr.min.mjs',root),'utf8');
if (!transferLibrary.includes('go=20,Jt=class')) throw new Error('Review the upstream Trystero offer pool before regenerating.');
await mkdir(new URL('overrides/harness/vendor/',root),{recursive:true});
await writeFile(new URL('overrides/harness/vendor/trystero-transfer-nostr.min.mjs',root),transferLibrary.replace('go=20,Jt=class','go=2,Jt=class'));
let protocol = await readFile(new URL('vendor/NewShoes-main/WebAssembly/harness/device-transfer-protocol.mjs',root),'utf8');
const protocolChanges = [
  ['  const bytes = asBytes(payload);', '  const bytes = asBytes(payload);\n  if (bytes.byteLength > DEVICE_TRANSFER_CHUNK_BYTES) throw new Error("Transfer payload is too large");'],
  ['  if (envelope.byteLength < 1 + IV_BYTES + 16 || envelope[0] !== ENVELOPE_VERSION)', '  if (envelope.byteLength > 1 + IV_BYTES + 16 + HEADER_LENGTH_BYTES + 128 * 1024\n      || envelope.byteLength < 1 + IV_BYTES + 16 || envelope[0] !== ENVELOPE_VERSION)'],
  ['  if (headerBytes > plaintext.byteLength - HEADER_LENGTH_BYTES)', '  if (headerBytes > 64 * 1024 || headerBytes > plaintext.byteLength - HEADER_LENGTH_BYTES\n      || plaintext.byteLength - HEADER_LENGTH_BYTES - headerBytes > DEVICE_TRANSFER_CHUNK_BYTES)'],
];
for (const [before,after] of protocolChanges) {
  if (protocol.split(before).length !== 2) throw new Error('Review the changed upstream transfer protocol.');
  protocol = protocol.replace(before,after);
}
await writeFile(new URL('overrides/harness/device-transfer-protocol.mjs',root),protocol);
const file = new URL('overrides/harness/play.html', root);
let html = await readFile(file, 'utf8');
if (!html.includes('id="transferNetworkSettings"')) {
  html = html.replace('<p class="transfer-local-note"><svg>', `<details id="transferNetworkSettings" class="transfer-network-settings">
                <summary>Connection settings</summary>
                <p>Direct transfer works when your network allows it. An internet relay connects devices across restricted Wi-Fi, VPNs, and mobile networks. Files stay PIN-encrypted through the relay.</p>
                <form id="transferRelayForm" autocomplete="off">
                  <label for="transferRelayUrl">Relay address <textarea id="transferRelayUrl" rows="2" placeholder="turn:your-relay:3478&#10;turns:your-relay:443?transport=tcp" spellcheck="false" required></textarea></label>
                  <label for="transferRelayUser">Relay username <input id="transferRelayUser" type="text" required></label>
                  <label for="transferRelayPassword">Relay password <input id="transferRelayPassword" type="password" autocomplete="off" required></label>
                  <div class="transfer-network-buttons"><button type="submit" class="button secondary">Save relay</button><button id="transferRelayTest" type="button" class="button secondary">Test relay</button><button id="transferRelayClear" type="button" class="button secondary">Clear</button></div>
                </form>
                <p id="transferNetworkStatus" role="status">No internet relay configured for this tab. Enter relay details on both devices, or use the same Wi-Fi with VPNs off.</p>
              </details>
              <p class="transfer-local-note"><svg>`);
  html = html.replace('Files travel over an encrypted peer-to-peer connection. The discovery relay never carries game data.', 'Files stay PIN-encrypted, whether connected directly or through an internet relay. The discovery service never carries game data.');
  html = html.replace('Game data is traveling directly between your devices', 'Files stay PIN-encrypted, including through an internet relay');
  html = html.replace('<footer class="transfer-actions"><button id="transferStopSend"', '<footer class="transfer-actions"><button type="button" class="button secondary" data-transfer-settings>Connection settings</button><button id="transferStopSend"');
  html = html.replace('<footer class="transfer-actions"><button id="transferCancelReceive"', '<footer class="transfer-actions"><button id="transferRetryReceive" type="button" class="button primary" hidden>Retry connection</button><button type="button" class="button secondary" data-transfer-settings>Connection settings</button><button id="transferCancelReceive"');
  html = html.replace('<link rel="stylesheet" href="./launcher-backup.css">', '<link rel="stylesheet" href="./launcher-backup.css">\n    <link rel="stylesheet" href="./launcher-transfer-network.css">');
  await writeFile(file, html);
}
html = html.replace('id="transferRelayUrl" rows="2"', 'id="transferRelayUrl" name="relayUrl" maxlength="4096" rows="2"')
  .replace('id="transferRelayUser" type="text"', 'id="transferRelayUser" name="relayUser" maxlength="1024" spellcheck="false" type="text"')
  .replace('id="transferRelayPassword" type="password"', 'id="transferRelayPassword" name="relayPassword" maxlength="1024" type="password"');
await writeFile(file, html);
console.log('Transfer relay settings, bounded protocol and recovery markup ready.');
