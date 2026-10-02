import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
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
console.log('Transfer relay settings and recovery markup ready.');
