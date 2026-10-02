// Exercise the retained integration harness against our shipping overlay,
// using isolated profiles and generated fixtures, never the user's library.
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const deadline = setTimeout(() => { console.error('Transfer verification exceeded its 360-second deadline.'); process.exit(1); },360000);
deadline.unref();
(async () => {
  const preview = process.env.TRANSFER_PREVIEW || 'http://localhost:8091/harness/play.html';
  const mode = process.env.TRANSFER_TEST_MODE || 'direct';
  const forceRelay = mode === 'relay' || mode.startsWith('remote-relay');
  const root = path.resolve('.');
  const privateConfig = process.env.TRANSFER_TEST_CONFIG
    ? JSON.parse(await fs.readFile(process.env.TRANSFER_TEST_CONFIG, 'utf8')) : null;
  await fs.mkdir(path.join(root, 'output/playwright'), { recursive: true });
  const relayFile = path.join(root, 'vendor/NewShoes-main/WebAssembly/harness/nostr-test-relay-server.mjs');
  let relaySource = await fs.readFile(relayFile, 'utf8');
  const bundle = require(path.join(path.dirname(require.resolve('playwright-core/package.json')), 'lib/utilsBundle.js'));
  globalThis.__transferWebSocketServer = bundle.wsServer;
  relaySource = relaySource.replace('import { WebSocketServer } from "ws";', 'const WebSocketServer = globalThis.__transferWebSocketServer;');
  globalThis.__transferTestRelay = await import('data:text/javascript;base64,' + Buffer.from(relaySource).toString('base64'));
  globalThis.__transferTestChromium = chromium;
  globalThis.__transferTestPrepare = async page => {
    await page.addInitScript(() => {
      window.__writeFixtureBigHeader = async (bytes,paths) => {
        const {createBigDirectory} = await import(new URL('./mod-package-format.mjs',document.baseURI));
        const headerBytes = 16 + paths.reduce((sum,path)=>sum + 9 + new TextEncoder().encode(path).length,0);
        const dataBytes = bytes.length - headerBytes;
        const part = Math.floor(dataBytes/paths.length);
        const entries = paths.map((path,index)=>({enginePath:path,size:index===paths.length-1 ? dataBytes - part*index : part}));
        bytes.set(createBigDirectory(entries).header);
      };
    });
    if (privateConfig) await page.route('**/device-transfer-network.json', route => route.fulfill({ json: privateConfig }));
    if (process.env.TRANSFER_TEST_SMALL_POOL === '1') {
      const library = await fs.readFile(path.join(root,'vendor/NewShoes-main/WebAssembly/harness/vendor/trystero-nostr.min.mjs'),'utf8');
      if (!library.includes('go=20,Jt=class')) throw new Error('Upstream offer pool changed');
      await page.route('**/trystero-nostr.min.mjs', route => route.fulfill({body:library.replace('go=20,Jt=class','go=2,Jt=class'),contentType:'text/javascript'}));
    }
  };
  globalThis.__transferTestConfigure = async page => {
    if (mode === 'relay') {
      await page.evaluate(async () => {
        const { saveTabRelay } = await import(new URL('./harness/device-transfer-network.mjs', location.origin));
        saveTabRelay([{ urls: 'turn:127.0.0.1:13478?transport=tcp', username: 'transfer-test', credential: 'transfer-test-password' }]);
      });
    }
  };
  let source = await fs.readFile(path.join(root, 'vendor/NewShoes-main/WebAssembly/harness/device_transfer_browser_smoke.mjs'), 'utf8');
  source = source.replace('import { chromium } from "playwright";', 'const chromium = globalThis.__transferTestChromium;')
    .replace('page.on("pageerror", (error) => events.push({ label, type: "pageerror", text: error.message }));', 'page.on("pageerror", (error) => { console.error(label, error.message); events.push({ label, type: "pageerror", text: error.message }); });')
    .replace('import { startNostrTestRelayServer } from "./nostr-test-relay-server.mjs";', 'const { startNostrTestRelayServer } = globalThis.__transferTestRelay;')
    .replace('import { startStaticServer } from "./static-server.mjs";', '')
    .replace('const harnessRoot = dirname(fileURLToPath(import.meta.url));', `const harnessRoot = ${JSON.stringify(path.join(root, 'vendor/NewShoes-main/WebAssembly/harness'))};`)
    .replace('const screenshotDir = resolve(wasmRoot, "artifacts/screenshots/device-transfer");', `const screenshotDir = ${JSON.stringify(path.join(root, 'output/playwright', 'transfer-' + mode))};`)
    .replace('const server = await startStaticServer({ root: wasmRoot });', `const server = { url: ${JSON.stringify(new URL('/', preview).href)}, close: async () => {} };`)
    .replace('watch(page, label);',"watch(page, label);\n  console.log('Opening',label);\n  page.setDefaultTimeout(30000);\n  await globalThis.__transferTestPrepare(page);")
    .replace('return { context, page, label };',"console.log('Ready',label);\n  return { context, page, label };")
    .replace('await page.goto(new URL("harness/play.html?dist=dist", server.url).href,', `await page.goto(${JSON.stringify(preview)},`)
    .replace('const page = await context.newPage();', `await context.addInitScript(({ force }) => {
      const Native = window.RTCPeerConnection;
      window.__transferConnections = [];
      window.__transferIceErrors = [];
      window.RTCPeerConnection = class extends Native {
        constructor(config, ...rest) {
          super(force ? { ...config, iceTransportPolicy: 'relay' } : config, ...rest);
          window.__transferConnections.push(this);
          this.addEventListener('icecandidateerror', e => window.__transferIceErrors.push({code:e.errorCode,text:e.errorText}));
        }
      };
    }, { force: ${forceRelay}${mode.includes('receivers') ? " && label !== 'sender'" : ''} });
    const page = await context.newPage();`)
    .replace('await page.evaluate((url) => { window.__cncTestTransferRelayUrls = [url]; }, relay.url);', `await page.evaluate((url) => { window.__cncTestTransferRelayUrls = [url]; }, relay.url);
    await globalThis.__transferTestConfigure(page);`)
    .replace('const bytes = new Uint8Array(80 + index);', `const bytes = new Uint8Array(index === 0 ? ${Number(process.env.TRANSFER_TEST_LARGE_BYTES) || 3 * 1024 * 1024 + 23} : 80 + index);`)
    .replaceAll('timeout: 120_000','timeout: 300_000')
    .replace('localStorage.setItem("zeroh-installed-library.v5"', 'localStorage.setItem("zeroh-installed-library.combined.v6"')
    .replace('version: 5,', 'version: 6,')
    .replace('entryCount: 1,\n        opfsPath:', 'entryCount: 1,\n        sha256: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join(""),\n        opfsPath:')
    .replace('first: archives[0],', 'hashes: archives.map(a => a.sha256),\n      first: archives[0],')
    .replace('archiveCount: installed.archives.length,', `hashes: await Promise.all(installed.archives.map(async archive => {
          const file = await (await directory.getFileHandle(archive.name)).getFile();
          return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
        })),
        archiveCount: installed.archives.length,`)
    .replace('assert.equal(verified.archiveCount, seeded.archiveCount);', 'assert.deepEqual(verified.hashes, seeded.hashes);\n    assert.equal(verified.archiveCount, seeded.archiveCount);')
    .replace('} finally {\n  await Promise.allSettled([', `} catch (error) {
      for (const client of [sender, receiverA, receiverB].filter(Boolean)) {
        console.error(client.label, await client.page.locator('#transferWindow').innerText());
        console.error(client.label, await client.page.evaluate(async () => {
          const result = [];
          for (const pc of window.__transferConnections) {
            const stats = await pc.getStats();
            result.push({ state: pc.connectionState, ice: pc.iceConnectionState, candidates: [...stats.values()].filter(s => s.type === 'candidate-pair' && s.nominated).map(s=>({state:s.state,bytesReceived:s.bytesReceived,bytesSent:s.bytesSent,localType:stats.get(s.localCandidateId)?.candidateType})) });
          }
          return JSON.stringify({connections:result,iceErrors:[...new Set(window.__transferIceErrors.map(e=>e.code+': '+e.text))]});
        }));
      }
      throw error;
    } finally {\n  await Promise.allSettled([`)
    .replace('await sender.page.locator("#transferStopSend").click();', `const candidateTypes = await receiverA.page.evaluate(async () => {
      const types = [];
      for (const connection of window.__transferConnections) {
        const stats = await connection.getStats();
        stats.forEach(s => { if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated) types.push(stats.get(s.localCandidateId)?.candidateType); });
      }
      return types;
    });
    assert.ok(candidateTypes.length, 'A real WebRTC candidate pair was selected');
    ${forceRelay ? "assert.ok(candidateTypes.every(type => type === 'relay'), 'All file data must use TURN in the forced relay test');" : ''}
    const report = { mode: ${JSON.stringify(mode)}, receivers: 2, archives: seeded.archiveCount, bytesPerReceiver: seeded.totalBytes, fullArchiveHashes: 'passed', mods: 'passed', selectedCandidateTypes: candidateTypes, browserErrors: events.filter(e => e.type === 'pageerror') };
    await (await import('node:fs/promises')).writeFile(${JSON.stringify(path.join(root, '.local', `transfer-${mode}-verification.json`))}, JSON.stringify(report, null, 2));
    await sender.page.locator("#transferStopSend").click();`);
  if (mode === 'public' || (mode.startsWith('remote-relay') && !mode.endsWith('local'))) source = source.replaceAll('window.__cncTestTransferRelayUrls = [url];', '/* Use the shipping public discovery services. */');
  source = source.replace('      bytes.fill((index + 17) & 0xff);', '      bytes.fill((index + 17) & 0xff);\n      await window.__writeFixtureBigHeader(bytes,["data/fixture.bin"]);')
    .replace('    cursorBytes.fill(0x5a);', '    cursorBytes.fill(0x5a);\n    await window.__writeFixtureBigHeader(cursorBytes,["a.cur","b.cur"]);')
    .replace('entryCount: 52,','entryCount: 2,')
    .replace('assert.equal(verified.firstByte, 17);','assert.equal(verified.firstByte, 66);')
    .replace('assert.equal(verified.lastByte, (seeded.archiveCount - 1 + 17) & 0xff);','assert.equal(verified.lastByte, 66);')
    .replace('assert.equal(verified.cursorFirstByte, 0x5a);','assert.equal(verified.cursorFirstByte, 66);')
    .replace('assert.equal(verified.cursorEntryCount, 52);','assert.equal(verified.cursorEntryCount, 2);')
    .replace('    for (let index = 28; index < bytes.length; index += 1) bytes[index] = (index * 13) & 0xff;', '    for (let index = 28; index < bytes.length; index += 1) bytes[index] = (index * 13) & 0xff;\n    await window.__writeFixtureBigHeader(bytes,["data/mod.bin"]);');
  if (mode.includes('single')) {
    source = source
      .replace(/\[receiverA, receiverB\] = await Promise\.all\(\[[\s\S]*?\]\);/, 'receiverA = await openClient("receiver-a", {width:768,height:1024});')
      .replace('await seedSenderMod(receiverB.page);','')
      .replace('startReceiver(receiverB, formattedPin),','')
      .replace(/receiverB\.page\.locator\('\[data-transfer-screen="complete"\]:visible'\)\.waitFor\([^\n]*\),/,'')
      .replace('rows.length === 2','rows.length === 1')
      .replace(/const \[verifiedA, verifiedB\] = await Promise\.all\(\[[\s\S]*?\]\);/,'const verifiedA = await verifyReceiver(receiverA);')
      .replace('[verifiedA, verifiedB]','[verifiedA]')
      .replace('locator(".transfer-peer").count(), 2','locator(".transfer-peer").count(), 1')
      .replaceAll('receivers: 2','receivers: 1')
      .replace('sender-two-receivers.png','sender-one-receiver.png');
  }
  if (mode.includes('retry')) {
    source = source.replace('await openTransferApp(sender.page);', `await sender.page.evaluate(() => {
      window.__transferOriginalSend = RTCDataChannel.prototype.send;
      window.__transferHeldChunks = 0;
      window.__transferHolding = false;
      RTCDataChannel.prototype.send = function(data) {
        if (window.__transferHolding || data?.byteLength > 10000) { window.__transferHolding = true; window.__transferHeldChunks++; return; }
        return window.__transferOriginalSend.call(this,data);
      };
    });
    await openTransferApp(sender.page);`);
    const waitComplete = '  await Promise.all([\n    receiverA.page.locator(\'[data-transfer-screen="complete"]:visible\')';
    source = source.replace(waitComplete, `  await sender.page.waitForFunction(() => window.__transferHeldChunks > 0);
    await receiverA.page.waitForFunction(() => window.ZeroHDeviceTransfer.snapshot().transferring);
    await receiverA.page.evaluate(() => window.__transferConnections.filter(pc => pc.connectionState === 'connected').forEach(pc => pc.close()));
    await sender.page.waitForFunction(() => [...document.querySelectorAll('.transfer-peer')].some(row => /Failed/.test(row.textContent)));
    await receiverA.page.locator('#transferRetryReceive:visible').waitFor();
    await sender.page.evaluate(() => { RTCDataChannel.prototype.send = window.__transferOriginalSend; });
    await receiverA.page.locator('#transferRetryReceive').click();
    console.log('Retried after an interrupted transfer');
${waitComplete}`);
    source = source.replace("fullArchiveHashes: 'passed'", "restartedAfterDisconnect: 'passed', fullArchiveHashes: 'passed'");
  }
  const testFile = path.join(root, '.local', `transfer-${mode}-test.mjs`);
  await fs.writeFile(testFile, source);
  await import(pathToFileURL(testFile).href);
  clearTimeout(deadline);
})().catch(error => { console.error(error); process.exit(1); });
