import { buildFileZip } from './launcher-backup-zip.mjs';
import { hasCachedYuriLibrary } from './launcher-yuri-library.mjs';

const app = document.querySelector('#yuriWindow');
const frame = document.querySelector('#yuriFrame');
const status = document.querySelector('#yuriStatus');
const retry = document.querySelector('#yuriRetry');
const runtime = new URL('../games/yuris-revenge/', import.meta.url);
runtime.searchParams.set('nav-guard', '0');
let attempt = 0;
const backup = document.querySelector('#yuriBackup');
const backupFolder = document.querySelector('#yuriBackupFolder');
const backupChoose = document.querySelector('#yuriBackupChoose');
const backupCancel = document.querySelector('#yuriBackupCancel');
const backupSave = document.querySelector('#yuriBackupSave');
const backupStatus = document.querySelector('#yuriBackupStatus');
let selectedFiles = [];
let selectedArchive = false;
let backupController = null;
let backupUrl = null;
let pickerDocument = null;

function clearDownload() {
  if (backupUrl) URL.revokeObjectURL(backupUrl);
  backupUrl = null;
  backupSave.hidden = true;
  backupSave.removeAttribute('href');
}
function cancelBackup() {
  backupController?.abort();
  backupController = null;
  backupCancel.hidden = true;
  backup.disabled = !selectedFiles.length;
}
function resetBackup() {
  cancelBackup();
  clearDownload();
  selectedFiles = [];
  backup.disabled = true;
  backupStatus.textContent = 'Select your complete game folder or archive to enable backup.';
  pickerDocument?.removeEventListener('change', captureSelection, true);
  pickerDocument = null;
}
function captureSelection(event) {
  const input = event.target;
  if (!input?.matches?.('.game-source-picker input[type="file"], #yuriBackupFolder') || !input.files?.length) return;
  cancelBackup();
  clearDownload();
  // Retain complete original Files, before the engine filters its supported
  // resources or falls back to a required-files-only cache on storage quota.
  selectedFiles = Array.from(input.files);
  selectedArchive = !input.hasAttribute('webkitdirectory');
  backup.disabled = false;
  backupStatus.textContent = selectedArchive
    ? 'Original archive selected. Backup keeps its format and contents.'
    : `${selectedFiles.length.toLocaleString()} selected files. Backup includes the full folder; new in-game saves are separate.`;
  if (input === backupFolder) input.value = '';
}
// Cached sessions can boot directly into the game. This picker also lets them
// back up the complete original installation without resetting the VM/cache.
backupChoose.addEventListener('click', () => backupFolder.click());
backupFolder.addEventListener('change', captureSelection);
backupCancel.addEventListener('click', () => {
  cancelBackup();
  backupStatus.textContent = 'Backup cancelled. Your selected files are still available; try again when ready.';
});
backup.addEventListener('click', async () => {
  if (!selectedFiles.length || backupController) return;
  const controller = new AbortController();
  backupController = controller;
  clearDownload();
  backup.disabled = true;
  backupCancel.hidden = false;
  backupStatus.textContent = 'Preparing your selected game files…';
  try {
    const files = selectedFiles;
    const extension = selectedArchive ? files[0].name.match(/\.(zip|rar|7z|exe)$/i)?.[1].toLowerCase() : 'zip';
    if (!extension) throw new Error('Select a ZIP, RAR, 7z or EXE archive, or a complete game folder.');
    const blob = selectedArchive ? files[0] : await buildFileZip(files.map(file => ({
      name: file.webkitRelativePath.split('/').slice(1).join('/') || file.name,
      file,
    })), { signal: controller.signal, onProgress: ({ completed, total }) => {
      if (backupController === controller) backupStatus.textContent = `Preparing backup: ${total ? Math.floor(completed / total * 100) : 100}% · ${files.length.toLocaleString()} files`;
    } });
    controller.signal.throwIfAborted();
    if (backupController !== controller) return;
    backupUrl = URL.createObjectURL(blob);
    backupSave.href = backupUrl;
    backupSave.download = `Yuris-Revenge-backup.${extension}`;
    backupSave.textContent = `Save backup.${extension}`;
    backupSave.hidden = false;
    backupStatus.textContent = selectedArchive
      ? 'Backup ready. Save the original archive, then restore with Select files…'
      : 'Backup ready. Save the ZIP, then restore with Select files… New in-game saves are separate.';
    backupSave.focus();
  } catch (error) {
    if (backupController === controller && error.name !== 'AbortError') {
      backupStatus.textContent = `Backup failed: ${error.message} Reselect the original files and try again.`;
    }
  } finally {
    if (backupController === controller) {
      backupController = null;
      backupCancel.hidden = true;
      backup.disabled = !selectedFiles.length;
    }
  }
});

