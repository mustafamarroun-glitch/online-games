// Synthetic resource names exercise backup/restore discovery without launching
// or claiming compatibility for a fabricated game executable.
const { chromium } = require(process.env.WINCHESTER_PLAYWRIGHT || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const url = process.env.WINCHESTER_PREVIEW || 'http://localhost:8081/harness/play.html';
const report = { url, checks: [], pageErrors: [], uploads: [], gameplay: 'Not tested; synthetic backup fixture' };

(async () => {
  const { buildFileZip, buildArchiveZip } = await import('../overrides/harness/launcher-backup-zip.mjs');
  for (const entries of [[], [{ name: '../escape.exe', file: new Blob() }],
    [{ name: '/root.mix', file: new Blob() }], [{ name: 'C:/file', file: new Blob() }],
    [{ name: 'sub\\file', file: new Blob() }], [{ name: 'sub//file', file: new Blob() }],
    [{ name: 'a.mix', file: new Blob() }, { name: 'A.mix', file: new Blob() }],
    [{ name: 'huge.mix', file: { size: 0xffffffff } }]]) {
    await assert.rejects(buildFileZip(entries));
  }
  await assert.rejects(buildArchiveZip([{ name: 'gamemd.exe', file: new Blob() }]));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(buildFileZip([{ name: 'empty', file: new Blob() }], { signal: abort.signal }), { name: 'AbortError' });
  const legacy = await buildArchiveZip([{ name: 'test.big', file: new Blob(['unchanged Zero Hour archive']) }]);
  await fs.writeFile('.local/yuri-backup-generals-regression.zip', new Uint8Array(await legacy.arrayBuffer()));
  report.checks.push('Unsafe paths, case duplicates, oversized ZIPs and aborted backups rejected; Zero Hour still enforces BIG-only names');
  const fixture = path.resolve('.local/yuri-backup-fixture');
  const files = new Map(['game.exe', 'gamemd.exe', 'ra2.mix', 'ra2md.mix', 'language.mix', 'langmd.mix',
    'BINKW32.DLL', 'Blowfish.dll', 'thememd.mix', 'movmd03.mix', 'Taunts/test.wav', 'extras/évidence.txt', 'extras/empty.txt']
    .map(name => [name, Buffer.from(name.endsWith('empty.txt') ? '' : `Synthetic backup integrity fixture: ${name}\n`)]));
  for (const [name, data] of files) {
    const destination = path.join(fixture, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, data);
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, acceptDownloads: true });
      const page = await context.newPage();
      page.on('pageerror', error => report.pageErrors.push(error.message));
      page.on('request', request => { if (request.postData()) report.uploads.push(request.url()); });
      await page.goto(url);
      await page.waitForFunction(() => window.ZeroHDesktop && document.querySelector('.desktop-icons [data-open="yuri"]'));
      const setup = page.locator('#setupWindow');
      if (await setup.isVisible()) await setup.locator('[data-window-action="close"]').click();
      await page.evaluate(() => window.ZeroHDesktop.openApp('yuri'));
      const frame = page.frameLocator('#yuriFrame');
      await frame.getByRole('button', { name: 'Select folder…', exact: true }).waitFor();
      const backup = page.locator('#yuriBackup');
      await assert.equal(await backup.isDisabled(), true);
      const chooser = page.waitForEvent('filechooser');
      await frame.getByRole('button', { name: 'Select folder…', exact: true }).click();
      await (await chooser).setFiles(fixture);
      await frame.locator('.detected-games button').nth(1).waitFor();
      assert.equal(await backup.isEnabled(), true);
      assert.match(await page.locator('#yuriBackupStatus').innerText(), /13 selected files/);
      await backup.click();
      await page.locator('#yuriBackupSave').waitFor({ state: 'visible' });
      const download = page.waitForEvent('download');
      await page.locator('#yuriBackupSave').click();
      const saved = await download;
      assert.equal(saved.suggestedFilename(), 'Yuris-Revenge-backup.zip');
      const zipPath = path.resolve(`.local/Yuris-Revenge-backup-${viewport.width}.zip`);
      await saved.saveAs(zipPath);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('.yuri-backup').evaluate(node => node.scrollWidth > node.clientWidth), false);
      await page.screenshot({ path: `output/playwright/yuri-backup-${viewport.width}.png` });
      // Closing releases file references and the Blob URL; the downloaded ZIP
      // must independently restore the resource-selection screen in a new frame.
      await page.locator('#yuriWindow [data-window-action="close"]').click();
      assert.equal(await backup.isDisabled(), true);
      assert.equal(await page.locator('#yuriBackupSave').getAttribute('href'), null);
      await page.evaluate(() => window.ZeroHDesktop.openApp('yuri'));
      await frame.getByRole('button', { name: 'Select files…', exact: true }).waitFor();
      const archiveChooser = page.waitForEvent('filechooser');
      await frame.getByRole('button', { name: 'Select files…', exact: true }).click();
      await (await archiveChooser).setFiles(zipPath);
      await frame.locator('.detected-games button').nth(1).waitFor({ timeout: 60000 });
      assert.equal(await backup.isEnabled(), true);
      await backup.click();
      await page.locator('#yuriBackupSave').waitFor({ state: 'visible' });
      const archiveDownload = page.waitForEvent('download');
      await page.locator('#yuriBackupSave').click();
      const copyPath = path.resolve(`.local/yuri-backup-archive-copy-${viewport.width}.zip`);
      await (await archiveDownload).saveAs(copyPath);
      assert.deepEqual(await fs.readFile(copyPath), await fs.readFile(zipPath));
      const originalChooser = page.waitForEvent('filechooser');
      await page.locator('#yuriBackupChoose').click();
      await (await originalChooser).setFiles(fixture);
      assert.match(await page.locator('#yuriBackupStatus').innerText(), /13 selected files/);
      // The selection is captured synchronously; cancel the first asynchronous
      // checksum read and verify a subsequent retry can finish.
      await page.evaluate(() => {
        document.querySelector('#yuriBackup').click();
        document.querySelector('#yuriBackupCancel').click();
      });
      assert.match(await page.locator('#yuriBackupStatus').innerText(), /cancelled/);
      assert.equal(await backup.isEnabled(), true);
      await backup.click();
      await page.locator('#yuriBackupSave').waitFor({ state: 'visible' });
      await page.screenshot({ path: `output/playwright/yuri-backup-${viewport.width}.png` });
      report.checks.push(`${viewport.width}px: full folder ZIP downloads; ZIP re-import detects both games; original archive copy is identical; closing resets backup; no overflow`);
      report.checks.push(`${viewport.width}px: original folder can be reselected without resetting the VM; cancel and retry work`);
      await context.close();
    }
    // A multi-chunk file gives cancellation time to run between CRC chunks.
    const stop = new AbortController();
    await assert.rejects(buildFileZip([{ name: 'cancel.mix', file: new Blob([new Uint8Array(8 * 1024 * 1024)]) }], {
      signal: stop.signal, onProgress() { stop.abort(); },
    }), { name: 'AbortError' });
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.uploads, []);
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = error.stack; process.exitCode = 1; }
  finally {
    await browser.close();
    await fs.writeFile('.local/yuri-backup-verification.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
