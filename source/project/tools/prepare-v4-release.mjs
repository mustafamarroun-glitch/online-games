import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const put = (name, text) => writeFile(new URL(name, root), text);
const version = '4.0.0-preview.1';
const project = JSON.parse(await read('deployment/project.json'));
project.projectVersion = version;
project.stage = 'Version 4 testing preview';
project.reviewedAt = '2026-10-03';
project.sanAndreas.desktopIntegration = 'Removed from Game Library, desktop and Start; standalone experiment retained';
project.v4Verified = ['Welcome and on-demand Game Library', 'Library-dependent shortcuts and restoration', 'Saved dark/light themes and Settings consistency', 'Responsive launcher', 'Yuri local import and synthetic ZIP backup/restore', 'Yuri native skirmish and short two-browser public-relay match recorded separately'];
project.hosting = 'GitHub Pages static desktop. Yuri multiplayer and PC streaming helpers require a separately running host; no permanent multiplayer server is included.';
project.runtimeRegression = project.runtimeRegression.replace('Version 3', 'Prior Version 3');
await put('deployment/project.json', JSON.stringify(project, null, 2) + '\n');
const brand = JSON.parse(await read('deployment/branding.json'));
brand.version = version;
await put('deployment/branding.json', JSON.stringify(brand, null, 2) + '\n');
const info = JSON.parse(await read('overrides/harness/build-info.json'));
info.release.version = version;
info.projectVersion = version;
info.release.changelog = [{version:'Winchester OS V4 preview', date:'2026-10-03', entries:[
  {text:'Welcome screen and game shortcuts restored from ready local libraries.'},
  {text:'Saved dark/light themes, new wallpapers and responsive launcher improvements.'},
  {text:'Yuri’s Revenge alpha with local import, archive backup and window controls.'},
  {text:'San Andreas removed from the desktop; standalone experiment retained.'},
  {text:'Short two-browser Yuri match verified; separate-computer and full-match tests pending.'}
]}, ...info.release.changelog.filter(section => section.version !== 'Winchester OS V4 preview')];
await put('overrides/harness/build-info.json', JSON.stringify(info, null, 2) + '\n');
await put('overrides/harness/play.html', (await read('overrides/harness/play.html')).replaceAll('Version 3 preview','Version 4 preview').replaceAll('/VERSION_3.md','/VERSION_4.md'));
let readme = await read('README.md');
readme = readme.replace(/\*\*Project version:\*\*[^\n]+/, '**Project version:** 4.0.0-preview.1, Winchester OS Home Edition. Version 4 releases the welcome screen, saved themes, responsive launcher, library-dependent shortcuts and Yuri’s Revenge preview. See [VERSION_4.md](VERSION_4.md) for the work recap, evidence and remaining limits. Previous releases remain preserved; upstream engine versions are separate.');
await put('README.md', readme);
console.log(`Prepared release identity ${version}; existing overlays and browser storage identifiers preserved.`);
