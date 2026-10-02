// Personal desktop preferences are separate from game and filesystem storage.
const KEY = 'winchester-preferences-v2';
const defaults = { displayName: 'Winchester', accent: 'ocean', mode: 'simple' };
let preferences = { ...defaults };
try {
  const stored = JSON.parse(localStorage.getItem(KEY));
  if (stored && typeof stored === 'object') {
    if (typeof stored.displayName === 'string' && stored.displayName.trim()) preferences.displayName = stored.displayName.trim().slice(0, 40);
    if (['ocean', 'classic', 'silver'].includes(stored.accent)) preferences.accent = stored.accent;
    if (['simple', 'full'].includes(stored.mode)) preferences.mode = stored.mode;
  }
} catch { /* usable defaults when storage is unavailable */ }
const desktop = document.querySelector('#desktop');
// Replace only the former default backdrop once; preserve other choices.
try {
  if (!localStorage.getItem('winchester-wallpaper-migrated-v2')) {
    const settings = JSON.parse(localStorage.getItem('zeroh-settings'));
    if (settings?.wallpaper === 'command') {
      settings.wallpaper = 'winchester';
      localStorage.setItem('zeroh-settings', JSON.stringify(settings));
      desktop.dataset.wallpaper = 'winchester';
      document.querySelectorAll('[data-set-wallpaper]').forEach(button => button.classList.toggle('is-selected', button.dataset.setWallpaper === 'winchester'));
    }
    localStorage.setItem('winchester-wallpaper-migrated-v2', '1');
  }
} catch { /* storage may be disabled */ }
const essentials = new Set(['setup', 'explorer', 'programs', 'gameData', 'settings', 'browser']);
document.querySelectorAll('.desktop-icons [data-open]').forEach(button => {
  if (!essentials.has(button.dataset.open)) button.dataset.winchesterAdvanced = '';
});
document.querySelector('.desktop-icons [data-github-shortcut]')?.setAttribute('data-winchester-advanced', '');
function applyPreferences() {
  desktop.dataset.winchesterAccent = preferences.accent;
  desktop.dataset.winchesterMode = preferences.mode;
  document.querySelectorAll('[data-winchester-name]').forEach(node => { node.textContent = preferences.displayName; });
  document.querySelectorAll('[data-winchester-avatar]').forEach(node => { node.textContent = Array.from(preferences.displayName)[0].toUpperCase(); });
  document.querySelector('[data-winchester-greeting]').textContent = `Welcome home, ${preferences.displayName}.`;
  document.querySelector('#winchesterName').value = preferences.displayName;
  document.querySelector('#winchesterAccent').value = preferences.accent;
  document.querySelector('#winchesterDesktopMode').value = preferences.mode;
}
function savePreferences() {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
    return true;
  } catch {
    window.ZeroHDesktop.showToast('Could not save preferences', 'Browser storage is unavailable. These changes last until this tab is reloaded.', 'warning');
    return false;
  }
}
document.querySelector('#winchesterProfileForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = document.querySelector('#winchesterName').value.trim();
  const status = document.querySelector('#winchesterProfileStatus');
  if (!name) { status.textContent = 'Enter a name for your desktop.'; return; }
  preferences.displayName = name.slice(0, 40);
  const saved = savePreferences();
  applyPreferences();
  status.textContent = saved ? 'Saved. Welcome home.' : 'Changed for this session. Browser storage is unavailable.';
});
for (const [id, property] of [['winchesterAccent', 'accent'], ['winchesterDesktopMode', 'mode']]) {
  document.querySelector(`#${id}`).addEventListener('change', event => {
    preferences[property] = event.target.value;
    savePreferences();
    applyPreferences();
  });
}
// Existing Start menu did not include this desktop-only advanced shortcut.
if (!document.querySelector('#startMenu [data-open="llmAi"]')) {
  const button = document.createElement('button');
  button.type = 'button';
  button.innerHTML = '<svg><use href="#i-llm-ai"/></svg> AI Manager';
  button.dataset.open = 'llmAi';
  button.addEventListener('click', () => window.ZeroHDesktop.openApp('llmAi'));
  document.querySelector('.start-secondary').insertBefore(button, document.querySelector('.start-storage'));
}
applyPreferences();