function shortcut(container, className) {
  if (!container) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.open = 'yuri';
  if (className === 'desktop-icon') {
    button.hidden = true;
    button.setAttribute('aria-label', 'Launch Yuri’s Revenge');
  }
  const icon = '<svg aria-hidden="true"><use href="#i-games"/></svg>';
  button.innerHTML = className === 'desktop-icon'
    ? `<span class="desktop-icon-art app-art">${icon}<i class="shortcut-arrow">↗</i></span><span>Yuri’s Revenge</span>`
    : `<span class="start-icon">${icon}</span><div><strong>Yuri’s Revenge</strong><small>Red Alert 2 · Browser preview</small></div>`;
  button.addEventListener('click', () => window.ZeroHDesktop.openApp('yuri'));
  container.append(button);
  return button;
}
const desktopShortcut = shortcut(document.querySelector('.desktop-icons'), 'desktop-icon');
shortcut(document.querySelector('.start-primary'), 'start-game');
let sessionReady = false;
let cacheRevision = 0;
const libraryManifest = fetch(new URL('winchester-library.json', runtime), { cache: 'no-store' })
  .then(response => response.ok ? response.json() : null).catch(() => null);
async function refreshShortcut() {
  const revision = ++cacheRevision;
  const cached = await hasCachedYuriLibrary(await libraryManifest).catch(() => false);
  if (revision === cacheRevision) desktopShortcut.hidden = !(sessionReady || cached);
}
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== frame.contentWindow
      || event.data?.type !== 'winchester:game-files-ready' || event.data.gameId !== 'yr') return;
  sessionReady = true;
  desktopShortcut.hidden = false;
});
window.addEventListener('focus', () => void refreshShortcut());
void refreshShortcut();

async function load() {
  if (!app.classList.contains('is-open') || frame.hasAttribute('src')) return;
  const current = ++attempt;
  status.hidden = false;
  status.textContent = 'Opening Yuri’s Revenge file picker…';
  retry.hidden = true;
  try {
    const response = await fetch(runtime, { cache: 'no-store' });
    if (!response.ok) throw new Error('The Yuri’s Revenge runtime is unavailable. Start the prepared local preview and try again.');
    if (current !== attempt || !app.classList.contains('is-open')) return;
    frame.src = runtime.href;
  } catch (error) {
    if (current !== attempt) return;
    status.textContent = error.message;
    retry.hidden = false;
  }
}
frame.addEventListener('load', () => {
  if (!frame.hasAttribute('src')) return;
  pickerDocument?.removeEventListener('change', captureSelection, true);
  pickerDocument = frame.contentDocument;
  pickerDocument?.addEventListener('change', captureSelection, true);
  status.hidden = true;
  retry.hidden = true;
});
retry.addEventListener('click', load);
new MutationObserver(() => {
  if (!app.classList.contains('is-open')) {
    attempt++;
    resetBackup();
    frame.removeAttribute('src');
    sessionReady = false;
    void refreshShortcut();
  } else void load();
}).observe(app, { attributes: true, attributeFilter: ['class'] });
window.addEventListener('pagehide', resetBackup);
