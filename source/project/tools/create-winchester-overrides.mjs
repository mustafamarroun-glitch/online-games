import { readFile, writeFile, mkdir } from 'node:fs/promises';

// Generate from the retained upstream snapshot and our V1 backup adaptation.
// Never edit vendor or change the browser's game/filesystem storage identifiers.
await import('./create-backup-overrides.mjs');
const root = new URL('../', import.meta.url);
const brand = JSON.parse(await readFile(new URL('deployment/branding.json', root), 'utf8'));
const project = JSON.parse(await readFile(new URL('deployment/project.json', root), 'utf8'));
const source = new URL('vendor/NewShoes-main/WebAssembly/harness/', root);
const output = new URL('overrides/harness/', root);
await mkdir(output, { recursive: true });
const read = name => readFile(new URL(name, source), 'utf8');
const put = (name, text) => writeFile(new URL(name, output), text);
function replaceOnce(text, before, after) {
  if (text.split(before).length !== 2) throw new Error(`Upstream anchor changed: ${before.slice(0, 80)}`);
  return text.replace(before, after);
}
const rename = text => text.replaceAll('Project New Shoes', brand.name).replaceAll('PROJECT NEW SHOES', brand.name.toUpperCase());

let html = rename(await read('play.html'));
html = html.replace('data-bink-video-sidecars="auto"', 'data-bink-video-sidecars="unavailable"')
  .replace(/<title>.*?<\/title>/, `<title>${brand.name} · Home Edition</title>`)
  .replace('./assets/brand/project-new-shoes.ico', brand.logo)
  .replace('./assets/brand/project-new-shoes-apple-touch.png', './assets/winchester/icon-192.png')
  .replace('./assets/zeroh-command-desert.webp" as="image"', `${brand.wallpaper}" as="image"`)
  .replace('<meta name="theme-color" content="#111513">', '<meta name="theme-color" content="#16668d">')
  .replace('<link rel="stylesheet" href="./launcher.css">', '<link rel="stylesheet" href="./launcher.css">\n    <link rel="stylesheet" href="./launcher-winchester.css">\n    <link rel="stylesheet" href="./launcher-backup.css">')
  .replaceAll('newshoes://', 'winchester://')
  .replace('Runtime available', 'Open browser and hardware details');
html = html.replaceAll(`${brand.name} Game Launcher`, 'Game Launcher').replaceAll(`${brand.name} Browser`, 'Browser');
html = html.replace(`${brand.name} Launcher</span>`, 'Game Launcher</span>');
html = replaceOnce(html, '<div><span>NEW <span class="brand-h">SHOES</span></span><strong>PROJECT COMMAND CENTER</strong></div>',
  `<div><span>Winchester<span class="brand-h"> OS</span></span><strong>${brand.edition}</strong></div>`);
html = html.replace('<p class="wizard-side-copy">Local assets.<br>Real engine.<br>Browser native.</p>', '<p class="wizard-side-copy">Your games.<br>Your desktop.<br>Welcome home.</p>')
  .replace('<strong>runtime ready</strong>', '<strong>browser engine</strong>')
  .replace('Choose your original Generals and Zero Hour disc images, or an existing Zero Hour installation. We only inspect the files needed to prepare the game.', 'Select the Data folder from your compatible combined English installation. Your game files stay in this browser.')
  .replace(/<button type="button" class="source-card" id="pickImageButton">[\s\S]*?<\/button>/, '<button type="button" class="source-card" id="pickImageButton" disabled hidden aria-hidden="true">Disc import is unavailable in this profile.</button>')
  .replace('<h1>NEW <span>SHOES</span></h1>', '<h1>Winchester <span>OS</span></h1>')
  .replace('<small>Independent browser runtime</small>', `<small>${brand.edition} · V2 preview</small>`)
  .replace('<dt>Build commit</dt>', '<dt>Engine source</dt>')
  .replace('Command Net and the open web', 'Your home page and the web')
  .replace('Classic XP games, command-approved', 'A few familiar classics')
  .replace('>Command Net</button>', '>Home</button>')
  .replace('>Field Manual</button>', '>Help</button>')
  .replace('Choose the backdrop for your command center.', 'Choose a backdrop for your desktop.')
  .replace('Expand a set to inspect its archives', 'Expand the installed library to download a ZIP or individual archives');
html = html.replace(/<p class="about-resources">[\s\S]*?<\/p>/,
  `<p class="about-resources"><a href="${brand.repository}" target="_blank" rel="noopener noreferrer">Winchester OS source</a><span> · </span><a href="${brand.upstreamRepository}" target="_blank" rel="noopener noreferrer">New Shoes engine</a></p>`)
  .replace('https://github.com/Agusx1211/NewShoes/blob/main/CHANGELOG.md', `${brand.repository}/blob/main/VERSION_2.md`)
  .replace(/<p class="about-legal">[\s\S]*?<\/p>/,
    '<p class="about-legal">Winchester OS is based on Project New Shoes. Original engine copyright © Electronic Arts Inc. and Project New Shoes contributors. EA has not endorsed this project. Game files are supplied locally by each player. <a href="../LICENSE.md" target="_blank" rel="noopener">License and notices</a></p>');
