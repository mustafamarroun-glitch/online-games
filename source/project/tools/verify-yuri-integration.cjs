// Acceptance uses disposable browser profiles and intentionally incomplete files.
// This cannot substitute for a player-owned installation and real gameplay.
const { chromium } = require(process.env.WINCHESTER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const url = process.env.WINCHESTER_PREVIEW || 'http://localhost:8081/harness/play.html';
const report = { url, checks: [], pageErrors: [], missing: [], uploads: [], gameplay: 'Pending player installation' };
(async () => {
  await fs.mkdir('output/playwright', { recursive: true });
  const fixture = path.resolve('.local/yuri-incomplete-fixture');
  await fs.mkdir(fixture, { recursive: true });
  await fs.writeFile(path.join(fixture, 'README.txt'), 'Deliberately incomplete, synthetic test directory; contains no game data.');
  const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on('pageerror', error => report.pageErrors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) report.missing.push(`${response.status()} ${response.url()}`); });
      page.on('request', request => { if (request.postData()) report.uploads.push(request.url()); });
      await page.goto(url);
      await page.waitForFunction(() => window.ZeroHDesktop && document.querySelector('.desktop-icons [data-open="yuri"]'));
      const setup = page.locator('#setupWindow');
      if (await setup.isVisible()) await setup.locator('[data-window-action="close"]').click();
      const showDesktop = page.locator('[data-browser-show-desktop]');
      if (await showDesktop.isVisible()) await showDesktop.click();
      await page.locator('.desktop-icons [data-open="programs"]').click();
      await page.locator('#programsWindow [data-open="yuri"]').waitFor({ state: 'visible' });
      if (viewport.width === 1440) await page.screenshot({ path: 'output/playwright/winchester-yuri-library.png' });
      const sentinel = 'winchester-yuri-coexistence-test';
      await page.evaluate(name => caches.open(name), sentinel);
      await page.locator('#programsWindow [data-open="yuri"]').click();
      const frame = page.frameLocator('#yuriFrame');
      await frame.getByRole('button', { name: 'Select folder…', exact: true }).waitFor({ state: 'visible' });
      await page.locator('#yuriStatus').waitFor({ state: 'hidden' });
      const isolated = await frame.locator('body').evaluate(() => crossOriginIsolated);
      assert.equal(isolated, true, 'Embedded runtime must have shared memory available');
      const headingFont = await frame.locator('#source-picker-title').evaluate(node => getComputedStyle(node).fontFamily);
      assert.match(headingFont, /^Tahoma,/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `output/playwright/winchester-yuri-${viewport.width === 1440 ? 'desktop' : 'mobile'}.png` });
      if (viewport.width === 1440) {
        const chooser = page.waitForEvent('filechooser');
        await frame.getByRole('button', { name: 'Select folder…', exact: true }).click();
        await (await chooser).setFiles(fixture);
        await frame.locator('.source-picker-error').waitFor({ state: 'visible' });
        const error = await frame.locator('.source-picker-error').innerText();
        assert.match(error, /gamemd\.exe/);
        assert.match(error, /ra2md\.mix/);
        assert.match(error, /Select your installed game folder containing these files/);
        assert.ok(error.split('\n').length >= 4, 'Missing resources must be grouped on separate lines');
        assert.equal(await frame.getByRole('button', { name: 'Select folder…', exact: true }).isEnabled(), true);
        await page.screenshot({ path: 'output/playwright/winchester-yuri-missing-files.png' });
        await page.locator('#yuriWindow [data-window-action="minimize"]').click();
        assert.equal(await page.locator('#yuriFrame').getAttribute('src') !== null, true);
        await page.evaluate(() => window.ZeroHDesktop.openApp('yuri'));
        await page.locator('#yuriWindow [data-window-action="maximize"]').click();
        await page.locator('#yuriWindow [data-window-action="close"]').click();
        await page.waitForFunction(() => !document.querySelector('#yuriFrame').hasAttribute('src'));
        await page.locator('#startButton').click();
        await page.locator('#startMenu [data-open="yuri"]').click();
        await frame.getByRole('button', { name: 'Select files…', exact: true }).waitFor({ state: 'visible' });
        assert.ok((await page.evaluate(() => caches.keys())).includes(sentinel), 'Engine must preserve host caches');
        const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map(registration => registration.scope));
        assert.equal(registrations.some(scope => scope.includes('/games/yuris-revenge/')), false);
        report.checks.push('Library, desktop, Start; minimize preserves frame; close unloads; reopen works; incomplete imports identify required files; host caches preserved');
      }
      report.checks.push(`${viewport.width}px: picker visible, Tahoma headings, shared memory available, no outer page overflow`);
      await context.close();
    }
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.missing, []);
    assert.deepEqual(report.uploads, []);
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser.close();
    await fs.writeFile(process.env.YURI_REPORT || '.local/yuri-integration-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
