# Winchester OS: PC-hosted streaming prototype

This adds one independent browser session on the host PC for the Mac friend.
The host plays locally in their existing Windows browser. Both Zero Hour
instances run on the host PC; the friend receives video/audio and sends inputs.
The current Winchester OS interface and reviewed engine package are reused.
The stream is not a multiplayer connection by itself: the two game instances
still need to create/join a Zero Hour room. In-game AI armies do not need extra
streaming sessions, but add game simulation load.

## Restore point

Before this prototype, all 427 backup entries passed CRC and SHA-256 checks:
`output/backups/Online-Games-v3.0.0-preview.1-20261003T011104Z.zip`.
The original public website and game engine have not been changed or republished.

## Start and stop

Start Docker Desktop in Linux-container mode, then run from the project folder:

```powershell
.\Start-Streaming.ps1
```

### First milestone: local-network streaming

For the first version, connect the PC and Mac to the same router (ordinary
Wi-Fi or Ethernet, not an isolated guest network). The PC runs both game
instances; the Mac runs only the streaming client in its browser. Local video
and input traffic do not traverse the internet. No rented server, Tailscale,
public tunnel, or router forwarding is needed for this stage.

```powershell
.\Start-Streaming.ps1 -Lan
```

The helper selects the only active gateway adapter. If several adapters are
active, specify the home-network address explicitly:

```powershell
.\Start-Streaming.ps1 -Lan -LanAddress 192.168.1.67
```

The currently inspected host address is `192.168.1.67`; the Mac's browser URL
is `https://192.168.1.67:3001/`. DHCP may change this address later: use the
address printed by the helper. The username is `winchester`; the private
password is in `.local/streaming/password`. Accept this known LAN host's
self-signed certificate on the first visit.

If Windows blocks the other device, open PowerShell **as Administrator** and
run this once from the project directory:

```powershell
.\Enable-StreamingLAN.ps1 -LanAddress 192.168.1.67
```

The reviewed rule permits TCP port 3001 on that adapter and address from
`192.168.1.0/24` only. It supports the current Public network profile without
changing the profile or enabling general discovery/file sharing. The current
agent process does not have a Windows administrator token; the rule has been
previewed with `-WhatIf`, not installed. To remove the named rule later, run
`Enable-StreamingLAN.ps1 -Remove` as Administrator.

The stream is verified on the host PC through its LAN address. Acceptance
from an actual second device still requires the router, Windows firewall and
browser checks. The game's existing multiplayer discovery uses internet
relays, so LAN streaming is not a claim of fully offline multiplayer. Test
two independent game instances in a room with AI armies before claiming that
match works. A local discovery/relay path can be added as a separate milestone.

To validate the local prerequisites and Compose configuration without starting
or downloading a container, use `.\Start-Streaming.ps1 -CheckOnly`.

For a different compatible installation:

```powershell
.\Start-Streaming.ps1 -GameDirectory 'D:\Games\Zero Hour\Data'
```

Open `https://localhost:3001/`. For this LOCAL preview, accept the self-signed
certificate. The username is `winchester`; the generated password is in
`.local/streaming/password`. Do not publish or commit that file. Wait for the
container services to initialize after first startup.

Inside the streamed Winchester OS, use its existing folder picker to select
`/mnt/zero-hour`, then Install in this browser and Launch game. This is a
private, read-only mount of the local installation. Game code is served from a
separate root; no retail archive is served by the game-code HTTP server.
The browser's imported library and saves persist under `.local/streaming/friend`.
They are separate from the host's existing Windows-browser library and saves.

For the host's ordinary local game:

```powershell
.\Start-Local.ps1 -Runtime Packaged
```

The existing preview helper retains the host origin `http://localhost:8081`.
The friend's `localhost:8081` is inside a separate container network namespace.
It cannot conflict with the host browser's origin or storage.

Stop streaming without deleting the profile, library or saves:

```powershell
.\Stop-Streaming.ps1
```

The first successful startup records the downloaded image's registry digest in
`.local/streaming/image.txt`; subsequent starts use that exact image. Updates
should be intentional and retested.

## Local boundaries and remote access

Default mode publishes only `127.0.0.1:3001`. LAN mode publishes only the
validated private IPv4 adapter address on port 3001. The game-code server binds
to container loopback. No router forwarding, public tunnels, account signups,
or paid services are configured. The optional administrator firewall helper
changes only the named LAN streaming rule. Host Docker control, the
project root, Windows home directory and public credentials are not mounted.
Desktop tools, sudo, terminal UI, clipboard, stream sharing and file-transfer
features are disabled. The stream profile remains a trusted-friend session,
not a general-purpose sandbox for strangers.

Once local streaming and gameplay pass, select the remote path:

- Same router: use `Start-Streaming.ps1 -Lan`, configure the restricted firewall
  rule if needed, then test the actual Mac.
