# Local combined-installation profile

V2 adds Winchester OS through `node tools/create-winchester-overrides.mjs`. This regenerates the V1 backup adaptation first, then creates branded launcher files without editing vendor. Preview and packaging include the same overrides. Keep the branding generator as the final generation step; running only the backup generator restores unbranded desktop-app copy.

These launcher overrides are generated with `node tools/create-combined-overrides.mjs` from the retained upstream snapshot. Original source files under `vendor/` remain unchanged. The Docker image applies the overrides after compiling the engine.

This profile targets the inspected combined installation. It requires 15 Zero Hour archives plus actual `Music.big` and `ScriptsZH.big` archives, and checks original base-content sentinel paths inside the relevant expansion archives. It preserves filenames and validates directory bounds and required content. It does not manufacture missing base archives or assert complete payload compatibility.

`W3DEnglishZH.big` in the inspected installation encodes total archive size in big endian, while other inspected archives use little endian. The validator accepts the alternate encoding only when it equals the physical reader size. The original native engine reads that size for logging, then reads archive entries by their independently encoded offsets and sizes. No engine code or original game data is patched.

The library manager uses a dedicated manifest key/version and source-handle database. Required archive names are shared by the import worker, installed-library checks, transfer checks, and runtime mount plan.

This first profile is deliberately limited to combined English installations satisfying its content contract. Separate base/expansion media may not satisfy it. Matching filenames alone are not enough for multiplayer; actual gameplay content and runtime tests are still required.

Verification:

```powershell
node tools/verify-combined-import.mjs 'C:\Program Files (x86)\DODI-Repacks\Generals Zero Hour\Data'
```

That command exercises the real importer parser through read-only Node file adapters, including missing-archive, missing-content, and malformed-header rejection. Browser installation was verified at `http://localhost:8081/harness/play.html`, including persistence after reload. The matched official prebuilt engine booted and started a real Alpine Assault skirmish: naming, selection, construction, and native save/load worked. Source compilation subsequently completed; our compiled Docker runtime booted and loaded the persisted skirmish. Multiplayer remains a separate acceptance gate; see `BUILD_STATUS.md`.
