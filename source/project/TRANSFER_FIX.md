# Device transfer connection repair

The reported failure happened after SDP exchange, before the WebRTC data channel opened. The original transfer room configured discovery only and supplied no TURN fallback. A discovery relay pairs devices; it does not relay file traffic around restrictive NATs, VPNs, or firewalls.

The Winchester override now loads STUN/TURN configuration before joining the room. Direct connections remain available. Connection settings accept TURN addresses and credentials, provide a real relay-allocation test, and keep manually entered credentials in the current browser tab. A timed-out or disconnected receiver can retry the same active PIN. Disconnect invalidates queued messages and stops the sender's old stream. A retry starts a fresh transfer; acknowledgements include its transfer ID so stale responses cannot complete a new checkpoint. Cancel aborts pending configuration requests; stale room callbacks cannot reopen a stopped session or overwrite a newer one. Connection and progress messages distinguish waiting, failure, and received data.

## Enable the internet fallback

The website configuration includes the account's free ExpressTURN relay over UDP and TCP on port 3478. Once this configuration is published, both devices load it automatically and need only the transfer PIN. Connection settings can test the website relay without entering its credentials. A manual tab relay can override the website configuration; clearing it restores the website relay.

These are TURN client credentials, not an account login or administration key. A static website serves them publicly, so other visitors can consume the shared relay allowance. Publishing this configuration requires the account owner's approval. The private testing configuration and verification data under `.local` are excluded from packaging.

Obtain a TURN service account, then use either setup:

1. In Game File Transfer → Connection settings on both devices, enter the service's `turn:`/`turns:` addresses, username, and password. Select Test relay. After it responds, start a new transfer. Manual credentials last for that tab only.
2. For centrally managed credentials, configure `overrides/harness/device-transfer-network.json`. `credentialEndpoint` accepts an HTTPS URL returning an array of RTCIceServer objects. Use a service that issues time-limited, limited-access credentials and supports browser CORS. Keep service administration keys out of the website and Git history. An endpoint failure is reported before creating a room. `iceServers` can also contain public/client-scoped TURN credentials; that configuration is served publicly.

Files remain encrypted with the ephemeral PIN inside the WebRTC channel, including when a TURN server forwards them. No game files are sent through the public Nostr discovery services. Leave both devices' pages open throughout the transfer. Phones may suspend transfers if their screen locks or their browser moves to the background.

ExpressTURN advertises 1000 GB/month in its free plan at https://www.expressturn.com/. The signed-in dashboard confirmed Free mode without a payment method. Its free plan uses port 3478; it does not provide the paid firewall-bypass ports. Same-relay connections with both endpoints forced to relay failed in testing, while a relayed endpoint connected to a peer with a reachable STUN address. This is a tested limitation, not a guarantee that every Wi-Fi, VPN or mobile network will connect. Free relay transfers were slow in testing.

The transfer app uses its own Trystero build with two speculative offers instead of twenty, reducing idle TURN allocations. The game multiplayer library remains the upstream copy. `tools/create-transfer-overrides.mjs` regenerates the transfer-specific copy and refuses an unexpected upstream pool definition.

## Verification on October 2, 2026

- Two isolated receivers, including a portrait viewport, each received 17 generated archive fixtures and an installed mod. The largest fixture exceeded the 2 MiB acknowledgement checkpoint. SHA-256 matched for every complete received archive. Approximately 3 MiB was delivered to each receiver; a full retail-sized installation was not retested.
- The same delivery test passed with native WebRTC's direct paths disabled (`iceTransportPolicy: relay`) and a real coturn server. Selected candidate pairs were verified to use TURN. The server was local and temporary; this is relay-path integration evidence, not a remote-network acceptance test.
- Shipping public Nostr discovery paired the isolated browser profiles and delivered their files. One optional discovery service reported a TLS failure; the redundant services connected successfully.
- A 390px touch viewport passed actual relay allocation, settings persistence across reload, clearing credentials, timeout, retry, and cancel during pending connection setup. Browser JavaScript exceptions: zero.
- ExpressTURN allocated candidates over UDP and TCP, and a 390px viewport passed the automatic website relay status/test controls. The existing credentials were read with the dashboard's Copy controls; browser DOM inspection masks them and cannot provide usable values.
- A real WebRTC connection was deliberately closed while generated file data was pending. Retrying the same active PIN completed a fresh 3 MiB transfer with all 17 archive hashes and its mod verified. The stopped stream did not overwrite the new transfer or its acknowledgement state.
- The GitHub Pages package passed a transfer using public discovery and the actual ExpressTURN configuration, with the receiver forced onto a verified TURN candidate. All 17 generated archives and the installed mod arrived with matching hashes; the largest archive crossed the 2 MiB acknowledgement checkpoint. Browser JavaScript exceptions: zero. This used isolated browser profiles, not the owner's physical phone and computer, and did not test a full retail-sized installation.

Reports are kept locally under `.local/transfer-*-verification.json`; screenshots are under `output/playwright/transfer-*`. Those files and all test fixture data remain excluded from publication. The upstream engine, existing installed library, user profiles, and retail files were preserved.

Regenerate branded HTML with `node tools/create-winchester-overrides.mjs`. The transfer markup hook preserves the connection controls. The transfer JavaScript override is retained as a project source file; upstream vendor files remain unchanged.
