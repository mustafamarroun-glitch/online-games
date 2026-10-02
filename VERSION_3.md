# Winchester OS — Version 3

Release: **3.0.0-preview.1**, October 2, 2026. This is a tested browser preview; full retail-size transfers, physical phone/computer acceptance, macOS gameplay and internet game multiplayer remain separate checks.

## Changes

- Automatic ExpressTURN internet relay configuration on both devices. Enter the transfer PIN; account sign-in is not needed to send or receive.
- Retry after interrupted transfers, cancellation guards, bounded encrypted messages and queues, safe manifest names/counts/sizes and a browser storage-space check.
- A smaller transfer-specific connection pool reduces idle relay allocations.
- Embedded web pages use an isolated sandbox. Desktop scripts, plugins, base URLs and form submissions are constrained by a content security policy; the isolation worker adds response protections.
- Security-patched build dependencies, reduced-motion support, safer backups and consistent Version 3 identity/release information.
- Safe peer-supplied card/score rendering, labelled address fields and guarded hardware capability checks.
- Existing personal settings, stored game libraries, Zero Hour ZIP backup and San Andreas solo exploration are preserved. The compiled Zero Hour engine is unchanged.

## Review and evidence

[Security review and limits](SECURITY_REVIEW.md) · [Transfer repair and network limits](source/project/TRANSFER_FIX.md).

Local checks passed for 25 desktop apps, 390px mobile layouts, accessible visible fields, sandbox/CSP boundaries, malicious transfer inputs, hostile card-game text, encrypted archive/mod delivery, interrupted-transfer retry and a real receiving relay. The actual San Andreas installation loaded, ran and reopened with session-selected files; no game files were uploaded. Current dependency advisory scans report no affected versions in the patched build lockfiles. A fresh source/container build remains unverified.

The unchanged Zero Hour engine also prepared the actual local archives and started its threaded frame loop under the Version 3 script policy in a disposable disk-backed profile, without script exceptions or policy violations. A full match was not rerun. Private/incognito storage can be insufficient for the full archives; failed writes now include storage-recovery instructions.

The isolated headless Zero Hour screenshot attempt timed out. Visible Zero Hour rendering remains unverified in this V3 review; the engine-start result is narrower than a gameplay acceptance test.

The free relay is a shared public client configuration. Visitors can consume its allowance. Direct paths remain available. The free relay was slow and did not connect when both test endpoints were forced through that same relay; do not assume every restrictive network works.

Versions 1 and 2 remain preserved at their existing Git tags. Version 3 is saved as `v3.0.0-preview.1` after publication.

[License](LICENSE.md) · [Notices](legal.html) · [Corresponding source](source/index.html)
