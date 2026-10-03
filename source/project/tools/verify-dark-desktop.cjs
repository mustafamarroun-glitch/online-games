// Disposable browser profiles: never modify the owner's installed game data.
const { chromium } = require(process.env.WINCHESTER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const url = process.env.WINCHESTER_PREVIEW || 'http://localhost:8081/harness/play.html';
const report = { url, checks: [], errors: [], missing: [] };
async function startup(page) {
  await page.goto(url);
  await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktopThemeToggle')?.title);
  await page.locator('#welcomeHeading').waitFor();
}
async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  for (const selector of ['#browserPage', '#appearancePanel']) {
    assert.equal(await page.locator(selector).evaluate(node => node.scrollWidth > node.clientWidth + 1), false);
  }
}
async function contrast(page, selector) {
  const ratio = await page.locator(selector).evaluate(node => {
    const channels = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
      value /= 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    const luminance = value => {
      const [r, g, b] = channels(value);
      return .2126 * r + .7152 * g + .0722 * b;
    };
    const foreground = getComputedStyle(node).color;
    let background = getComputedStyle(node).backgroundColor;
    let ancestor = node;
    while (background === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) {
      ancestor = ancestor.parentElement;
      background = getComputedStyle(ancestor).backgroundColor;
    }
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  assert.ok(ratio >= 4.5, `${selector}: text contrast ${ratio.toFixed(2)} must be at least 4.5`);
  return Number(ratio.toFixed(2));
}
(async () => {
  await fs.mkdir('output/playwright', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 740]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      page.on('response', response => { if (response.status() >= 400) report.missing.push(`${response.status()} ${response.url()}`); });
      await startup(page);
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
      assert.equal(await page.locator('#desktop').getAttribute('data-wallpaper'), 'flow');
      assert.equal(await page.locator('.welcome-landscape').count(), 0);
      assert.deepEqual(await page.locator('[data-set-wallpaper]').evaluateAll(nodes => nodes.map(node => node.dataset.setWallpaper)), ['flow', 'hills']);
      const ratios = {};
      for (const selector of ['.welcome-intro', '.welcome-hint', '.welcome-library', '.welcome-links button:first-child', '.welcome-footer']) ratios[selector] = await contrast(page, selector);
      await noOverflow(page);
      if (name !== 'small-mobile') await page.screenshot({ path: `output/playwright/dark-refresh-welcome-${name}.png` });
      await page.locator('[data-browser-show-desktop]').click();
      const toggle = page.locator('#desktopThemeToggle');
      assert.equal(await toggle.isVisible(), true);
      await page.keyboard.press('Tab');
      await toggle.focus();
      assert.notEqual(await toggle.evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await toggle.press('Enter');
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'light');
      assert.equal(await toggle.getAttribute('aria-label'), 'Switch to dark theme');
      await page.reload();
      await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktopThemeToggle')?.title);
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'light');
      await page.locator('[data-browser-open-app="settings"]').click();
      assert.equal(await page.locator('#winchesterTheme').inputValue(), 'light');
      await page.locator('[data-set-wallpaper="hills"]').click();
      assert.equal(await page.locator('[data-set-wallpaper="hills"]').getAttribute('aria-pressed'), 'true');
      await page.locator('#winchesterTheme').selectOption('dark');
      assert.equal(await toggle.getAttribute('aria-label'), 'Switch to light theme');
      assert.equal(await page.locator('.wallpaper-choice img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), true);
      await noOverflow(page);
      if (name !== 'small-mobile') await page.screenshot({ path: `output/playwright/dark-refresh-settings-${name}.png` });
      await page.reload();
      await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktopThemeToggle')?.title);
      assert.equal(await page.locator('#desktop').getAttribute('data-wallpaper'), 'hills');
      assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
      await page.locator('[data-browser-show-desktop]').click();
      if (name === 'desktop') await page.screenshot({ path: 'output/playwright/dark-refresh-hills-desktop.png' });
      await page.locator('.desktop-icons [data-open="settings"]').click();
      await page.locator('[data-set-wallpaper="flow"]').click();
      await page.locator('#settingsWindow [data-window-action="close"]').click();
      if (name !== 'small-mobile') await page.screenshot({ path: `output/playwright/dark-refresh-desktop-${name}.png` });
      assert.match(await page.locator('.wallpaper-art').evaluate(node => getComputedStyle(node).backgroundImage), /flow\.webp/);
      report.checks.push({ name, darkStartup: true, keyboardToggle: true, themePersists: true, settingsSync: true, wallpapersLoadAndPersist: true, noFillerPictureStrip: true, noOverflow: true, textContrast: ratios });
      await context.close();
    }
    // Existing preferences adopt the new dark default once, preserving other fields.
    const context = await browser.newContext();
    await context.addInitScript(() => {
      if (!sessionStorage.getItem('migration-fixture')) {
        localStorage.setItem('winchester-preferences-v2', JSON.stringify({ displayName: 'Player', accent: 'silver', mode: 'full', theme: 'light' }));
        localStorage.setItem('zeroh-settings', JSON.stringify({ wallpaper: 'dusk', scale: '1', sound: false, reduceMotion: true }));
        localStorage.setItem('unrelated-library-sentinel', 'KEEP');
        sessionStorage.setItem('migration-fixture', '1');
      }
    });
    const page = await context.newPage();
    await startup(page);
    const snapshot = await page.evaluate(() => ({ personal: JSON.parse(localStorage.getItem('winchester-preferences-v2')), settings: JSON.parse(localStorage.getItem('zeroh-settings')), sentinel: localStorage.getItem('unrelated-library-sentinel') }));
    assert.deepEqual(snapshot.personal, { displayName: 'Player', accent: 'silver', mode: 'full', theme: 'dark', appearanceVersion: 3 });
    assert.equal(snapshot.settings.wallpaper, 'flow');
    assert.equal(snapshot.settings.reduceMotion, true);
    assert.equal(snapshot.sentinel, 'KEEP');
    await page.reload();
    await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktopThemeToggle')?.title);
    assert.equal(await page.locator('#desktop').getAttribute('data-winchester-theme'), 'dark');
    report.checks.push('One-time appearance migration preserves name, accent, desktop mode, motion preference, and unrelated storage');
    await context.close();
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.missing, []);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.failure = error.stack;
    process.exitCode = 1;
  } finally {
    await browser.close();
    await fs.writeFile('.local/dark-desktop-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
