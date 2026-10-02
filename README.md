# Winchester OS — Home Edition

**Version 2.0.0-preview.2 — testing preview.** A nostalgic personal gaming desktop based on [Project New Shoes](https://github.com/Agusx1211/NewShoes), with the locally compiled Zero Hour engine.

Original Winchester branding and landscape wallpaper, a personal desktop name, three window colors, Simple/All shortcuts, and compact Settings. [V2 release notes](VERSION_2.md). The preserved V1 baseline is tagged v1.0.0.

The site imports compatible game archives locally. Retail game data is not hosted or distributed here. Windows browser skirmish, sound, save/load, and desktop controls were tested. macOS gameplay, internet multiplayer, other editions, and long matches still need verification.

V2 interface and migration checks passed locally and through the GitHub-style package. Zero Hour engine artifacts are unchanged from V1; Zero Hour gameplay was not rerun for this identity milestone.

Version 2.0.0-preview.2 adds [San Andreas solo exploration](SAN_ANDREAS.md) to Game Library, desktop and Start, running in a Winchester OS window. Its separate OpenSA engine supports locally selected game files; a folder-upload fallback works without showDirectoryPicker. Multiplayer and original missions are unavailable. Native folder remembering is supported where available; fallback selections last for the current desktop session.

## Play

Open this repository's GitHub Pages website in current desktop Chrome. Select your compatible combined English installation's Data folder, install it in the browser, and launch Zero Hour. Choose Solo Play → Skirmish and enter a player name. Ctrl+Alt+Escape returns to the desktop. Each browser and website origin maintains its own local library.

## Build and license

Upstream revision: 3ccaa0e9af66889be183ca910851e881d47d437c. The threaded runtime was compiled locally with Docker and Emscripten 3.1.6. GitHub Pages browser isolation is supplied by the upstream service worker.

[Complete license](LICENSE.md) · [Notices](legal.html) · [Corresponding source and modifications](source/index.html) · [Beta status](project-info.json)

The source archive is split into two downloadable parts; reconstruction instructions and checksums are provided. Original archives are not modified. Optional movie playback is not included in this beta.
