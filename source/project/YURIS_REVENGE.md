# Red Alert 2: Yuri’s Revenge in Winchester OS

Open **Game Library → Red Alert 2: Yuri’s Revenge → Open**, or its desktop / Start shortcut. It runs a separate RA2 VM alpha inside a Winchester OS window. Select your own game folder or archive. If both games are detected, choose Yuri’s Revenge. The native game’s Single Player → Skirmish is the first gameplay acceptance test.

The imported installation must include the original `gamemd.exe`, `ra2md.mix`, `langmd.mix`, `BINKW32.DLL` and `Blowfish.dll`, plus the installation’s other resources for maps, sound, music and campaigns. Keep a complete combined RA2/YR installation rather than deleting files to meet the minimum checklist. The picker reports missing required files. Neither the launcher nor engine downloads a replacement executable. Retail files stay in the browser and are excluded from project packaging, backups and public artifacts.

Start the local Winchester desktop with `./Start-Local.ps1 -Runtime Packaged`, then open `http://localhost:8081/harness/play.html`. Use the runtime’s own Select files / Select folder controls; the Zero Hour importer is a different engine and archive format. Browser imports and saves are origin-specific; localhost and the public website have separate storage. Save inside the game before closing the window. Minimizing preserves the session; closing unloads the VM.

## Personal game-file backup

After selecting the installation in Yuri's window, click **Download backup**, then **Save backup.zip** when preparation finishes. A folder selection produces `Yuris-Revenge-backup.zip` with every selected file, including optional resources and subdirectories. The backup uses the complete original selection rather than the engine's filtered or potentially partial browser cache. The root folder wrapper is removed so the ZIP can be selected directly with **Select files…** to restore the game resources.

For an archive selection, the backup copies that original archive byte for byte and preserves its format: ZIP, RAR, 7z or EXE. Restore it with **Select files…**. These are private browser downloads; no game files are uploaded or included in public project packages.

Create the backup before closing Yuri's window. Minimizing retains the selection; closing releases it. An automatically restored cache cannot enable a full-installation backup: use **Select original folder** in the backup toolbar to reselect the complete installation without restarting the game. Files saved inside the VM after selection are separate and are not included in this installation backup. A folder ZIP is limited to less than 4 GB and 65,535 files; keep the original folder if it exceeds those limits. Preparation can be cancelled and retried.

`node tools/verify-yuri-backup.cjs` checks folder downloads, archive preservation, restore discovery, invalid ZIP inputs and desktop/mobile controls with synthetic files. It does not validate a retail installation or gameplay.

## Multiplayer

The engine exposes a Multiplayer checkbox and relay address. It requires a reachable RA2 VM WebSocket relay; the existing Zero Hour discovery and streaming connection are not that relay. Run `./Start-YuriMultiplayer.ps1` to host a temporary friend-play session from this computer, or configure an existing compatible relay. The helper serves only the packaged engine and creates a Cloudflare Quick Tunnel; each browser imports its own installation. Share the printed game link, then open **Network** in the original game. Use matching game versions, mods and maps, with an Open human slot for the friend. Keep the host awake and online, and stop hosting with `./Stop-YuriMultiplayer.ps1`. Two independent browser sessions passed a short native match through the public relay on 2026-10-03, including synchronized base deployment. Separate-computer matches, long-match reliability and Windows/Mac compatibility remain unverified. See [YURIS_MULTIPLAYER.md](YURIS_MULTIPLAYER.md) for scope, earlier failures and evidence.

## Engine and rebuild

