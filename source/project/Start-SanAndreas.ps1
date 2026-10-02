$ErrorActionPreference = 'Stop'
$taskPreview = 'http://localhost:8083/'
try {
    $taskRequest = @{ Uri = $taskPreview; TimeoutSec = 5; UseBasicParsing = $true }
    if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey('NoProxy')) { $taskRequest.NoProxy = $true }
    $taskResponse = Invoke-WebRequest @taskRequest
    if ($taskResponse.Content -match 'San Andreas|RenderWare') {
        Write-Host "San Andreas preview is already running: $taskPreview"
        exit 0
    }
    throw 'Port 8083 is occupied by another service.'
} catch {
    if ($_.Exception.Message -eq 'Port 8083 is occupied by another service.') { throw }
}
if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'experiments\san-andreas\runtime\index.html'))) {
    throw 'Experimental runtime is missing. See SAN_ANDREAS.md for build instructions.'
}
$taskNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (!$taskNode) {
    $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (!(Test-Path -LiteralPath $taskNode)) { throw 'Node.js is required to run the local preview server.' }
Write-Host "Open $taskPreview in Chrome or Edge, run San Andreas, and choose your installed game folder."
& $taskNode (Join-Path $PSScriptRoot 'tools\serve-san-andreas-preview.mjs')