- Separate homes: configure authenticated HTTPS access or a private VPN path,
  then test the actual Mac. Do not expose this container publicly using only
  its local-preview password or a bare anonymous tunnel.

The LAN link exists at the address printed by the helper; Mac acceptance is
still pending. No internet link is configured.

## Initial settings and network observations

Start at 1280x720, 30 fps and a 3 Mbps H.264 video target, plus audio and overhead.
The first prototype uses Selkies' WebSocket transport. WebRTC is an optional
later path requiring explicit networking and connectivity validation.
No GPU passthrough is assumed: an RTX 3050 installed on Windows does not prove
Linux graphics/encoding access through Docker Desktop. Check the actual renderer
and encoder before claiming GPU acceleration. Software performance with a full
match and bots must be measured.

The tested prototype uses X11 capture and explicit Chromium SwiftShader software
graphics. The original default graphics path showed a black game picture;
software rendering produced a visible menu and bot skirmish. Container logs
confirmed CPU x264 encoding, with NVENC unavailable. The private session opts
into `--enable-unsafe-swiftshader`, which lowers Chromium's graphics-process
security guarantees; use it only for this trusted game session. See
[Chromium's software-renderer documentation](https://github.com/chromium/chromium/blob/main/docs/gpu/swiftshader.md).
Do not describe this prototype as GPU accelerated. A sample during the one-bot
skirmish used about 963% Docker CPU (about 9.6 logical cores) and 1.76 GiB container
memory. This is a resource sample, not a measured game frame rate or latency.
Performance tuning and a simultaneous host-player test are still needed.

Host hardware inspected: Acer Nitro ANV15-52, Intel Core 5 210H (8 cores/12
threads), about 16 GB RAM, RTX 3050 6 GB laptop GPU. The host runs two game
instances, so RAM, CPU, thermals and the selected number of AI armies matter.

The user reported Cloudflare results on October 3, 2026: 6.68 Mbps download,
16.1 Mbps upload, latency about 57–71 ms, jitter about 99–161 ms and 7.6% packet
loss. The upload rate permits a modest trial, but instability may cause freezes
and input delay. These measurements are to Cloudflare, not the Mac. The friend's
connection was described as having similar speed, in a separate home.
Recheck with Ethernet and no background
downloads, then measure the actual stream.

## Verification gates

Passed so far: reviewed package's WASM checksum; local HTTP MIME and isolation
headers; blocked traversal, hidden-file paths, retail archive requests,
directory listings and uploads; Winchester OS render at 1280x720, shared memory,
and opening Settings in a disposable Chromium profile with no page exceptions.
The report is `.local/streaming/local-game-verification.json`; screenshot is
`output/playwright/streaming-local-game-server.png`.

Passed for the LAN adapter: actual container startup, HTTPS through the host's
LAN address, missing/wrong-password rejection (401) and correct-login acceptance
(200), real nonblank decoded 1280x720 stream frames increasing over time, and
visible mouse/keyboard effects in the remote Settings window. Kiosk mode hides
the hosting browser's window controls so minimizing it cannot blank the stream.
The actual read-only game folder validated as 17 archives in the streamed
browser, and installation completed in its persistent private profile.

The game reached its 3D main menu and started a solo skirmish on Alpine Assault
against one Easy Army bot. A streamed mouse click queued a GLA worker and
changed the cash display from $10,000 to $9,800, showing the input reached the
game simulation. Decoded stream checks passed during that skirmish: 1280x720,
nonblank frames increasing over time, and no client page exceptions.
`output/playwright/streaming-lan-bot-worker-trained.png` records the game action.
This establishes launch and a short bot-skirmish interaction, not completion
of a match, acceptable frame rate, or two-human multiplayer. `Ctrl+Alt+Escape`
returned the test to the launcher; the imported library remains ready.

Pending: audio playback acceptance, acceptable CPU/GPU
performance, the Mac connection, two independent players in a multiplayer room
with AI armies, and a sustained match. A successful HTTP response or Compose
configuration alone does not establish these outcomes.

The local and LAN setup preflights also passed using `Start-Streaming.ps1 -CheckOnly`.
The image download encountered a GitHub-registry connection timeout and a
Docker-Hub DNS failure. A subsequent official-image retry downloaded additional
layers and completed successfully. The running image is pinned in
`.local/streaming/image.txt` at digest
`sha256:2d32e1b2b28aa92973aa0f58c433c0b045db6e1224d7001eeaa9cde1a474ce13`.
The stream verification report is `.local/streaming/stream-verification.json`;
observed control evidence is in `output/playwright/streaming-lan-after-input.png`
and `output/playwright/streaming-lan-keyboard.png`. These are host-PC checks,
not an actual Mac or completed multiplayer match.

Sources: [LinuxServer Chromium](https://docs.linuxserver.io/images/docker-chromium/),
[Selkies configuration](https://docs.linuxserver.io/selkies/user-guide/configuration/),
[Selkies security](https://docs.linuxserver.io/selkies/user-guide/security/).
