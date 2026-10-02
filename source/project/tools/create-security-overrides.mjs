import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { SECURITY_POLICY } from '../deployment/security-policy.mjs';
const root = new URL('../', import.meta.url);
const output = new URL('overrides/pages/',root);
await mkdir(output,{recursive:true});
let games = await readFile(new URL('vendor/NewShoes-main/WebAssembly/harness/launcher-games.mjs',root),'utf8');
const gameReplace = (from,to) => {
  if (games.split(from).length !== 2) throw new Error('Game security anchor changed: ' + from);
  games = games.replace(from,to);
};
gameReplace('<span>Address</span><input value=', '<span>Address</span><input aria-label="Games folder address" name="gamesFolderAddress" value=');
gameReplace('const GAME_PROTOCOL_VERSION = 1;', `const escapeGameText = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));\nconst GAME_PROTOCOL_VERSION = 1;`);
gameReplace('corner.innerHTML = `<b>${rankLabel(card.rank)}</b><i>${card.suit}</i>`;', 'corner.innerHTML = "<b></b><i></i>";\n    corner.querySelector("b").textContent = rankLabel(card.rank);\n    corner.querySelector("i").textContent = card.suit;');
gameReplace('ROUND ${state.round + 1}</span>', 'ROUND ${escapeGameText(state.round + 1)}</span>');
for (const expression of ['score','state.roundPoints[seat]','state.teamScores[localSeat % 2]','state.teamScores[1 - (localSeat % 2)]','state.hands[seat].length','state.scores[seat]','state.bids?.[seat] ?? "?"','state.tricksWon?.[seat] ?? 0']) {
  gameReplace('${'+expression+'}', '${escapeGameText('+expression+')}');
}
await writeFile(new URL('overrides/harness/launcher-games.mjs',root),games);
let hardware = await readFile(new URL('vendor/NewShoes-main/WebAssembly/harness/launcher-hardware-info.js',root),'utf8');
hardware = hardware.replace('  async function collectReport() {', '  function safeCapability(object, key) {\n    try { return object[key]; } catch { return undefined; }\n  }\n\n  async function collectReport() {');
for (const [object,keys] of [['navigator',['serviceWorker','gpu','locks','hid','usb','clipboard']],['window',['indexedDB','caches']]]) {
  for (const key of keys) hardware = hardware.replaceAll(`${object}.${key}`, `safeCapability(${object}, "${key}")`);
}
await writeFile(new URL('overrides/harness/launcher-hardware-info.js',root),hardware);
const workerFile = new URL('overrides/harness/launcher-asset-worker.js',root);
let worker = await readFile(workerFile,'utf8');
worker = worker.replace('`${label}: invalid OPFS write result (${written} for ${remaining} bytes)`', '`Browser storage could not finish writing ${label}. Free browser storage or use a browser with more available storage, then try again (write result ${written} for ${remaining} bytes)`');
await writeFile(workerFile,worker);
await writeFile(new URL('overrides/harness/mod-package-format.mjs',root),await readFile(new URL('vendor/NewShoes-main/WebAssembly/harness/mod-package-format.mjs',root)));
for (const name of ['coi-bootstrap.js','coi-serviceworker.js']) {
  let text = await readFile(new URL(`vendor/NewShoes-main/WebAssembly/pages/${name}`,root),'utf8');
  text = text.replaceAll('project-new-shoes.pages-root.v1','winchester.pages-root.v3');
  if (name === 'coi-serviceworker.js') {
    text = text.replace('if (url.origin !== self.location.origin)', 'if (url.origin !== self.location.origin || !url.pathname.startsWith(scopeUrl.pathname))');
    text = text.replace('    headers.set("Cross-Origin-Opener-Policy", COOP);', `    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    if (navigation && [scopeUrl.pathname, launcherUrl.pathname, legacyPlayUrl.pathname].includes(url.pathname)) {
      headers.set("Content-Security-Policy", ${JSON.stringify(SECURITY_POLICY + "; frame-ancestors 'self'")});
      headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    }
    headers.set("Cross-Origin-Opener-Policy", COOP);`);
  }
  await writeFile(new URL(name,output),text);
}
console.log('Generated Version 3 service-worker security headers and matching bootstrap.');
const managerFile = new URL('overrides/harness/launcher-asset-manager.mjs',root);
let manager = await readFile(managerFile,'utf8');
if (!manager.includes('archive-transfer-validation.mjs')) {
  manager = 'import { validateTransferredArchive } from "./archive-transfer-validation.mjs";\n' + manager;
  const anchor = '            if (current.kind === "video") {';
  if (manager.split(anchor).length !== 2) throw new Error('Archive receive validation anchor changed');
  manager = manager.replace(anchor, '            if (["archive", "cursor"].includes(current.kind)) await validateTransferredArchive(stored,current.entryCount);\n' + anchor);
  await writeFile(managerFile,manager);
}
let modStore = await readFile(new URL('vendor/NewShoes-main/WebAssembly/harness/mod-package-store.mjs',root),'utf8');
const modAnchor = '          if (current.hash.digestHex() !== current.archive.sha256) {';
if (modStore.split(modAnchor).length !== 2) throw new Error('Mod receive validation anchor changed');
modStore = 'import { validateTransferredArchive } from "./archive-transfer-validation.mjs";\n' + modStore;
modStore = modStore.replace(modAnchor, '          await validateTransferredArchive(await opfsFile(current.archive.target.opfsPath));\n' + modAnchor);
await writeFile(new URL('overrides/harness/mod-package-store.mjs',root),modStore);
