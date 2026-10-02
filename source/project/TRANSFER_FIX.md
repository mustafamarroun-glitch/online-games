# Device transfer connection repair

The reported failure happened after SDP exchange, before the WebRTC data channel opened. The original transfer room configured discovery only and supplied no TURN fallback. A discovery relay pairs devices; it does not relay file traffic around restrictive NATs, VPNs, or firewalls.

The Winchester override now loads STUN/TURN configuration before joining the room. Direct connections remain available. Connection settings accept TURN addresses and credentials, provide a real relay-allocation test, and keep manually entered credentials in the current browser tab. A timed-out receiver can retry the same active PIN. Cancel aborts pending configuration requests; stale room callbacks cannot reopen a stopped session or overwrite a newer one. Connection and progress messages distinguish waiting, failure, and received data.

## Enable the internet fallback

No operational public TURN service is currently configured for this website. Local TURN verification does not establish that the user's two devices can connect across their networks.

Obtain a TURN service account, then use either setup:

1. In Game File Transfer → Connection settings on both devices, enter the service's `turn:`/`turns:` addresses, username, and password. Select Test relay. After it responds, start a new transfer. Manual credentials last for that tab only.
2. For centrally managed credentials, configure `overrides/harness/device-transfer-network.json`. `credentialEndpoint` accepts an HTTPS URL returning an array of RTCIceServer objects. Use a service that issues time-limited, limited-access credentials and supports browser CORS. Keep service administration keys out of the website and Git history. An endpoint failure is reported before creating a room. `iceServers` can also contain public/client-scoped TURN credentials; that configuration is served publicly.

Files remain encrypted with the ephemeral PIN inside the WebRTC channel, including when a TURN server forwards them. No game files are sent through the public Nostr discovery services. Leave both devices' pages open throughout the transfer. Phones may suspend transfers if their screen locks or their browser moves to the background.

Metered documents a free account option at https://www.metered.ca/tools/openrelay/. An old public/static relay option was probed and produced no usable relay candidate; it is not included as a working default.

## Verification on October 2, 2026

- Two isolated receivers, including a portrait viewport, each received 17 generated archive fixtures and an installed mod. The largest fixture exceeded the 2 MiB acknowledgement checkpoint. SHA-256 matched for every complete received archive. Approximately 3 MiB was delivered to each receiver; a full retail-sized installation was not retested.
- The same delivery test passed with native WebRTC's direct paths disabled (`iceTransportPolicy: relay`) and a real coturn server. Selected candidate pairs were verified to use TURN. The server was local and temporary; this is relay-path integration evidence, not a remote-network acceptance test.
- Shipping public Nostr discovery paired the isolated browser profiles and delivered their files. One optional discovery service reported a TLS failure; the redundant services connected successfully.
- A 390px touch viewport passed actual relay allocation, settings persistence across reload, clearing credentials, timeout, retry, and cancel during pending connection setup. Browser JavaScript exceptions: zero.

Reports are kept locally under `.local/transfer-*-verification.json`; screenshots are under `output/playwright/transfer-*`. Those files and all test fixture data remain excluded from publication. The upstream engine, existing installed library, user profiles, and retail files were preserved.

Regenerate branded HTML with `node tools/create-winchester-overrides.mjs`. The transfer markup hook preserves the connection controls. The transfer JavaScript override is retained as a project source file; upstream vendor files remain unchanged.
