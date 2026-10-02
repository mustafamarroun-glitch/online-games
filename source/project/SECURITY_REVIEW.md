# Version 3 security and reliability review

Reviewed October 2, 2026. Scope: maintained browser overlays, the packaged desktop, file-transfer protocol/storage boundaries, embedded web pages, dependency advisories, backup/publication inventory and GitHub Pages isolation. This is a source review and browser regression assessment, not a penetration-test certification or a proof that the full upstream C++/WASM engine has no vulnerabilities.

## Repairs

- Embedded Browser removed `allow-same-origin` from its script-enabled sandbox. Same-site pages inside that general browser cannot read desktop storage or modify its parent. San Andreas is a reviewed, trusted same-origin application; it requires access to the selected game files and remains a separate frame.
- Desktop content security policy allows same-site scripts and WebAssembly compilation, rejects inline/evaluated JavaScript and plugins, and constrains base URLs and form destinations. Service-worker responses add `nosniff`, no-referrer and application-level permission restrictions. Pages cannot supply arbitrary origin-server security headers; initial entry uses a matching meta policy.
- Transfer decrypt/parse bounds, manifest length/type/path/count/size checks, positive chunk ranges and acknowledgement checks. AES-GCM tampering and wrong PINs fail authentication. The existing random PIN and PBKDF2/AES-GCM protocol is retained.
- Application receive backlogs and simultaneous senders are bounded; receiving checks browser quota before creating incoming storage. Cancellation during asynchronous preparation invalidates and aborts incoming sessions. Disconnect/retry cannot reuse old acknowledgement state.
- Relay configuration responses are limited to 32 KiB and 15 seconds; credential endpoints require HTTPS, omit cookies and reject redirects. Manual relay test results cannot overwrite newer edited/cleared settings.
- Corrupted stored file sizes no longer enter HTML rendering; virtual-drive breadcrumb traversal is bounded when corrupted parent links form a cycle. Malformed bare website addresses fall back to a safe search URL.
- Network card-game score and card text is escaped or assigned through textContent; a peer cannot insert markup through those rendered values. Browser and Games address fields have accessible labels.
- Hardware capability checks handle browsers that deny privileged getters inside sandboxed frames, avoiding an uncaught settings error.
- A failed OPFS archive write now gives storage-recovery instructions. Large imports can exceed private/incognito storage limits even when disk space is available; the real engine regression uses a fresh, disposable disk-backed profile.
- Project backup collects named verification reports rather than arbitrary `.local` JSON setup files. The backup contains published TURN client settings, but not private account login/admin setup files. Retail data remains excluded from project deployment/backup.
- Build dependencies receive patch overrides in `overrides/build`. Docker applies those before `npm ci`; the original source ZIP/vendor snapshot is preserved.
- Current npm advisory checks found no affected versions among the 170 packages in the patched Zero Hour build lockfile and 990 packages in the patched OpenSA lockfile. Lockfile updates ran with lifecycle scripts disabled. Compiled game binaries are unchanged; a fresh source/container build was not performed.

## Remaining limits

- The static TURN client username/password is intentionally public, with the owner's deployment authorization. Anyone can consume the free allowance. There is no server here that can issue short-lived credentials or enforce per-user quotas. Login credentials/provider admin keys are not published.
- Keep transfer PINs private and both pages open. Anyone holding the PIN can join; there is no independent identity-verification or per-recipient approval step. Public discovery services observe network/room metadata; TURN observes endpoints/traffic size while the file contents remain encrypted.
- Trystero assembles transport frames before application validation. Application bounds do not guarantee protection against every hostile transport implementation or all denial-of-service attempts.
- Optional AI API keys are stored in this browser's IndexedDB and sent only to the configured provider. Exports omit them; they are not encrypted at rest against someone with access to the browser profile. Use HTTPS providers or trusted local endpoints.
- Free ExpressTURN port 3478 can be blocked. Both endpoints forced onto the same free relay failed; a forced receiving relay connected to a sender with a reachable direct/STUN path. Free transfers were slow. No full 1.7 GB transfer or physical phone/computer acceptance test was performed in this review.
- The shipped legacy C++ engine, Emscripten/compiler image, embedded native 7-Zip WASM, OpenSA/Three/Rapier engine and game data parsers have not received a complete independent security audit. Native Windows mods/executables are not executed by this browser application.
- San Andreas original missions/multiplayer, real internet Zero Hour multiplayer, Mac gameplay and long sessions remain unverified. Selected San Andreas files remain in memory for this desktop session; native folder handles can be retained where supported.
- Version 3 Zero Hour archive preparation, native initialization and threaded frame-loop start passed without script/policy errors in a disposable disk-backed profile. The headless screenshot attempt timed out; visible Zero Hour rendering and a full match were not verified in this review. Earlier V1 live skirmish evidence applies to the unchanged engine bytes, not a new V3 gameplay acceptance.

## Reproduce checks

Run the project tools in isolated browser contexts. They never clear the owner's installed browser data. The local reports and screenshots are excluded from the public artifact. The final test results and deployment verification are recorded in the Version 3 local release record.

- `node tools/verify-security.mjs` — malicious envelope/manifest checks and publication policy/inventory checks.
- `node tools/audit-dependencies.mjs` — current npm advisories for the patched build lockfile (network required).
- `node tools/verify-v3-browser.cjs` — isolated desktop/mobile, sandbox, CSP, stored-data and app smoke checks.
- Existing UI, archive backup, transfer delivery/retry and hosted checksum verifiers.

References: [MDN iframe sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [npm advisory API](https://docs.npmjs.com/cli/audit/), [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines).
