import { readFile, writeFile } from 'node:fs/promises';

// Apply after branding, or independently to retain other local game integrations.
// No engine, archive, storage identifier, or retained vendor changes.
const root = new URL('../overrides/harness/', import.meta.url);
const htmlFile = new URL('play.html', root);
let html = await readFile(htmlFile, 'utf8');
if (!html.includes('class="setup-route"')) {
  const anchor = '                <div class="source-grid">';
  if (!html.includes(anchor)) throw new Error('Launcher source-grid anchor changed');
  html = html.replace(anchor, `                <ol class="setup-route" aria-label="Steps to play">
                  <li><span>1</span> Select files</li>
                  <li><span>2</span> Choose storage</li>
                  <li><span>3</span> Launch game</li>
                </ol>

${anchor}`);
  const settings = html.match(/                <div class="launcher-quick-settings">[\s\S]*?<\/div>\n/);
  if (!settings) throw new Error('Launcher settings anchor changed');
  html = html.replace(settings[0], '');
  const privacy = '                <div class="privacy-note">';
  html = html.replace(privacy, settings[0] + '\n' + privacy);
}
// Requested follow-up: source guidance removed; Reset is its own settings section.
html = html.replace(/\s*<section class="ownership-help"[\s\S]*?<\/section>/, '');
if (!html.includes('id="winchesterTheme"')) {
  const anchor = '  <label class="setting-block"><div><strong>Window colors</strong>';
  if (!html.includes(anchor)) throw new Error('Appearance theme anchor changed');
  html = html.replace(anchor, `  <label class="setting-block"><div><strong>Theme</strong><span>Choose light or dark surfaces for your desktop.</span></div><select id="winchesterTheme"><option value="light">Light</option><option value="dark">Dark</option></select></label>
${anchor}`);
}
if (!html.includes('id="resetTab"')) {
  const button = html.match(/\s*<button id="resetConceptButton"[^>]*>[\s\S]*?<\/button>/);
  if (!button) throw new Error('Reset action anchor changed');
  html = html.replace(button[0], '');
  const anchor = '            </aside>\n            <section id="appearancePanel"';
  if (!html.includes(anchor)) throw new Error('Settings navigation anchor changed');
  html = html.replace(anchor, `              <button id="resetTab" type="button" role="tab" aria-controls="resetPanel" data-settings-tab="reset"><svg><use href="#i-power"/></svg><span>Reset</span></button>
${anchor}`);
  const panel = `            <section id="resetPanel" class="settings-panel reset-settings-panel" role="tabpanel" aria-labelledby="resetTab" data-settings-panel="reset" hidden>
              <h1>Reset Winchester OS</h1>
              <p class="settings-intro">Start again with a clean browser desktop.</p>
              <div class="reset-summary"><h2>What will be cleared</h2><ul><li>The imported game library and remembered source permissions.</li><li>Desktop preferences, window positions, and virtual desktop files.</li><li>Progress in the desktop's built-in games.</li></ul><p>Your original files on your computer are not changed.</p></div>
              <p class="reset-hint">Download anything you want to keep from My Files before resetting. You will be asked to confirm.</p>
              <button id="resetConceptButton" type="button" class="button reset-action">Reset Winchester OS data…</button>
            </section>
`;
  const end = '          </div>\n        </article>\n\n        <article id="aboutWindow"';
  if (!html.includes(end)) throw new Error('Reset panel anchor changed');
  html = html.replace(end, panel + end);
}
await writeFile(htmlFile, html);

const launcherFile = new URL('launcher.js', root);
let launcher = await readFile(launcherFile, 'utf8');
if (!launcher.includes('dataset.libraryReady')) {
  const anchor = '  function updateLibraryUI() {';
  if (!launcher.includes(anchor)) throw new Error('Library update anchor changed');
  launcher = launcher.replace(anchor, `${anchor}
    document.querySelector('#programsWindow').dataset.libraryReady = String(Boolean(state.library));`);
  launcher = launcher.replace('const label = state.library ? "Launch game" : "Original files required";',
    'const label = state.library ? "Launch game" : "Add game files";');
  // Other games own their own storage/status labels.
  launcher = launcher.replace('document.querySelectorAll(".library-size span")',
    'document.querySelectorAll(".library-row:has([data-launch-game]) .library-size span")');
}
if (!launcher.includes('confirm("Reset Winchester OS?')) {
  const anchor = '  document.querySelector("#resetConceptButton").addEventListener("click", async () => {';
  if (!launcher.includes(anchor)) throw new Error('Reset confirmation anchor changed');
  launcher = launcher.replace(anchor, `${anchor}
    if (!window.confirm("Reset Winchester OS? This removes this site's imported game library, virtual desktop files, built-in game progress, and desktop settings. Original files on your computer are not changed.")) return;`);
}
await writeFile(launcherFile, launcher);
console.log('Applied launcher hierarchy, compact setup route, and game-library action states.');
