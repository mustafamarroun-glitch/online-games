const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
(async () => {
  const relay = process.env.TRANSFER_TEST_CONFIG
    ? JSON.parse(await fs.readFile(process.env.TRANSFER_TEST_CONFIG,'utf8')).iceServers[0]
    : {urls:['turn:127.0.0.1:13478?transport=tcp'],username:'transfer-test',credential:'transfer-test-password'};
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  // Deterministic network-configuration fixtures must bypass the isolation worker.
  // Actual worker isolation is covered separately by verify-v3-browser.cjs.
  await context.route('**/coi-direct.js', route => route.fulfill({contentType:'text/javascript',body:'// Recovery test fixture; engine is not launched.'}));
  const errors = [];
  const page = await context.newPage();
  await page.route('**/device-transfer-network.json', route => route.fulfill({json:{iceServers:[],credentialEndpoint:null}}));
  page.on('pageerror', e => errors.push(e.message));
  const configuredPreview = process.env.TRANSFER_PREVIEW || 'http://localhost:8091/harness/play.html';
  const preview = configuredPreview.includes('/harness/play.html') ? configuredPreview : new URL('launcher.html',configuredPreview).href;
  async function open() {
    await page.goto(preview);
    await page.waitForFunction(() => window.ZeroHDeviceTransfer);
    await page.locator('#setupWindow [data-window-action="close"]').click();
    await page.locator('#startButton').click();
    await page.locator('#startMenu [data-open="transfer"]').click();
  }
  async function receive() {
    await page.locator('#transferChooseReceive').click();
    await page.locator('#transferReceiveOwnership').check();
    await page.locator('#transferReceiveNext').click();
    await page.locator('#transferPinInput').fill('1111 2222 3333');
    await page.locator('#transferConnect').click();
  }
  try {
    await open();
    await page.locator('#transferNetworkSettings summary').click();
    await page.locator('#transferRelayUrl').fill(Array.isArray(relay.urls) ? relay.urls.join('\n') : relay.urls);
    await page.locator('#transferRelayUser').fill(relay.username);
    await page.locator('#transferRelayPassword').fill(relay.credential);
    await page.locator('#transferRelayTest').click();
    await page.waitForFunction(() => document.querySelector('#transferNetworkStatus').textContent.startsWith('Relay responded'), null, { timeout: 20000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#transferRelayUser').evaluate(e => e.style.visibility = 'hidden');
    await page.screenshot({ path: 'output/playwright/transfer-mobile-relay-settings.png' });
    await open();
    assert.equal(await page.locator('#transferRelayUser').inputValue(), relay.username);
    await page.locator('#transferNetworkSettings summary').click();
    await page.locator('#transferRelayClear').click();
    assert.equal(await page.locator('#transferRelayPassword').inputValue(), '');
    await page.locator('#transferRelayTest').click();
    await page.waitForFunction(() => !document.querySelector('#transferRelayTest').disabled);
    assert.match(await page.locator('#transferNetworkStatus').textContent(), /Add a TURN relay/);
    await page.locator('#transferNetworkSettings summary').click();
    await page.clock.install();
    await receive();
    await page.waitForFunction(() => window.ZeroHDeviceTransfer.snapshot().mode === 'receiver');
    await page.clock.fastForward(61000);
    await page.locator('#transferLiveError:visible').waitFor();
    assert.match(await page.locator('#transferLiveError').textContent(), /same Wi-Fi|internet relay/);
    assert.equal(await page.locator('#transferReceiveTitle').textContent(), 'Could not connect to your device');
    await page.screenshot({ path: 'output/playwright/transfer-mobile-recovery.png' });
    await page.locator('#transferRetryReceive').click();
    await page.locator('#transferLiveError').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => window.ZeroHDeviceTransfer.snapshot().mode === 'receiver');
    assert.equal(await page.locator('#transferLiveError').isVisible(), false);
    await page.locator('#transferCancelReceive').click();
    await page.waitForFunction(() => window.ZeroHDeviceTransfer.snapshot().mode === null);
    assert.equal((await page.evaluate(() => window.ZeroHDeviceTransfer.snapshot())).pinActive, false);

    let release;
    let fetched;
    const reached = new Promise(resolve => { fetched = resolve; });
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/device-transfer-network.json', async route => {
      fetched();
      await held;
      await route.fulfill({ json: { iceServers: [], credentialEndpoint: null } }).catch(() => {});
    });
    await page.locator('[data-transfer-back="choose"]:visible').click();
    await receive();
    await reached;
    await page.locator('#transferCancelReceive').click();
    release();
    await page.waitForFunction(() => window.ZeroHDeviceTransfer.snapshot().mode === null);
    await page.clock.fastForward(61000);
    assert.equal((await page.evaluate(() => window.ZeroHDeviceTransfer.snapshot())).pinActive, false);
    assert.equal(await page.locator('#transferLiveError').isVisible(), false);
    assert.deepEqual(errors, []);
    const report = { realTurnAllocation: 'passed', mobileWidth: 390, tabSettingsPersistAcrossReload: 'passed', clearCredentials: 'passed', connectionTimeout: 'passed', retry: 'passed', cancelDuringSetup: 'passed', browserErrors: errors };
    await fs.writeFile('.local/transfer-recovery-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
