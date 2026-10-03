// Disposable profiles only. Positive import states below mock the asset boundary;
// these UI checks do not claim game-file compatibility or gameplay validation.
const { chromium } = require(process.env.WINCHESTER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const url = process.env.WINCHESTER_PREVIEW || 'http://localhost:8081/harness/play.html';
const report = { url, checks: [], errors: [], limits: 'Positive import/cache fixtures are synthetic; gameplay is not retested.' };
const output = 'output/playwright';
async function ready(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterTheme);
  await page.locator('#welcomeHeading').waitFor();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const fixture = path.resolve('.local/welcome-incomplete-fixture');
  await fs.mkdir(fixture, { recursive: true });
  await fs.writeFile(path.join(fixture, 'README.txt'), 'Synthetic incomplete folder. No retail data.');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      let choosers = 0;
      let dialogs = 0;
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('filechooser', () => choosers++);
      page.on('dialog', dialog => { dialogs++; void dialog.dismiss(); });
      await ready(page);
      assert.deepEqual(await page.locator('.window.is-open').evaluateAll(nodes => nodes.map(node => node.dataset.app)), ['browser']);
      assert.equal(await page.locator('#toastRegion').innerText(), '');
      assert.equal(await page.locator('[data-open="sanAndreas"], #sanAndreasWindow').count(), 0);
      assert.equal(await page.locator('.desktop-icons [data-launch-game]').isVisible(), false);
      assert.equal(await page.locator('.desktop-icons [data-open="yuri"]').isVisible(), false);
      assert.equal(choosers + dialogs, 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('#browserPage').evaluate(node => node.scrollWidth > node.clientWidth), false);
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
      if (name !== 'small-mobile') await page.screenshot({ path: `${output}/welcome-dark-${name}.png` });
      await page.locator('[data-browser-open-app="settings"]').click();
      await page.locator('#winchesterTheme').selectOption('light');
      await page.locator('#settingsWindow [data-window-action="close"]').click();
      if (name !== 'small-mobile') await page.screenshot({ path: `${output}/welcome-light-${name}.png` });
      await page.locator('[data-browser-open-app="settings"]').click();
      await page.locator('#winchesterTheme').selectOption('dark');
      await page.locator('#settingsWindow [data-window-action="close"]').click();
      assert.equal(await page.locator('.desktop-welcome').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(23, 38, 48)');
      if (name !== 'small-mobile') await page.screenshot({ path: `${output}/welcome-dark-${name}.png` });
      await page.reload();
      await page.locator('#welcomeHeading').waitFor();
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
      await page.locator('[data-browser-open-app="explorer"]').click();
      assert.equal(await page.locator('#explorerWindow').isVisible(), true);
      await page.locator('#explorerWindow [data-window-action="close"]').click();
      await page.locator('[data-browser-open-app="programs"]').click();
      assert.deepEqual(await page.locator('.library-details > strong').allTextContents(), ['Zero Hour', 'Red Alert 2: Yuri’s Revenge']);
      await page.locator('#programsWindow [data-launch-game]').click();
      await page.locator('#folderInput').setInputFiles(fixture);
      await page.locator('#scanTitle').getByText('More original media is required', { exact: true }).waitFor();
      assert.equal(await page.locator('.desktop-icons [data-launch-game]').isVisible(), false);
      assert.equal(await page.locator('[data-wizard-page="1"]').isVisible(), true);
      report.checks.push(`${name}: welcome only at startup, no dialogs, GTA absent, working navigation, dark-theme persistence, rejected incomplete import, no overflow`);
      await context.close();
    }
    // Real UI preparation transitions, with the scanner/preparer mocked explicitly.
    for (const mode of ['once', 'remember', 'install']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await ready(page);
      await page.locator('[data-browser-show-desktop]').click();
      assert.equal(await page.locator('.window.is-open').count(), 0);
      await page.locator('.desktop-icons [data-open="setup"]').click();
      await page.evaluate(() => {
        const library = window.ZeroHAssetLibrary;
        library.sourceHandles = [{ name: 'Synthetic source' }];
        library.pickFolder = async () => [new File(['synthetic'], 'fixture.big')];
        library.scan = async () => ({ ok: true, found: ['fixture.big'], totalBytes: 16, errors: [], missing: [], videoBytes: 0, videoCount: 0 });
        library.prepare = async (requestedMode, progress) => {
          progress({ completed: 1, total: 1, detail: 'Synthetic asset boundary' });
          return { effectiveMode: requestedMode, archives: [{ name: 'fixture.big', bytes: 16 }], videos: [] };
        };
        library.presentationForLibrary = async () => null;
      });
      await page.locator('#pickFolderButton').click();
      await page.locator('[data-wizard-page="2"]').waitFor({ state: 'visible' });
      await page.locator(`input[name="storageMode"][value="${mode}"]`).check();
      await page.locator('#prepareLibraryButton').click();
      await page.locator('[data-wizard-page="3"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.desktop-icons [data-launch-game]').isVisible(), true);
      const metadata = await page.evaluate(() => localStorage.getItem('zeroh-library'));
      assert.equal(Boolean(metadata), mode !== 'once');
      await page.locator('#setupWindow [data-window-action="close"]').click();
      await page.locator('.desktop-icons [data-open="programs"]').click();
      await page.locator('#forgetLibraryButton').click();
      await page.locator('.desktop-icons [data-launch-game]').waitFor({ state: 'hidden' });
      report.checks.push(`Zero Hour ${mode}: shortcut after preparation, correct metadata persistence, shortcut removed on forget (mocked assets)`);
      await context.close();
    }
    // Cache existence/readability is separate from engine validation.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await ready(page);
    const seedCache = async omitted => page.evaluate(async omitted => {
      const manifest = await fetch(new URL('../games/yuris-revenge/winchester-library.json', document.baseURI)).then(response => response.json());
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(manifest.database, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(manifest.store);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(manifest.store, 'readwrite');
          const store = transaction.objectStore(manifest.store);
          store.clear();
          for (const name of manifest.required) if (name !== omitted) store.put(new Blob(['synthetic-cache-gate']), manifest.prefix + name);
          transaction.oncomplete = () => { database.close(); resolve(); };
          transaction.onerror = () => { database.close(); reject(transaction.error); };
        };
      });
    }, omitted);
    await seedCache('gamemd.exe');
    await page.reload();
    await page.locator('#welcomeHeading').waitFor();
    assert.equal(await page.locator('.desktop-icons [data-open="yuri"]').isVisible(), false);
    await seedCache(null);
    await page.reload();
    await page.locator('.desktop-icons [data-open="yuri"]').waitFor({ state: 'visible' });
    report.checks.push('Yuri cache restoration: missing required executable hides shortcut; readable complete manifest restores it (synthetic cache records)');
    await seedCache('gamemd.exe');
    await page.reload();
    await page.locator('#welcomeHeading').waitFor();
    await page.locator('[data-browser-open-app="programs"]').click();
    await page.locator('#programsWindow [data-open="yuri"]').click();
    const frame = page.frameLocator('#yuriFrame');
    await frame.getByRole('button', { name: 'Select folder…', exact: true }).waitFor();
    await frame.locator('input[webkitdirectory]').setInputFiles(fixture);
    await frame.locator('.source-picker-error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.desktop-icons [data-open="yuri"]').isVisible(), false);
    // Reject a fabricated message from the parent, even at the correct origin.
    await page.evaluate(() => window.postMessage({ type: 'winchester:game-files-ready', gameId: 'yr' }, location.origin));
    assert.equal(await page.locator('.desktop-icons [data-open="yuri"]').isVisible(), false);
    // Exercise the trusted-frame boundary independently of executable compatibility.
    const gameFrame = page.frames().find(frame => frame.url().includes('/games/yuris-revenge/'));
    await gameFrame.evaluate(() => parent.postMessage({ type: 'winchester:game-files-ready', gameId: 'ra2' }, location.origin));
    assert.equal(await page.locator('.desktop-icons [data-open="yuri"]').isVisible(), false);
    await gameFrame.evaluate(() => parent.postMessage({ type: 'winchester:game-files-ready', gameId: 'yr' }, location.origin));
    await page.locator('.desktop-icons [data-open="yuri"]').waitFor({ state: 'visible' });
    await page.locator('#yuriWindow [data-window-action="minimize"]').click();
    assert.equal(await page.locator('.desktop-icons [data-open="yuri"]').isVisible(), true);
    await page.locator('.desktop-icons [data-open="yuri"]').click();
    assert.equal(await page.locator('#yuriWindow').isVisible(), true);
    await page.locator('#yuriWindow [data-window-action="close"]').click();
    await page.locator('.desktop-icons [data-open="yuri"]').waitFor({ state: 'hidden' });
    report.checks.push('Yuri: incomplete files rejected, message origin/source/game guard, shortcut after trusted readiness event, minimize retains session, close removes unavailable session shortcut');
    await context.close();
    assert.deepEqual(report.errors, []);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure = error.stack;
    process.exitCode = 1;
  } finally {
    await browser.close();
    await fs.writeFile('.local/welcome-shortcuts-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
