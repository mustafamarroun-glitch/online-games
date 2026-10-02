param(
    [ValidateSet('Docker', 'Prebuilt', 'Packaged')]
    [string]$Runtime = 'Docker'
)

$ErrorActionPreference = 'Stop'
$previousUpstream = $env:GAME_UPSTREAM
$previousPackaged = $env:GAME_PACKAGED
Push-Location $PSScriptRoot
try {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js is required to run the local preview.'
    }
    if ($Runtime -eq 'Docker') {
        $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
        $dockerExecutable = if ($dockerCommand) { $dockerCommand.Source } else {
            Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
        }
        if (-not (Test-Path -LiteralPath $dockerExecutable)) {
            throw 'Docker Desktop was not found. See DOCKER_SETUP.md or use -Runtime Prebuilt.'
        }
        & $dockerExecutable image inspect online-games-zeroh:local --format '{{.Id}}'
        if ($LASTEXITCODE -ne 0) {
            throw 'Start Docker Desktop and build the image using DOCKER_SETUP.md before launching.'
        }
        & $dockerExecutable compose up -d zeroh
        if ($LASTEXITCODE -ne 0) { throw 'The local game container could not start.' }
        $env:GAME_UPSTREAM = 'http://127.0.0.1:8080'
    } elseif ($Runtime -eq 'Packaged') {
        Remove-Item Env:GAME_UPSTREAM -ErrorAction SilentlyContinue
        $env:GAME_PACKAGED = '1'
        if (-not (Test-Path -LiteralPath '.local/github-pages/dist-threaded-release/cnc-port.wasm')) {
            throw 'The retained compiled V1 website package is missing. Use the Docker runtime.'
        }
    } else {
        Remove-Item Env:GAME_UPSTREAM -ErrorAction SilentlyContinue
        if (-not (Test-Path -LiteralPath '.local/prebuilt/dist-threaded-release/provenance.json')) {
            throw 'The matched prebuilt runtime is missing. Run tools/fetch-prebuilt-runtime.ps1 first.'
        }
    }
    Write-Host 'Open http://localhost:8081/harness/play.html. Ctrl+C stops the preview.'
    & node tools/serve-local-preview.mjs
    if ($LASTEXITCODE -ne 0) { throw 'The preview server exited with an error.' }
} finally {
    if ($null -eq $previousUpstream) {
        Remove-Item Env:GAME_UPSTREAM -ErrorAction SilentlyContinue
    } else {
        $env:GAME_UPSTREAM = $previousUpstream
    }
    if ($null -eq $previousPackaged) {
        Remove-Item Env:GAME_PACKAGED -ErrorAction SilentlyContinue
    } else {
        $env:GAME_PACKAGED = $previousPackaged
    }
    Pop-Location
}
