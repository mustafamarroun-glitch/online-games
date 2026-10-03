// Personal desktop preferences are separate from game and filesystem storage.
const KEY = 'winchester-preferences-v2';
const defaults = { displayName: 'Winchester', accent: 'ocean', mode: 'simple', theme: 'dark', appearanceVersion: 3 };
let preferences = { ...defaults };
let migrateAppearance = false;
try {
  const stored = JSON.parse(localStorage.getItem(KEY));
  if (stored && typeof stored === 'object') {
    if (typeof stored.displayName === 'string' && stored.displayName.trim()) preferences.displayName = stored.displayName.trim().slice(0, 40);
    if (['ocean', 'classic', 'silver'].includes(stored.accent)) preferences.accent = stored.accent;
    if (['simple', 'full'].includes(stored.mode)) preferences.mode = stored.mode;
    // Adopt the requested dark startup once; subsequent explicit choices persist.
    if (stored.appearanceVersion === 3 && ['light', 'dark'].includes(stored.theme)) preferences.theme = stored.theme;
    else migrateAppearance = true;
  }
} catch { /* usable defaults when storage is unavailable */ }
const desktop = document.querySelector('#desktop');
const essentials = new Set(['setup', 'explorer', 'programs', 'gameData', 'settings', 'browser']);
document.querySelectorAll('.desktop-icons [data-open]').forEach(button => {
  if (!essentials.has(button.dataset.open)) button.dataset.winchesterAdvanced = '';
});
document.querySelector('.desktop-icons [data-github-shortcut]')?.setAttribute('data-winchester-advanced', '');
function applyPreferences() {
  desktop.dataset.winchesterAccent = preferences.accent;
  desktop.dataset.winchesterMode = preferences.mode;
  desktop.dataset.winchesterTheme = preferences.theme;
  document.querySelectorAll('[data-winchester-name]').forEach(node => { node.textContent = preferences.displayName; });
  document.querySelectorAll('[data-winchester-avatar]').forEach(node => { node.textContent = Array.from(preferences.displayName)[0].toUpperCase(); });
  document.querySelector('[data-winchester-greeting]').textContent = `Welcome home, ${preferences.displayName}.`;
  document.querySelector('#winchesterName').value = preferences.displayName;
  document.querySelector('#winchesterAccent').value = preferences.accent;
  document.querySelector('#winchesterDesktopMode').value = preferences.mode;
  document.querySelector('#winchesterTheme').value = preferences.theme;
  const toggle = document.querySelector('#desktopThemeToggle');
  const nextTheme = preferences.theme === 'dark' ? 'light' : 'dark';
  toggle.querySelector('[data-theme-label]').textContent = nextTheme === 'light' ? 'Light mode' : 'Dark mode';
  toggle.querySelector('use').setAttribute('href', nextTheme === 'light' ? '#i-theme-sun' : '#i-theme-moon');
  toggle.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
  toggle.title = `${preferences.theme === 'dark' ? 'Dark' : 'Light'} theme active. Switch to ${nextTheme} theme.`;
  document.documentElement.style.colorScheme = preferences.theme;
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
for (const [id, property] of [['winchesterAccent', 'accent'], ['winchesterDesktopMode', 'mode'], ['winchesterTheme', 'theme']]) {
  document.querySelector(`#${id}`).addEventListener('change', event => {
    preferences[property] = event.target.value;
    savePreferences();
    applyPreferences();
  });
}
document.querySelector('#desktopThemeToggle').addEventListener('click', () => {
  preferences.theme = preferences.theme === 'dark' ? 'light' : 'dark';
  savePreferences();
  applyPreferences();
});
window.addEventListener('zeroh:reset-apps', () => {
  preferences = { ...defaults };
  savePreferences();
  applyPreferences();
  document.querySelector('#winchesterProfileStatus').textContent = '';
});
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
if (migrateAppearance) {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* keep dark for this session */ }
}
