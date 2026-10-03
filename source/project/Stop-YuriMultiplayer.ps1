$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.local/yuri-multiplayer/session.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'No saved Yuri hosting session.'; return }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($role in @('tunnel', 'relay')) {
    $processId = $state."${role}Pid"
    $startedAt = $state."${role}StartedAt"
    if (-not $processId) { continue }
    $sessionProcess = Get-Process -Id $processId -ErrorAction SilentlyContinue
    # A stale PID must never stop an unrelated process after Windows reuses it.
    if ($sessionProcess -and $sessionProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTime]$startedAt).ToUniversalTime().Ticks) {
        Stop-Process -Id $processId
    }
}
$state.status = 'stopped'
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath
Write-Host 'Yuri hosting stopped. Restart with .\Start-YuriMultiplayer.ps1 for a new friend link.'
