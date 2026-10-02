# Winchester OS — Home Edition

**Version 3.0.0-preview.1 — testing preview.** A nostalgic personal gaming desktop based on [Project New Shoes](https://github.com/Agusx1211/NewShoes), with the locally compiled Zero Hour engine.

Original Winchester branding and landscape wallpaper, a personal desktop name, three window colors, Simple/All shortcuts, and compact Settings. [V3 release notes](VERSION_3.md) · [Security review](SECURITY_REVIEW.md). Previous releases remain at their tags.

The site imports compatible game archives locally. Retail game data is not hosted or distributed here. Windows browser skirmish, sound, save/load, and desktop controls were tested. macOS gameplay, internet multiplayer, other editions, and long matches still need verification.

Version 3 includes an automatic internet relay, interrupted-transfer retry, bounded/validated transfer inputs, embedded-browser isolation, a script security policy, patched build lockfiles and safer backups. TURN client credentials are public on this static website; account login/admin credentials are excluded. Full retail-size transfers and physical two-device acceptance remain unverified.

Version 2.0.0-preview.2 adds [San Andreas solo exploration](SAN_ANDREAS.md) to Game Library, desktop and Start, running in a Winchester OS window. Its separate OpenSA engine supports locally selected game files; a folder-upload fallback works without showDirectoryPicker. Multiplayer and original missions are unavailable. Native folder remembering is supported where available; fallback selections last for the current desktop session.

## Play

Open this repository's GitHub Pages website in current desktop Chrome. Select your compatible combined English installation's Data folder, install it in the browser, and launch Zero Hour. Choose Solo Play → Skirmish and enter a player name. Ctrl+Alt+Escape returns to the desktop. Each browser and website origin maintains its own local library.

## Build and license

Upstream revision: 3ccaa0e9af66889be183ca910851e881d47d437c. The threaded runtime was compiled locally with Docker and Emscripten 3.1.6. GitHub Pages browser isolation is supplied by the upstream service worker.

[Complete license](LICENSE.md) · [Notices](legal.html) · [Corresponding source and modifications](source/index.html) · [Beta status](project-info.json)

The source archive is split into two downloadable parts; reconstruction instructions and checksums are provided. Original archives are not modified. Optional movie playback is not included in this beta.