html = html.replace(/(<a class="desktop-icon desktop-icon-link"[^>]*href=")[^"]+/, `$1${brand.repository}`);
html = replaceOnce(html, '<span class="user-avatar">C</span><div><strong>Commander</strong>', '<span class="user-avatar" data-winchester-avatar>W</span><div><strong data-winchester-name>Winchester</strong>');
html = replaceOnce(html, '<nav class="desktop-icons" aria-label="Desktop shortcuts">',
  `<aside class="winchester-desktop-brand" aria-label="${brand.name}"><img src="${brand.logo}" width="56" height="56" alt=""><div><h1>Winchester <span>OS</span></h1><p>${brand.edition} · Version 2 preview</p><span data-winchester-greeting>Welcome home, Winchester.</span></div></aside>\n      <nav class="desktop-icons" aria-label="Desktop shortcuts">`);
html = html.replace('<svg class="start-command-mark"><use href="#i-system"/></svg>', `<img class="start-command-mark" src="${brand.logo}" alt="">`);
html = html.replace('<div class="wallpaper-options">', '<div class="wallpaper-options"><button type="button" class="wallpaper-swatch winchester" data-set-wallpaper="winchester" aria-label="Winchester Home wallpaper"></button>');
html = replaceOnce(html, '<p class="eyebrow">APPEARANCE</p><h1>Make it feel like home</h1>',
  `<h1>Make it feel like home</h1>
  <form id="winchesterProfileForm" class="winchester-profile-form">
    <label for="winchesterName"><strong>Your desktop name</strong><span>Shown in the Start menu and on your desktop.</span></label>
    <div><input id="winchesterName" name="displayName" maxlength="40" autocomplete="nickname" value="Winchester" required><button type="submit" class="button small">Save name</button></div>
    <p id="winchesterProfileStatus" role="status" aria-live="polite"></p>
  </form>
  <label class="setting-block"><div><strong>Window colors</strong><span>A familiar look, in your favorite color.</span></div><select id="winchesterAccent"><option value="ocean">Ocean</option><option value="classic">Classic blue</option><option value="silver">Silver</option></select></label>
  <label class="setting-block"><div><strong>Desktop shortcuts</strong><span>All tools stay available in the Start menu.</span></div><select id="winchesterDesktopMode"><option value="simple">Simple</option><option value="full">All shortcuts</option></select></label>`);
html = html.replace('<button type="button" class="tray-network"', '<button type="button" class="tray-network" data-open-settings="hardware"');
// Keep the compact desktop useful while preserving every application in Start.
await put('play.html', html);

let launcher = rename(await read('launcher.js'));
launcher = launcher.replace('./assets/launcher-logo.webp', brand.logo)
  .replaceAll(`${brand.name} Game Launcher`, 'Game Launcher').replaceAll(`${brand.name} Browser`, 'Browser')
  .replace('settings.wallpaper || "command"', 'settings.wallpaper || "winchester"')
  .replace('"installed and ready without the original media"', '"installed in this browser"');
