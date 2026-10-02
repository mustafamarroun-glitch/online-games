$ErrorActionPreference = 'Stop'
$expectedCommit = '3ccaa0e9af66889be183ca910851e881d47d437c'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.local/prebuilt/dist-threaded-release'
$metadataUrl = 'https://newshoes.gg/harness/build-info.json'
$before = Invoke-RestMethod -Uri $metadataUrl -TimeoutSec 30
if ($before.git.commit -ne $expectedCommit -or $before.git.dirty) {
    throw 'Official runtime source revision does not match the retained source snapshot.'
}
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$files = @()
foreach ($name in @('cnc-port.js', 'cnc-port.wasm', 'cnc-port.worker.js')) {
    $target = Join-Path $runtimeRoot $name
    $url = 'https://newshoes.gg/dist-threaded-release/' + $name
    Invoke-WebRequest -Uri $url -OutFile $target -TimeoutSec 180
    $files += [ordered]@{
        name = $name
        url = $url
        bytes = (Get-Item -LiteralPath $target).Length
        sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}
$after = Invoke-RestMethod -Uri $metadataUrl -TimeoutSec 30
if ($after.git.commit -ne $expectedCommit -or $after.generatedAt -ne $before.generatedAt) {
    throw 'Official runtime changed while downloading. Do not use this bundle.'
}
$manifest = [ordered]@{
    fetchedAt = [DateTime]::UtcNow.ToString('o')
    origin = 'Official newshoes.gg prebuilt browser runtime; not locally compiled'
    expectedCommit = $expectedCommit
    metadata = $before
    files = $files
}
$manifest | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $runtimeRoot 'provenance.json') -Encoding utf8
$files | ForEach-Object { [pscustomobject]$_ } | Format-Table name,bytes,sha256
