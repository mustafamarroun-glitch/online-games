# Winchester OS — Version 2

Status: **2.0.0-preview.1 deployed and verified publicly**, October 2, 2026.
This is the first V2 milestone, not a claim that the full multiplayer roadmap is complete.
Baseline: Version 1, tag `v1.0.0`, commit `51b5532442a4a170b7f8bb751f020a0db1ac1072`.

## First milestone: nostalgic Winchester OS

- Original W mark and generated Mediterranean Home wallpaper; Ocean, Classic Blue, and Silver window chrome.
- Winchester identity in the launcher, browser, Start menu, loading screen, About, app manifest, and icons.
- Personal display name and Simple/All shortcuts preferences persist separately from existing game keys. Advanced tools remain in Start.
- V1 drive defaults migrate to Winchester names while preserving edited notes and other files.
- Browser uses winchester:// pages and accepts old newshoes:// addresses.
- Status reports the installed library and browser capabilities; multiplayer testing is labeled pending.
- Compact Settings has a scrollable tab bar and readable controls.
- V1 ZIP backup and import adaptations retained; served engine matches the recorded compiled V1 checksum.

Browser verification passed at localhost:8081: preference persistence, desktop switching, advanced-tool access, window dragging/maximize/minimize/restore, browser aliases, status, conservative file migration, and 390px touch Settings. No JavaScript exceptions or missing local resources were recorded. Evidence: `.local/winchester-v2-ui-verification.json` and `output/playwright/winchester-v2-*.png`.

Packaging checks passed for Pages and Cloudflare: allowlist, hashes, imports, original license, reconstructable source, and exclusion of retail archives. The V2 artifact is under `.local/deployment`. V1 remains preserved at its tag; the existing Pages site now serves V2.

## Public deployment

- Live website: https://mustafamarroun-glitch.github.io/online-games/
- Deployment commit: `92e476a53b8d88320913523ac4397ec7da0c1af3`.
- Version tag: `v2.0.0-preview.1`.
- Successful Pages run: `37019152295`.
- All 33 checked public HTTPS files match the reviewed package, including engine, branding, app icons, license, and complete source parts. Evidence: `.local/hosted-deployment-verification.json`.
- The full identity/UI check also passed on the public URL: persistence, shortcut switching, window controls, aliases/status, conservative drive migration, and 390px touch Settings. No browser exceptions or missing resources were recorded. Evidence: `.local/winchester-v2-hosted-ui-verification.json`.
- Existing public origin and storage identifiers retained. Actual gameplay and multiplayer were not rerun for this identity release.

The same browser checks also passed through the GitHub-style package at localhost:8082/online-games/, with service-worker isolation and no server isolation headers. Evidence: `.local/winchester-v2-packaged-ui-verification.json`. Actual gameplay was not rerun for this identity milestone; no engine bytes were changed.

## Run and rebuild

Open http://localhost:8081/harness/play.html. After stopping an existing preview, `./Start-Local.ps1 -Runtime Packaged` serves the retained compiled V1 website engine with current overrides and verifies its WASM checksum. Docker remains the default runtime option. Keep the same origin to reuse existing installed files and saves.

Regenerate branding with `node tools/create-winchester-overrides.mjs`, then start the preview and run `node tools/package-deployment.mjs`. `deployment/branding.json` records the identity. Overrides are included in the corresponding source; the vendor tree is unmodified.

The local pre-change override/tool snapshot is `.local/v1-branding-baseline`. Version 1 tag and offline backups remain the durable baseline.

## Next acceptance gates

1. Test imported compatible assets and actual gameplay on the friend's Mac Chrome.
2. Test a real Windows/Mac multiplayer match on different networks; diagnose any
   demonstrated connection or desynchronization failures.
3. Check longer matches and recovery from disconnects or interrupted imports.
4. Iterate on Winchester OS from user feedback and simplify the first-import experience further.
5. Investigate additional games/mods, including Red Alert/Mental Omega, separately
   before promising compatibility or implementation.

Keep retail assets local, preserve source/license notices, and retain the
Version 1 tag and backups. Do not rename unverified work as a completed Version 2.
