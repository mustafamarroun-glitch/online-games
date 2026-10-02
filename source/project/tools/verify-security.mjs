import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deriveTransferKey,sealTransferMessage,openTransferMessage } from '../overrides/harness/device-transfer-protocol.mjs';
import { validateCombinedManifest,validateTransferMessage,MAX_TRANSFER_FILES,MAX_TRANSFER_BYTES } from '../overrides/harness/device-transfer-validation.mjs';
import { validateTransferredArchive } from '../overrides/harness/archive-transfer-validation.mjs';
import { createBigDirectory } from '../vendor/NewShoes-main/WebAssembly/harness/mod-package-format.mjs';
import { validateIceServers,loadTransferNetwork } from '../overrides/harness/device-transfer-network.mjs';
import { buildArchiveZip } from '../overrides/harness/launcher-backup-zip.mjs';
const root = new URL('../',import.meta.url);
const checks = [];
const manifest = {version:3,game:'zeroHour',files:[{id:'archive-1',kind:'archive',name:'INIZH.big',bytes:80,entryCount:1}]};
assert.equal(validateCombinedManifest(manifest).totalBytes,80);
for (const patch of [{name:'../evil.big'},{name:'a\\evil.big'},{name:'x\0.big'},{id:'x:y'},{bytes:'80'},{bytes:0},{bytes:MAX_TRANSFER_BYTES+1},{entryCount:NaN},{kind:'executable'}]) {
  assert.throws(()=>validateCombinedManifest({...manifest,files:[{...manifest.files[0],...patch}]}));
}
assert.throws(()=>validateCombinedManifest({...manifest,files:Array(MAX_TRANSFER_FILES+1).fill(manifest.files[0])}));
assert.throws(()=>validateCombinedManifest({...manifest,files:[manifest.files[0],manifest.files[0]]}));
checks.push('Manifest paths, types, names, IDs, duplicate files and resource bounds');
const key = await deriveTransferKey('123456789012');
const message = {type:'chunk',transferId:crypto.randomUUID(),fileId:'archive-1',offset:0,checkpoint:false,seq:0};
const envelope = await sealTransferMessage(key,message,new Uint8Array([1,2,3]));
const opened = await openTransferMessage(key,envelope);
validateTransferMessage(opened.message,opened.payload);
const changed = envelope.slice(); changed[changed.length-1] ^= 1;
await assert.rejects(()=>openTransferMessage(key,changed));
function badKey() { return deriveTransferKey('999999999999'); }
// Wrong keys and bad tags are rejected by native AES-GCM.
const awaitKey = await badKey();
await assert.rejects(()=>openTransferMessage(awaitKey,envelope));
await assert.rejects(()=>sealTransferMessage(key,message,new Uint8Array(65537)),/too large/);
await assert.rejects(()=>openTransferMessage(key,new Uint8Array(131106)),/envelope/);
for (const patch of [{offset:-1},{seq:NaN},{checkpoint:true,seq:0},{fileId:'../escape'},{transferId:'bad'},{type:'execute'}]) {
  assert.throws(()=>validateTransferMessage({...message,...patch},opened.payload));
}
checks.push('Native AES-GCM tampering/wrong PIN; envelope/payload, sequence and range bounds');
const {header,totalSize} = createBigDirectory([{enginePath:'data/test.bin',size:48}]);
const bytes = new Uint8Array(totalSize); bytes.set(header);
await validateTransferredArchive(new File([bytes],'test.big'),1);
const bigEndian = bytes.slice(); new DataView(bigEndian.buffer).setUint32(4,totalSize);
await validateTransferredArchive(new File([bigEndian],'localized.big'),1);
await assert.rejects(()=>validateTransferredArchive(new File(['MZ executable'],'bad.big')));
const badExtent = bytes.slice(); new DataView(badExtent.buffer).setUint32(16,0xfffffff0);
await assert.rejects(()=>validateTransferredArchive(new File([badExtent],'bad.big'),1));
await assert.rejects(()=>validateTransferredArchive(new File([bytes],'test.big'),2));
checks.push('BIGF signature, archive count/size/directory/extents, localized size compatibility');
assert.throws(()=>validateIceServers([{urls:'javascript:alert(1)'}]));
assert.throws(()=>validateIceServers([{urls:'turn:relay.example:3478'}]));
const nativeFetch = globalThis.fetch;
globalThis.location = {href:'https://desktop.example/'};
try {
  globalThis.fetch = async()=>new Response(JSON.stringify({iceServers:[],credentialEndpoint:'http://untrusted.example/'}));
  await assert.rejects(()=>loadTransferNetwork(),/HTTPS/);
  globalThis.fetch = async()=>new Response(' '.repeat(32769));
  await assert.rejects(()=>loadTransferNetwork(),/too large/);
} finally { globalThis.fetch = nativeFetch; delete globalThis.location; }
checks.push('Relay scheme/credential validation and bounded JSON response');
for (const files of [[],[{name:'../bad.big',file:new Blob(['a'])}],[{name:'a.big',file:new Blob(['a'])},{name:'A.big',file:new Blob(['b'])}]]) {
  await assert.rejects(()=>buildArchiveZip(files));
}
const zip = await buildArchiveZip([{name:'a.big',file:new Blob([bytes])}]);
assert.ok(zip.size>bytes.length);
const abort = new AbortController(); abort.abort();
await assert.rejects(()=>buildArchiveZip([{name:'a.big',file:new Blob([bytes])}],{signal:abort.signal}),{name:'AbortError'});
checks.push('ZIP backup names, duplicate entries and cancellation');
const publication = JSON.parse(await readFile(new URL('.local/deployment/package-manifest.json',root),'utf8'));
const textNames = /\.(?:js|mjs|html|css|json|md|txt)$/;
for (const file of publication.pages) {
  assert.ok(!/(^|\/)(?:\.local|\.env[^/]*|\.git|node_modules)(\/|$)|\.(?:big|iso|sav|rep)$/i.test(file.name),file.name);
  const data = await readFile(new URL(`.local/deployment/pages/${file.name}`,root));
  assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256,file.name);
  if (textNames.test(file.name)) assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|C:\\Users\\/.test(data.toString()),file.name);
}
const launcher = await readFile(new URL('.local/deployment/pages/launcher.html',root),'utf8');
assert.ok(launcher.includes('Content-Security-Policy') && !launcher.includes('allow-forms allow-scripts allow-same-origin'));
assert.ok([...launcher.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].every(match=>!match[1].trim()));
checks.push('Publication inventory/checksums, no private keys/tokens/retail data, sandbox and CSP');
const report = {checkedAt:new Date().toISOString(),checks,publicationFiles:publication.pages.length,status:'passed'};
await writeFile(new URL('.local/v3-security-verification.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
