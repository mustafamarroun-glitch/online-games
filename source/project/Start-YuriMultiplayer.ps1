param(
    [ValidateRange(1024, 65535)][int]$Port = 15176,
    [switch]$LocalOnly
)
$ErrorActionPreference = 'Stop'
$sessionFolder = Join-Path $PSScriptRoot '.local/yuri-multiplayer'
$statePath = Join-Path $sessionFolder 'session.json'
New-Item -ItemType Directory -Force -Path $sessionFolder | Out-Null
if (Test-Path -LiteralPath $statePath) {
    $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $previousProcess = Get-Process -Id $previous.relayPid -ErrorAction SilentlyContinue
    if ($previousProcess -and $previousProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTime]$previous.relayStartedAt).ToUniversalTime().Ticks) {
        if ($previous.tunnelPid) {
            $previousTunnel = Get-Process -Id $previous.tunnelPid -ErrorAction SilentlyContinue
            if (-not $previousTunnel -or $previousTunnel.StartTime.ToUniversalTime().Ticks -ne ([DateTime]$previous.tunnelStartedAt).ToUniversalTime().Ticks) {
                throw 'The relay is running but its public tunnel has stopped. Run Stop-YuriMultiplayer.ps1, then restart hosting.'
            }
        }
        Write-Host "Yuri hosting is already running. Share: $($previous.gameUrl)"
        Write-Host 'Use Stop-YuriMultiplayer.ps1 before changing the hosting session.'
        return
    }
}
$node = (Get-Command node -ErrorAction Stop).Source
$cloudflared = Join-Path $sessionFolder 'cloudflared.exe'
if (-not $LocalOnly) {
    $expectedHash = 'f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2'
    if (-not (Test-Path -LiteralPath $cloudflared)) {
        Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/download/2026.9.3/cloudflared-windows-amd64.exe' -OutFile $cloudflared
    }
    if ((Get-FileHash -LiteralPath $cloudflared -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
        throw 'Cloudflare connector checksum mismatch. Remove the project-local connector and rerun.'
    }
}
$room = 'yuri-' + [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(12)).ToLowerInvariant()
$relayProcess = $null
$tunnelProcess = $null
try {
    $serverPath = Join-Path $PSScriptRoot 'tools/serve-yuri-multiplayer.mjs'
    $relayProcess = Start-Process -FilePath $node -ArgumentList @(('"' + $serverPath + '"'), '--port', $Port, '--room', $room) -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $sessionFolder 'relay.log') -RedirectStandardError (Join-Path $sessionFolder 'relay-error.log')
    $localUrl = "http://127.0.0.1:$Port"
    $ready = $false
    for ($i = 0; $i -lt 50; $i++) {
        try {
            $health = Invoke-RestMethod -Uri "$localUrl/healthz" -TimeoutSec 2
            if ($health.ok -and $health.service -eq 'winchester-yuri-multiplayer') { $ready = $true; break }
        } catch { }
        if ($relayProcess.HasExited) { throw (Get-Content -LiteralPath (Join-Path $sessionFolder 'relay-error.log') -Raw) }
        Start-Sleep -Milliseconds 200
    }
    if (-not $ready) { throw 'Yuri relay did not become ready. Check .local/yuri-multiplayer/relay-error.log.' }
    $publicUrl = $localUrl
    if (-not $LocalOnly) {
        # Supply an empty project-owned config instead of reading an unrelated user's tunnel configuration.
        $configPath = Join-Path $sessionFolder 'tunnel-config.yml'
        Set-Content -LiteralPath $configPath -Value '{}'
        $tunnelProcess = Start-Process -FilePath $cloudflared -ArgumentList @('tunnel', '--config', ('"' + $configPath + '"'), '--url', $localUrl, '--no-autoupdate', '--protocol', 'auto', '--edge-ip-version', '4') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $sessionFolder 'tunnel.log') -RedirectStandardError (Join-Path $sessionFolder 'tunnel-error.log')
        $publicUrl = $null
        for ($i = 0; $i -lt 90; $i++) {
            $log = (Get-Content -LiteralPath (Join-Path $sessionFolder 'tunnel-error.log') -Raw -ErrorAction SilentlyContinue) + (Get-Content -LiteralPath (Join-Path $sessionFolder 'tunnel.log') -Raw -ErrorAction SilentlyContinue)
            if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $publicUrl = $Matches[0]; break }
            if ($tunnelProcess.HasExited) { throw "Cloudflare tunnel exited: $log" }
            Start-Sleep -Milliseconds 500
        }
        if (-not $publicUrl) { throw 'Cloudflare did not return a public address. Check .local/yuri-multiplayer/tunnel-error.log.' }
        $publicReady = $false
        for ($i = 0; $i -lt 30; $i++) {
            try {
                $health = Invoke-RestMethod -Uri "$publicUrl/healthz" -TimeoutSec 2
                if ($health.ok -and $health.service -eq 'winchester-yuri-multiplayer') { $publicReady = $true; break }
            } catch { }
            if ($tunnelProcess.HasExited) { throw 'Cloudflare stopped before its public service became reachable.' }
            Start-Sleep -Milliseconds 500
        }
        if (-not $publicReady) { throw 'The public tunnel is not reachable yet. Check .local/yuri-multiplayer/tunnel-error.log, then restart hosting.' }
    }
    $relayAddress = ([Uri]$publicUrl).Authority + '/' + $room
    $gameUrl = "$publicUrl/play/?network=1&relay=$([Uri]::EscapeDataString($relayAddress))"
    $state = [ordered]@{
        status = 'running'; publicUrl = $publicUrl; gameUrl = $gameUrl
        relayUrl = ($(if ($LocalOnly) { 'ws://' } else { 'wss://' }) + $relayAddress)
        localUrl = $localUrl; room = $room
        relayPid = $relayProcess.Id; relayStartedAt = $relayProcess.StartTime.ToUniversalTime().ToString('o')
        tunnelPid = $(if ($tunnelProcess) { $tunnelProcess.Id } else { $null })
        tunnelStartedAt = $(if ($tunnelProcess) { $tunnelProcess.StartTime.ToUniversalTime().ToString('o') } else { $null })
        createdAt = [DateTime]::UtcNow.ToString('o'); hosting = $(if ($LocalOnly) { 'Loopback test only' } else { 'Temporary Cloudflare Quick Tunnel' })
    }
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath
    if ($LocalOnly) { Write-Host "Local test link (this computer only): $gameUrl" }
    else { Write-Host "Share this game link with your friend: $gameUrl" }
    Write-Host 'Both players select their own complete Yuri installation, choose Yuri if prompted, then open Network in the game.'
    Write-Host 'The host creates a game; the friend joins, confirms readiness, and the host starts.'
    Write-Host 'Keep this computer awake and online. Stop hosting with .\Stop-YuriMultiplayer.ps1.'
    Write-Host 'Temporary addresses change after restarting. Two-player gameplay still needs verification.'
} catch {
    if ($tunnelProcess -and -not $tunnelProcess.HasExited) { Stop-Process -Id $tunnelProcess.Id }
    if ($relayProcess -and -not $relayProcess.HasExited) { Stop-Process -Id $relayProcess.Id }
    throw
}