Upstream: [ra2-games/ra2](https://github.com/ra2-games/ra2), pinned at `a10ac9899c258b01be1edd80492397e9de225ba5`, RA2 VM 0.1.0, GPL-3.0-or-later. EA has not endorsed and does not support this product.

The engine uses v86 with a Win32 / DirectX compatibility layer to execute the player-supplied game; it does not boot Windows. It is an alpha. Native extensions, all executable variants, complete campaigns, sustained skirmishes and multiplayer require independent testing.

Clone the pinned revision into `.local/ra2-vm/source`, then use its required pnpm 11.24.0:

```powershell
node tools/prepare-yuri-runtime.mjs
# In .local/ra2-vm/source:
pnpm install --frozen-lockfile
pnpm run check
pnpm exec vite build --base ./
# Back in the project root, with Python available:
python tools/package-yuri-runtime.py
```

Set `WINCHESTER_GIT` to the Git executable if it is absent from PATH. The integration disables the separate engine service worker (which otherwise deletes unrelated same-origin caches), uses relative build paths for GitHub Pages, and replaces menu plates without distribution licenses with CSS. Game behavior and executable validation remain upstream. The runtime disables its history trap while embedded, preserving the host desktop’s navigation.

`experiments/yuris-revenge/provenance.json` inventories every shipped artifact with SHA-256. The engine package includes its GPL license, dependency notices and complete modified source in `RA2-VM-source.zip`. Local preview, deployment packaging and project backups reuse this inventory; public publishing is a separate action.

## Verification

Integration checks are run by `node tools/verify-yuri-integration.cjs`. They exercise launcher shortcuts, window lifecycle, desktop and compact rendering, missing-file feedback, isolation and deployment paths. Reports go to `.local/yuri-integration-verification.json` and screenshots to `output/playwright/`.

The first supplied CnCNet installation was imported on October 3, 2026. Its resource files were recognized, but launch was blocked because `gamemd.exe` is absent; it contains `gamemd-spawn.exe` instead. The original executable is required by this runtime. Renaming the spawner executable does not establish compatibility.

A second, complete Windows installation was tested the same day. Folder import detected both games, and its original `gamemd.exe` booted Yuri's Revenge inside the Winchester window. The native Single Player → Skirmish menu opened, with Yuri selected against an Easy Enemy on The Alamo. Starting the match rendered the battlefield; selecting and moving a tank revealed more terrain. Screenshots in `output/playwright/winchester-yuri-{single-player,skirmish-settings,skirmish-battlefield,unit-selected,unit-move}.png` record those observed steps. The successful run recorded no browser page errors or file uploads. No installation files were changed.

The first attempt to read this complete folder failed with a browser file-read error; a fresh-profile retry succeeded. The disposable browser also reported a storage-quota fallback that cached only required files. Full optional-resource persistence after reopening is therefore unverified; reselect the complete installation if resources are unavailable. This is a short Windows skirmish/input check, not a complete match or cross-platform acceptance.

Audio playback, construction/deployment, a sustained bot match, campaign, saved-game reload and two-player matches remain unverified. An import screen or green engine build alone is not gameplay evidence.

Launcher acceptance passed at 1440px and 390px on the local preview and the GitHub Pages subpath with service-worker isolation. The recovery message lists missing files by game and gives an installed-folder action. TypeScript, the relative production build, and all 26 targeted picker/i18n tests passed. The finish reviewer scored the two listed typography/recovery findings resolved; Chromium confirmed the heading renders Tahoma-Bold.

TypeScript and the production build passed. The first upstream `check` run passed 999 of 1,003 tests: two shader checksum failures were caused by Git’s Windows CRLF conversion and were resolved by restoring LF (the seven shader tests then passed). Two upstream CI harness tests remain unsuccessful on Windows: a directory-symlink fixture requires additional OS privileges, and the process cleanup test assumes POSIX process-group signals and times out. No tests were removed or disabled. These are recorded separately from the passing browser integration checks; the complete upstream suite is not claimed as green.

The packaged custom VM firmware uses the `.rom` extension with unchanged bytes so it can pass the existing retail `.bin` exclusion. The packaging helper rewrites only its generated URL references. Menu plates, extracted icons, the separate PWA worker and game-specific PWA manifest are excluded from the distributable; Winchester artwork is used instead.
