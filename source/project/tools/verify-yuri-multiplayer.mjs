// Synthetic transport acceptance, explicitly separate from a real Yuri match.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, '.local/ra2-vm/source/package.json'));
const { chromium } = require('@playwright/test');
const { build } = createRequire(resolve(root, '.local/ra2-vm/source/packages/relay/package.json'))('esbuild');
const executablePath = process.env.WINCHESTER_BROWSER_EXECUTABLE || chromium.executablePath();
await access(executablePath).catch(() => { throw new Error('Install the pinned Playwright Chromium or set WINCHESTER_BROWSER_EXECUTABLE to an installed Chromium executable.'); });
const bundle = await build({ absWorkingDir: resolve(root, '.local/ra2-vm/source/packages/relay'), entryPoints: ['./src/client/index.ts'], bundle: true, platform: 'browser', target: 'es2022', format: 'iife', globalName: 'YuriRelay', write: false });
const local = process.argv.includes('--local');
let service;
let state;
if (local) {
  const socket = createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const room = 'yuri-' + randomBytes(12).toString('hex');
  const publicUrl = `http://127.0.0.1:${port}`;
  const address = `127.0.0.1:${port}/${room}`;
  state = { publicUrl, gameUrl: `${publicUrl}/play/?network=1&relay=${encodeURIComponent(address)}`, relayUrl: 'ws://' + address };
  service = spawn(process.execPath, ['tools/serve-yuri-multiplayer.mjs', '--port', String(port), '--room', room], { cwd: root, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let serviceError = '';
  service.stderr.on('data', data => { serviceError += data; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (service.exitCode !== null) throw new Error('Local relay exited: ' + serviceError);
    try { if ((await fetch(publicUrl + '/healthz')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!ready) { service.kill(); throw new Error('Local relay failed to start.'); }
} else state = JSON.parse(await readFile(resolve(root, '.local/yuri-multiplayer/session.json'), 'utf8'));
const report = { kind: `Synthetic ${local ? 'loopback' : 'public'} relay and browser acceptance; no game simulation`, url: state.gameUrl, checks: [], errors: [], gameplay: 'Separate real-game test required' };
async function httpCheck(path, options) {
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(state.publicUrl + path, { ...options, signal: AbortSignal.timeout(10000) }); }
    catch (error) {
      if (attempt === 2) throw error;
      (report.httpRetries ??= []).push({ path, attempt: attempt + 1, error: String(error) });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
await mkdir(resolve(root, 'output/playwright'), { recursive: true });
let browser;
const contexts = [];
try {
  browser = await chromium.launch({ headless: true, executablePath });
  const pages = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(state.gameUrl);
    await page.getByRole('button', { name: 'Select folder…', exact: true }).waitFor();
    assert.equal(await page.locator('#relay-address').inputValue(), new URL(state.relayUrl).host + new URL(state.relayUrl).pathname);
    assert.equal(await page.evaluate(() => crossOriginIsolated), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: resolve(root, `output/playwright/yuri-multiplayer-${width}.png`) });
    report.checks.push(`${width}px ${local ? 'loopback' : 'public'} game page: preconfigured relay, shared-memory isolation, no page overflow`);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.evaluate(url => {
      window.relayObservation = { ready: false, peers: [], received: [], closed: false, latency: null };
      const o = window.relayObservation;
      window.testRelay = new YuriRelay.RelayClient({ url, compatibilityHash: 'a'.repeat(64), metadata: new Uint8Array([1]), handshakeTimeoutMs: 20000 }, {
        onReady: self => { o.ready = true; o.address = self.addr; },
        onPeerJoin: peer => o.peers.push(peer.addr),
        onDatagram: (src, srcPort, destPort, bytes) => o.received.push({ src, srcPort, destPort, bytes: Array.from(bytes) }),
        onLatency: rtt => o.latency = rtt,
        onClose: reason => { o.closed = true; o.closeReason = reason; },
        onError: error => { o.error = String(error); },
      });
    }, state.relayUrl);
    await page.waitForFunction(() => window.relayObservation.ready, null, { timeout: 30000 });
    pages.push(page);
  }
  for (const page of pages) await page.waitForFunction(() => window.relayObservation.peers.length === 1);
  const addressA = await pages[0].evaluate(() => window.relayObservation.address);
  const addressB = await pages[1].evaluate(() => window.relayObservation.address);
  assert.notEqual(addressA, addressB);
  for (const [index, address] of [[0, addressB], [1, addressA]]) {
    assert.equal(await pages[index].evaluate(address => window.testRelay.sendDatagram(address, 4001, 4000, Uint8Array.from({ length: 4096 }, (_, i) => i % 251)), address), true);
  }
  for (const [index, address] of [[0, addressB], [1, addressA]]) {
    await pages[index].waitForFunction(() => window.relayObservation.received.length === 1);
    const received = await pages[index].evaluate(() => window.relayObservation.received[0]);
    assert.equal(received.src, address);
    assert.deepEqual(received.bytes, Array.from({ length: 4096 }, (_, i) => i % 251));
    await pages[index].waitForFunction(() => window.relayObservation.latency !== null);
  }
  report.checks.push(`Two independent browsers discover each other through ${local ? 'loopback WS' : 'public WSS'} and exchange intact 4096-byte payloads in both directions; heartbeat RTT observed`);
  const mismatch = await contexts[0].newPage();
  await mismatch.goto(state.gameUrl);
  await mismatch.addScriptTag({ content: bundle.outputFiles[0].text });
  await mismatch.evaluate(url => {
    window.mismatchResult = {};
    window.testRelay = new YuriRelay.RelayClient({ url, compatibilityHash: 'b'.repeat(64) }, { onReady: () => { window.mismatchResult.ready = true; }, onClose: reason => { window.mismatchResult.closed = reason; } });
  }, state.relayUrl);
  await mismatch.waitForFunction(() => window.mismatchResult.closed);
  assert.equal(await mismatch.evaluate(() => !!window.mismatchResult.ready), false);
  report.checks.push('Mismatching executable compatibility is rejected before room membership');
  for (const endpoint of ['/game/gamemd.exe', '/.local/yuri-multiplayer/session.json', '/play/../../../YURIS_REVENGE.md', '/play/gamemd.exe', '/relay/relay.cjs']) {
    assert.equal((await httpCheck(endpoint)).status, 404);
  }
  assert.equal((await httpCheck('/play/', { method: 'POST', body: 'synthetic upload rejection check' })).status, 405);
  assert.equal((await httpCheck('/relay/Yuri-relay-source.zip')).status, 200);
  report.checks.push('Retail files, local session state and unlisted paths unavailable; upload methods rejected; corresponding relay source downloadable');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
finally {
  for (const context of contexts) await context.close();
  await browser?.close();
  if (service) service.kill();
  await writeFile(resolve(root, `.local/yuri-multiplayer${local ? '-local' : ''}-verification.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