launcher += '\nconst betaDiscPicker = document.querySelector("#pickImageButton");\nif (betaDiscPicker) betaDiscPicker.hidden = true;\n';
await put('launcher.js', launcher);
await put('launcher-entry.mjs', (await read('launcher-entry.mjs')) + '\nimport "./launcher-winchester.mjs";\n');
await put('launcher-os-shutdown.mjs', (await read('launcher-os-shutdown.mjs')).replace('https://github.com/Agusx1211/NewShoes', brand.repository));
await put('launcher-build-info.js', (await read('launcher-build-info.js')).replace('`v${version} · ${shortCommit}${info.git?.dirty ? "+dirty" : ""}`', '`Winchester OS · v${version}`'));
await put('build-info.json', JSON.stringify({ schema: 'cnc.harness-build-info.v1', release: { version: brand.version, changelog: [{ version: 'Winchester OS V2 preview', date: '2026-10-02', entries: [
  { text: 'Original Winchester identity and Home wallpaper.' },
  { text: 'Personal desktop name, three window colors, and simple or full shortcuts.' },
  { text: 'V1 game import, saves, replay storage, and ZIP backup retained.' },
  { text: 'Mac gameplay and internet multiplayer still need participant testing.' }
] }] }, git: { commit: project.upstreamCommit, shortCommit: project.upstreamCommit.slice(0, 7), dirty: false }, engineVersion: '0.8.4', projectVersion: brand.version }, null, 2));
await put('manifest.webmanifest', JSON.stringify({ name: brand.name, short_name: brand.shortName, description: brand.tagline, start_url: './play.html', scope: './', display: 'fullscreen', background_color: '#16668d', theme_color: '#16668d', icons: [192, 512].map(size => ({ src: `./assets/winchester/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any' })) }, null, 2));

// Keep exact original welcome strings for conservative migration of V1 defaults.
let apps = await readFile(new URL('launcher-desktop-apps.js', output), 'utf8');
const oldWelcome = '  const WELCOME_CONTENT = LEGACY_WELCOME_CONTENT.replace("\\n- Mods\\n", "\\n");';
apps = replaceOnce(apps, oldWelcome, `  const V1_WELCOME_CONTENT = LEGACY_WELCOME_CONTENT.replace("\\n- Mods\\n", "\\n");
  const WELCOME_CONTENT = "Welcome to Winchester OS.\\n\\nA little desktop. A place of your own.\\n\\nOpen Game Launcher to add your Zero Hour files. Personalize your name, wallpaper, and colors in Settings. Your files, saves, and replays stay in this browser.\\n\\nFor a game-file backup, open My Files > Browser Storage and choose Download all (ZIP).\\n\\nPress Ctrl + Alt + Escape in-game to return to your desktop.\\n";`);
apps = apps.replace('name: "New Shoes Drive"', 'name: "Winchester Drive"')
  .replace('name: "Welcome to Project New Shoes.txt"', 'name: "Welcome to Winchester OS.txt"');
apps = replaceOnce(apps, '        return stored;', `        const drive = stored.nodes.find(node => node.id === "root");
        if (drive?.name === "New Shoes Drive") drive.name = "Winchester Drive";
        const welcomeNote = stored.nodes.find(node => node.id === "note-1");
        if (welcomeNote?.name === "Welcome to Project New Shoes.txt") welcomeNote.name = "Welcome to Winchester OS.txt";
        if (welcomeNote && [LEGACY_WELCOME_CONTENT, V1_WELCOME_CONTENT].includes(welcomeNote.content)) {
          welcomeNote.content = WELCOME_CONTENT;
          welcomeNote.size = WELCOME_CONTENT.length;
        }
        return stored;`);
// Do not rename the preserved legacy welcome string: it is migration evidence.
const split = apps.indexOf('  function seedFileSystem()');
apps = apps.slice(0, split) + rename(apps.slice(split));
// Restore the old name check after applying display-copy branding.
apps = apps.replace('welcomeNote?.name === "Welcome to Winchester OS.txt"', 'welcomeNote?.name === "Welcome to Project New Shoes.txt"');
apps = apps.replaceAll('newshoes://', 'winchester://').replaceAll('NEWSHOES://', 'WINCHESTER://')
  .replaceAll('New Shoes Drive', 'Winchester Drive');
apps = apps.replace('drive?.name === "Winchester Drive"', 'drive?.name === "New Shoes Drive"');
apps = replaceOnce(apps, '    const address = value.trim();', '    const address = value.trim().replace(new RegExp("^newshoes://", "i"), "winchester://");');
apps = apps.replace('WINCHESTER OS LOCAL INTRANET', 'WINCHESTER OS HOME').replace('<h1>COMMAND NET</h1>', '<h1>Welcome home.</h1>')
  .replace('Local services are online. Choose a channel.', 'Your games, your files, and a few familiar places.')
  .replace('FIELD MANUAL', 'DESKTOP HELP').replace('Command-approved downtime', 'A few familiar classics')
  .replace('PROJECT NEW SHOES FIELD MANUAL', 'WINCHESTER OS HELP');
apps = replaceOnce(apps, '      page.innerHTML = browserPages[address];', `      page.innerHTML = browserPages[address];
      if (address === "winchester://status") {
        const installed = window.ZeroHAssetLibrary?.installedLibrary();
        const canvas = document.createElement("canvas");
        const graphics = canvas.getContext("webgl2");
        const hasGraphics = Boolean(graphics);
        graphics?.getExtension("WEBGL_lose_context")?.loseContext();
        const readings = [
          ["GAME LIBRARY", installed ? "INSTALLED" : "NOT INSTALLED", installed ? installed.archives.length + " validated game archives" : "Add your files in Game Launcher"],
          ["BROWSER ISOLATION", window.crossOriginIsolated ? "ACTIVE" : "INACTIVE", "Required by the threaded engine"],
          ["GRAPHICS", hasGraphics ? "WEBGL2 AVAILABLE" : "UNAVAILABLE", "Browser capability; gameplay is a separate check"],
          ["MULTIPLAYER", "TESTING PENDING", typeof RTCPeerConnection === "function" ? "WebRTC available; a real online match still needs testing" : "WebRTC unavailable in this browser"]
        ];
        page.querySelectorAll(".status-grid article").forEach((article, index) => {
          article.querySelector("strong").textContent = readings[index][0];
          article.querySelector("b").textContent = readings[index][1];
          article.querySelector("span").textContent = readings[index][2];
        });
      }`);
await put('launcher-desktop-apps.js', apps);
console.log(`Generated ${brand.name} ${brand.version}; retained vendor and V1 storage identifiers.`);
