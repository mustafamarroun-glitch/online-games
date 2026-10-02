// Integration evidence through the shipping desktop. Isolated browser contexts:
// never open the user's browser profile or clear their installed game data.
const { chromium } = require(process.env.WINCHESTER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const url = process.env.WINCHESTER_PREVIEW || 'http://localhost:8081/harness/play.html';
const output = path.resolve('output/playwright');
const results = [];
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const diagnostics = await context.newCDPSession(page);
    diagnostics.on('Runtime.exceptionThrown', event => console.error(JSON.stringify(event.exceptionDetails)));
    await diagnostics.send('Runtime.enable');
    const errors = [];
    const missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() === 404 && response.url().startsWith(new URL(url).origin)) missing.push(response.url()); });
    await page.goto(url);
    await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterMode, null, { timeout: 15000 }).catch(async error => {
      console.error(JSON.stringify({ errors, missing, state: await page.evaluate(() => ({ desktop: Boolean(window.ZeroHDesktop), apps: Boolean(window.ZeroHApps), title: document.title })) }, null, 2));
      await page.screenshot({ path: path.join(output, 'winchester-v2-diagnostic.png') });
      throw error;
    });
    await page.locator('#setupWindow [data-window-action="close"]').click();
    assert.equal(await page.title(), 'Winchester OS · Home Edition');
    assert.equal(await page.locator('#desktop').getAttribute('data-wallpaper'), 'winchester');
    assert.equal(await page.locator('.desktop-icons [data-open="mods"]').isVisible(), false);
    await page.screenshot({ path: path.join(output, 'winchester-v2-desktop.png') });
    results.push('Branded desktop, Home wallpaper, simple shortcuts');
    await page.locator('.desktop-icons [data-open="settings"]').click();
    await page.locator('#winchesterName').fill('Mustafa');
    await page.locator('#winchesterProfileForm button').click();
    await page.locator('#winchesterAccent').selectOption('classic');
    await page.locator('#winchesterDesktopMode').selectOption('full');
    assert.equal(await page.locator('.desktop-icons [data-open="mods"]').isVisible(), true);
    await page.reload();
    await page.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterMode);
    assert.equal(await page.locator('#desktop').getAttribute('data-winchester-accent'), 'classic');
    assert.equal(await page.locator('#winchesterName').inputValue(), 'Mustafa');
    assert.equal(await page.locator('#desktop').getAttribute('data-winchester-mode'), 'full');
    await page.locator('#setupWindow [data-window-action="close"]').click();
    await page.locator('#startButton').click();
    assert.equal(await page.locator('[data-winchester-name]').textContent(), 'Mustafa');
    assert.equal(await page.locator('#startMenu [data-open="llmAi"]').isVisible(), true);
    await page.screenshot({ path: path.join(output, 'winchester-v2-start.png') });
    await page.locator('#startMenu [data-open="notepad"]').click();
    const note = page.locator('#notepadWindow');
    const original = await note.boundingBox();
    const bar = await note.locator('.titlebar').boundingBox();
    await page.mouse.move(bar.x + 100, bar.y + 15);
    await page.mouse.down(); await page.mouse.move(bar.x + 180, bar.y + 60, { steps: 8 }); await page.mouse.up();
    const moved = await note.boundingBox();
    assert.ok(Math.abs(moved.x - original.x) > 25, 'Notepad moves when dragged');
    await note.locator('[data-window-action="maximize"]').click();
    assert.ok((await note.boundingBox()).width > moved.width);
    await note.locator('[data-window-action="minimize"]').click();
    assert.equal(await note.isVisible(), false);
    await page.locator('.task-button[data-app="notepad"]').click();
    assert.equal(await note.isVisible(), true);
    await note.locator('[data-window-action="close"]').click();
    results.push('Name, color, full shortcuts persist; advanced apps remain in Start; drag/maximize/minimize/restore work');
    await page.locator('.desktop-icons [data-open="settings"]').click();
    await page.locator('#winchesterAccent').selectOption('ocean');
    await page.locator('#winchesterDesktopMode').selectOption('simple');
    await page.screenshot({ path: path.join(output, 'winchester-v2-settings.png') });
    await page.locator('#settingsWindow [data-window-action="close"]').click();
    await page.locator('.desktop-icons [data-open="browser"]').click();
    await page.locator('#browserAddress').fill('newshoes://status');
    await page.locator('#browserAddressForm button').click();
    assert.equal(await page.locator('#browserAddress').inputValue(), 'winchester://status');
    assert.ok((await page.locator('#browserPage').textContent()).includes('NOT INSTALLED'));
    assert.ok((await page.locator('#browserPage').textContent()).includes('TESTING PENDING'));
    await page.screenshot({ path: path.join(output, 'winchester-v2-status.png') });
    results.push('Legacy intranet addresses resolve; system status reports actual library state and pending multiplayer');
    await context.close();

    const migrated = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await migrated.addInitScript(() => {
      if (localStorage.getItem('qa-seeded')) return;
      localStorage.setItem('qa-seeded', '1');
      localStorage.setItem('zeroh-filesystem-v1', JSON.stringify({ version: 3, nodes: [
        { id: 'root', parent: null, type: 'folder', name: 'New Shoes Drive' },
        { id: 'notes', parent: 'root', type: 'folder', name: 'Notes' },
        { id: 'note-1', parent: 'notes', type: 'file', kind: 'text', name: 'Welcome to Project New Shoes.txt', content: 'MY CUSTOM NOTE', size: 14 },
        { id: 'personal', parent: 'notes', type: 'file', kind: 'text', name: 'Personal.txt', content: 'KEEP THIS', size: 9 }
      ] }));
      localStorage.setItem('zeroh-settings', JSON.stringify({ wallpaper: 'dusk', scale: '1.1', sound: false, reduceMotion: true }));
      localStorage.setItem('zeroh-v2-sentinel', 'KEEP');
    });
    const migration = await migrated.newPage();
    await migration.goto(url);
    await migration.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterMode);
    const state = await migration.evaluate(() => ({ fs: JSON.parse(localStorage.getItem('zeroh-filesystem-v1')), settings: JSON.parse(localStorage.getItem('zeroh-settings')), sentinel: localStorage.getItem('zeroh-v2-sentinel') }));
    assert.equal(state.fs.nodes.find(n => n.id === 'root').name, 'Winchester Drive');
    assert.equal(state.fs.nodes.find(n => n.id === 'note-1').content, 'MY CUSTOM NOTE');
    assert.equal(state.fs.nodes.find(n => n.id === 'personal').content, 'KEEP THIS');
    assert.equal(state.settings.wallpaper, 'dusk');
    assert.equal(state.settings.scale, '1.1');
    assert.equal(state.sentinel, 'KEEP');
    await migrated.close();
    results.push('V1 drive migration preserves edited welcome notes, personal files, wallpaper/scale, and unrelated storage');

    const compact = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobile = await compact.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(url);
    await mobile.waitForFunction(() => window.ZeroHApps && document.querySelector('#desktop').dataset.winchesterMode);
    await mobile.locator('#setupWindow [data-window-action="close"]').click();
    await mobile.locator('.desktop-icons [data-open="settings"]').click();
    await mobile.locator('#winchesterName').fill('Winchester');
    await mobile.locator('#winchesterProfileForm button').click();
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'Compact layout fits viewport');
    await mobile.screenshot({ path: path.join(output, 'winchester-v2-mobile.png') });
    await compact.close();
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    assert.deepEqual(missing, [], 'No local 404s');
    results.push('390px touch settings fit; no browser exceptions or local missing resources');
    const report = { date: '2026-10-02', url, results, errors, missing, scope: 'Desktop identity and UI regression. Engine bytes unchanged; gameplay and multiplayer are separate acceptance gates.' };
    await fs.writeFile(process.env.WINCHESTER_REPORT || '.local/winchester-v2-ui-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
