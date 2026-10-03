import { readFile, writeFile, copyFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, '.local/ra2-vm/source');
export const YURI_COMMIT = 'a10ac9899c258b01be1edd80492397e9de225ba5';
const revision = execFileSync(process.env.WINCHESTER_GIT || 'git', ['-c', `safe.directory=${source.replaceAll('\\', '/')}`, 'rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
if (revision !== YURI_COMMIT) throw new Error('Unexpected RA2 VM revision. Review before updating.');
// Git's Windows text conversion must not alter shader bytes checked by upstream.
const shaders = resolve(source, 'src/ui/pages/game/vendor');
for (const name of await readdir(shaders)) {
  if (name.endsWith('.glsl')) await writeFile(resolve(shaders, name), (await readFile(resolve(shaders, name), 'utf8')).replaceAll('\r\n', '\n'));
}
// Apply only integration changes. Gameplay and original executable validation remain upstream.
async function patch(name, transform) {
  const file = resolve(source, name);
  await writeFile(file, transform(await readFile(file, 'utf8')));
}
await patch('src/main.ts', text => text.replace(/if \(import\.meta\.env\.PROD && 'serviceWorker' in navigator\) \{[\s\S]*?\n\}/,
  '// Winchester OS owns service workers and shared origin caches. No game-specific worker is registered.'));
await patch('src/ui/pages/game/components/GameSourcePickerView.tsx', text => text.replace(
  '<img className="game-icon" src={`/icons/${game.id}.png`} alt="" aria-hidden="true" />',
  '<span aria-hidden="true">{game.id === "yr" ? "YR" : "RA2"}</span>'));
await patch('src/ui/pages/game/components/GameSourcePickerView.tsx', text => text
  .replace(/import \{ openGroupJoinDialog \} from '\.\.\/joinGroupDialog';\r?\n/, '')
  .replace(/\s*<Ra2MenuButton onClick=\{openGroupJoinDialog\}>[\s\S]*?<\/Ra2MenuButton>/, ''));
await patch('src/ui/pages/game/gameSourcePicker.ts', text => {
  text = text.replace("import { t } from '../../shared/i18n/translate';", "import { t, localizeLabel } from '../../shared/i18n/translate';")
    .replace('supportedGame(id).title +', 'localizeLabel(supportedGame(id).title) +');
  if (text.includes('请选择包含这些文件的已安装游戏文件夹。')) return text;
  return text
  .replace("t('未找到完整游戏资源。') +", "t('未找到完整游戏资源。') + '\\n' +")
  .replace("t(' 缺少：') +", "' ' + t(' 缺少：') + ' ' +")
  .replace(/\.map\(\(file\) => file\.name\)\s*\.join\('、'\),/, ".map((file) => file.name).join(', '),")
  .replace(".join('；'),", ".join('\\n') + '\\n' + t('请选择包含这些文件的已安装游戏文件夹。'),");
});
// Publish only validated, fully extracted imports; the desktop never treats a
// file selection or the progressive startup layer as a completed library.
await patch('src/ui/pages/game/page.ts', text => {
  const marker = '// Winchester desktop library readiness';
  if (text.includes(marker)) return text;
  const anchor = '  const progressive = progressiveFilesOf(gameSource.files);';
  if (!text.includes(anchor)) throw new Error('Yuri library readiness anchor changed');
  return text.replace(anchor, `${anchor}
  ${marker}
  const importedGameId = gameSource.game.id;
  const notifyDesktop = () => {
    if (generation === pageGeneration && window.parent !== window) {
      window.parent.postMessage({ type: 'winchester:game-files-ready', gameId: importedGameId }, window.location.origin);
    }
  };
  if (progressive) void progressive.completion.then(notifyDesktop).catch(() => {});
  else notifyDesktop();`);
});
// Describe the retained runtime's cache using its own manifest. Parent startup
// checks read this small file without loading or starting the game iframe.
const manifest = await readFile(resolve(source, 'src/games/manifest.ts'), 'utf8');
const required = manifest.match(/\byr:\s*\{[\s\S]*?playerRequired:\s*\[([\s\S]*?)\]/)?.[1];
if (!required) throw new Error('Yuri required-file manifest changed');
const files = [...required.matchAll(/name:\s*'([^']+)'/g)].map(match => match[1].toLowerCase());
const cacheSource = await readFile(resolve(source, 'src/adapter/cachedGameFiles.ts'), 'utf8');
const database = cacheSource.match(/const DB_NAME = '([^']+)'/)?.[1];
const store = cacheSource.match(/const STORE = '([^']+)'/)?.[1];
if (!files.length || !database || !store) throw new Error('Yuri cache contract changed');
await writeFile(resolve(source, 'public/winchester-library.json'), JSON.stringify({ database, store, prefix: 'yr/', required: files }) + '\n');
await patch('src/ui/shared/i18n/messages.ts', text => text.includes('请选择包含这些文件的已安装游戏文件夹。') ? text : text.replace(
  'export const englishMessages = {',
  "export const englishMessages = {\n  '请选择包含这些文件的已安装游戏文件夹。': 'Select your installed game folder containing these files.',"));
for (const name of ['src/ui/pages/game/styles.css', 'src/ui/pages/game/components/ra2menu/ra2menu.css']) {
  await patch(name, text => text.replace(/url\(\/theme\/ra2\/[^)]+\)/g, 'linear-gradient(#24496b, #173854)'));
}
// Menu plates have no separate distribution license. Use CSS and Winchester's own icons.
await patch('index.html', text => text
  .replace(/<link rel="icon"[\s\S]*?<meta name="theme-color"/, '<link rel="icon" href="./winchester-mark.svg" />\n    <meta name="theme-color"')
  .replace('maximum-scale=1, user-scalable=no', 'initial-scale=1'));
await copyFile(resolve(root, 'overrides/harness/assets/winchester/mark.svg'), resolve(source, 'public/winchester-mark.svg'));
const css = resolve(source, 'src/ui/pages/game/components/ra2menu/ra2menu.css');
const text = await readFile(css, 'utf8');
const marker = '/* Winchester OS menu integration */';
await writeFile(css, text.split(marker)[0] + marker + '\n' + await readFile(resolve(root, 'tools/yuri-menu.css'), 'utf8'));
await mkdir(resolve(root, 'experiments/yuris-revenge'), { recursive: true });
console.log(`Prepared RA2 VM ${revision}; relative build paths, shared cache protection, CSS menu and player-owned files.`);
