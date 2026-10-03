// Isolated browser contexts only: never reset the owner's browser profile.
const { chromium } = require(process.env.WINCHESTER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const url = process.env.WINCHESTER_PREVIEW || 'http://127.0.0.1:8085/harness/play.html';
const output = 'output/playwright';
const report = { url, checks: [], errors: [] };

(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push({ name, message: error.message }));
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterTheme);
      assert.equal(await page.locator('.ownership-help').count(), 0);
      if (await page.locator('#setupWindow').isVisible()) await page.locator('#setupWindow [data-window-action="close"]').click();
      if (await page.locator('#browserWindow').isVisible()) await page.locator('#browserWindow [data-window-action="close"]').click();
      await page.evaluate(() => window.ZeroHDesktop.openApp('settings'));
      assert.equal(await page.locator('#appearancePanel #resetConceptButton').count(), 0);
      assert.equal(await page.locator('.settings-nav #resetTab').count(), 1);
      assert.equal(await page.locator('#winchesterTheme').inputValue(), 'dark');
      await page.locator('#winchesterTheme').selectOption('light');
      if (name !== 'small-mobile') await page.screenshot({ path: `${output}/settings-light-${name}.png` });
      await page.locator('#winchesterTheme').selectOption('dark');
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
      assert.equal(await page.locator('#appearancePanel').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(23, 38, 48)');
      if (name !== 'small-mobile') await page.screenshot({ path: `${output}/settings-dark-${name}.png` });
      for (const section of ['game', 'experimental', 'multiplayer', 'hardware', 'privacy', 'reset', 'appearance']) {
        await page.locator(`[data-settings-tab="${section}"]`).click();
        assert.equal(await page.locator(`[data-settings-panel="${section}"]`).isVisible(), true);
      }
      // The established accent choices work independently from surface theme.
      for (const accent of ['classic', 'silver', 'ocean']) {
        await page.locator('#winchesterAccent').selectOption(accent);
        assert.equal(await page.locator('#desktop').getAttribute('data-winchester-accent'), accent);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterTheme === 'dark');
      if (await page.locator('#setupWindow').isVisible()) await page.locator('#setupWindow [data-window-action="close"]').click();
      if (await page.locator('#browserWindow').isVisible()) await page.locator('#browserWindow [data-window-action="close"]').click();
      await page.evaluate(() => window.ZeroHDesktop.openApp('settings'));
      assert.equal(await page.locator('#winchesterTheme').inputValue(), 'dark');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('#appearancePanel').evaluate(el => el.scrollWidth > el.clientWidth + 1), false);
      await page.locator('#winchesterTheme').focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await page.locator('#winchesterTheme').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');

      if (name === 'desktop') {
        await page.locator('#resetTab').click();
        await page.screenshot({ path: `${output}/settings-reset-desktop.png` });
        await page.locator('#settingsWindow [data-window-action="close"]').click();
        for (const app of ['setup', 'programs', 'explorer', 'browser']) {
          await page.evaluate(app => window.ZeroHDesktop.openApp(app), app);
          await page.screenshot({ path: `${output}/theme-dark-${app}.png` });
          await page.locator(`.window[data-app="${app}"] [data-window-action="close"]`).click();
        }
        await page.locator('#startButton').click();
        await page.screenshot({ path: `${output}/theme-dark-start.png` });
        await page.locator('#startButton').click();
      }

      // Deliberately use a synthetic note in this disposable context.
      await page.evaluate(() => {
        const drive = window.ZeroHApps.getFileSystem();
        drive.nodes.push({ id: 'ui-reset-test', parent: 'notes', type: 'file', kind: 'text', name: 'Reset test.txt', content: 'KEEP UNTIL CONFIRMED', size: 20 });
        localStorage.setItem('zeroh-filesystem-v1', JSON.stringify(drive));
        localStorage.setItem('ui-unrelated-sentinel', 'KEEP');
      });
      await page.evaluate(() => window.ZeroHDesktop.openSettingsPanel('reset'));
      const before = await page.evaluate(() => ({ preferences: localStorage.getItem('winchester-preferences-v2'), files: localStorage.getItem('zeroh-filesystem-v1') }));
      page.once('dialog', dialog => dialog.dismiss());
      await page.locator('#resetConceptButton').click();
      assert.deepEqual(await page.evaluate(() => ({ preferences: localStorage.getItem('winchester-preferences-v2'), files: localStorage.getItem('zeroh-filesystem-v1') })), before);
      page.once('dialog', dialog => dialog.accept());
      await page.locator('#resetConceptButton').click();
      await page.waitForFunction(() => !window.ZeroHApps.getFileSystem().nodes.some(node => node.id === 'ui-reset-test'));
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
      assert.equal(await page.evaluate(() => window.ZeroHApps.getFileSystem().nodes.some(node => node.id === 'ui-reset-test')), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('ui-unrelated-sentinel')), 'KEEP');
      await page.locator('#appearanceTab').click();
      assert.equal(await page.locator('#winchesterTheme').inputValue(), 'dark');
      await page.locator('#winchesterTheme').selectOption('dark');
      await page.locator('#winchesterTheme').selectOption('light');
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'light');
      report.checks.push({ name, width, themePersists: true, allSettingsTabs: true, accentIndependent: true, keyboardFocus: true, resetCancelPreservesData: true, confirmedResetClearsSyntheticNote: true, noHorizontalOverflow: true });
      await context.close();
    }
    assert.deepEqual(report.errors, []);
    await fs.writeFile('.local/settings-theme-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
