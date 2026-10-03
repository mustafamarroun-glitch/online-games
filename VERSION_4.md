# Winchester OS — Version 4

Release: **4.0.0-preview.1**, October 3, 2026. A browser gaming desktop preview using player-owned local files.

## Work recap

- Version 1 established the compiled Zero Hour runtime, tested Windows skirmish and browser-local libraries, saves and archive ZIP export.
- Version 2 introduced Winchester OS branding, personalization and responsive desktop controls.
- Version 3 added automatic transfer relay configuration, reconnect/retry, validation, embedded-browser isolation and patched build dependencies.
- Version 4 brings the subsequent desktop and Yuri’s Revenge work into one release. Earlier releases remain available at their Git tags.

## Version 4 changes

- Clean welcome screen; Game Library opens on demand. No startup file picker. Game shortcuts appear when their local libraries are ready and restore on later visits.
- Dark startup theme, saved light/dark choice, matching Settings controls, Midnight Flow and Morning Hills wallpapers, and responsive launcher improvements.
- Yuri’s Revenge runs in a separate RA2 VM alpha. Folder/archive selection, missing-file feedback, local library backup/restore and window lifecycle are integrated with Winchester OS.
- San Andreas is removed from Game Library, desktop and Start. Its standalone experiment and corresponding source remain available separately.
- Separate local helpers support PC browser streaming and temporary Yuri multiplayer hosting. GitHub Pages hosts the static desktop; it does not run these servers.

## Evidence and limits

Earlier local evidence records the supplied complete Yuri installation reaching native menus and a skirmish on The Alamo, with tank selection, movement and terrain reveal. A short actual native match between two independent Chromium sessions on the same Windows computer passed through a public WSS relay, including synchronized base deployment and a 30-second observation. This is not a separate-computer or complete-match acceptance result.

Release checks cover the packaged GitHub Pages subpath, service-worker isolation, desktop/mobile welcome and theme behavior, library shortcuts, synthetic Yuri backup/restore, security validation, publication inventory and hosted file hashes. These checks do not rerun full retail gameplay. Fresh release evidence is retained privately in the project’s verification reports.

macOS gameplay, separate-computer multiplayer, full matches, Yuri audio/save/load/campaigns, optional-resource persistence and temporary tunnel reliability remain unverified. Zero Hour’s compiled engine is unchanged from the previously tested build. Public transfer relay credentials remain a shared allowance; restrictive networks and full retail-size transfers have acceptance limits.

Each player imports compatible retail files locally. No retail game data, private relay session link, account credentials or browser saves are published. Yuri multiplayer requires a running host and matching installations; see [Yuri multiplayer](YURIS_MULTIPLAYER.md). Streaming also requires a separate running PC host.

[Yuri preview](YURIS_REVENGE.md) · [Security review](SECURITY_REVIEW.md) · [License](LICENSE.md) · [Notices](legal.html) · [Corresponding source](source/index.html)
