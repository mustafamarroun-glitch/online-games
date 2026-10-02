const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const preview = process.env.TRANSFER_PREVIEW || 'http://localhost:8091/harness/play.html';
  const config = process.env.TRANSFER_TEST_CONFIG
    ? JSON.parse(await fs.readFile(process.env.TRANSFER_TEST_CONFIG,'utf8'))
    : await (await fetch(new URL(preview.endsWith('.html') ? './device-transfer-network.json' : './harness/device-transfer-network.json',preview))).json();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (process.env.TRANSFER_TEST_CONFIG) await page.route('**/device-transfer-network.json', route => route.fulfill({json: config}));
  try {
    await page.goto(preview);
    await page.waitForFunction(() => window.ZeroHDeviceTransfer);
    await page.locator('#setupWindow [data-window-action="close"]').click();
    await page.locator('#startButton').click();
    await page.locator('#startMenu [data-open="transfer"]').click();
    await page.locator('#transferNetworkSettings summary').click();
    await page.waitForFunction(() => document.querySelector('#transferNetworkStatus').textContent.startsWith('Internet relay configured'));
    assert.equal(await page.locator('#transferRelayPassword').inputValue(), '');
    const allocations = await page.evaluate(async servers => {
      const results = [];
      for (const server of servers) for (const url of server.urls) {
        const pc = new RTCPeerConnection({iceTransportPolicy:'relay',iceServers:[{...server,urls:url}]});
        const errors = [];
        pc.onicecandidateerror = e => errors.push({code:e.errorCode,text:e.errorText});
        try {
          const result = await new Promise(async resolve => {
            const timer = setTimeout(() => resolve({ok:false,errors}),15000);
            pc.onicecandidate = e => {
              if (e.candidate?.type === 'relay') {clearTimeout(timer);resolve({ok:true,protocol:e.candidate.protocol});}
              else if (!e.candidate) {clearTimeout(timer);resolve({ok:false,errors});}
            };
            pc.createDataChannel('test');
            await pc.setLocalDescription(await pc.createOffer());
          });
          results.push({url,...result});
        } finally {pc.close();}
      }
      return results;
    },config.iceServers);
    console.log(JSON.stringify({allocations,browserErrors:errors},null,2));
    const allocated = allocations.some(result => result.ok);
    await page.locator('#transferRelayTest').click();
    await page.waitForFunction(() => !document.querySelector('#transferRelayTest').disabled,null,{timeout:20000});
    assert.match(await page.locator('#transferNetworkStatus').textContent(), allocated ? /Website relay responded/ : /Relay (connection failed|did not respond)/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:'output/playwright/transfer-website-relay-mobile.png'});
    assert.deepEqual(errors,[]);
    await fs.writeFile('.local/transfer-website-relay-verification.json',JSON.stringify({allocations,websiteRelayTest:allocated ? 'passed' : 'failed',connectionSettingsUi:'passed',manualCredentialsRequired:false,mobileWidth:390,browserErrors:errors},null,2));
    assert.ok(allocated,'The remote relay must allocate a candidate');
  } finally {await context.close();await browser.close();}
})().catch(e => {console.error(e);process.exitCode=1;});
