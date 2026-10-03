"""Package compiled engine code, notices and corresponding source; no game files."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / '.local/ra2-vm/source'
target = root / 'experiments/yuris-revenge'
commit = 'a10ac9899c258b01be1edd80492397e9de225ba5'
git_args = [os.environ.get('WINCHESTER_GIT', 'git'), '-c', f'safe.directory={source.as_posix()}']
if subprocess.check_output(git_args + ['rev-parse', 'HEAD'], cwd=source, text=True).strip() != commit:
    raise ValueError('Unexpected engine revision')
target.mkdir(parents=True, exist_ok=True)
runtime = target / 'runtime'
if runtime.exists():
    if runtime.resolve() != (root / 'experiments/yuris-revenge/runtime').resolve():
        raise ValueError('Unsafe runtime destination')
    shutil.rmtree(runtime)
runtime.mkdir()
excluded = {'sw.js', 'manifest.webmanifest', 'favicon.ico', 'apple-touch-icon.png'}
firmware = {p.name: p.with_suffix('.rom').name for p in (source / 'dist/assets').glob('boot-*.bin')}
if len(firmware) != 1:
    raise ValueError('Expected exactly one custom RA2 VM firmware artifact')
for path in (source / 'dist').rglob('*'):
    if not path.is_file():
        continue
    name = path.relative_to(source / 'dist')
    if name.parts[0] in {'theme', 'icons'} or path.name in excluded or path.name.startswith('favicon-'):
        continue
    if path.suffix.lower() in {'.exe', '.dll', '.mix', '.sav', '.rep'}:
        raise ValueError(f'Retail input in engine build: {name}')
    destination = runtime / (name.parent / firmware.get(name.name, name.name))
    destination.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix in {'.js', '.html'}:
        text = path.read_text(encoding='utf-8')
        for original, renamed in firmware.items():
            text = text.replace(original, renamed)
        destination.write_text(text, encoding='utf-8')
    else:
        shutil.copyfile(path, destination)
shutil.copyfile(source / 'LICENSE', target / 'LICENSE')
shutil.copyfile(source / 'docs/THIRD_PARTY.md', target / 'THIRD_PARTY.md')
with (target / 'THIRD_PARTY_LICENSES.txt').open('w', encoding='utf-8') as output:
    for package in ['v86', 'react', 'react-dom', 'scheduler', '7z-wasm', 'fflate', 'qrcode', 'dijkstrajs']:
        folder = source / 'node_modules' / package
        if not folder.exists():
            candidates = list((source / 'node_modules/.pnpm').glob(f'{package}@*/node_modules/{package}'))
            folder = candidates[0] if candidates else folder
        licenses = [p for p in folder.rglob('*') if p.is_file() and p.name.upper().startswith(('LICENSE', 'COPYING')) and 'node_modules' not in p.relative_to(folder).parts]
        if not licenses:
            raise ValueError(f'Missing dependency license: {package}')
        for path in licenses:
            output.write(f'\n===== {package}: {path.relative_to(folder).as_posix()} =====\n')
            output.write(path.read_text(encoding='utf-8', errors='replace'))
    output.write('\n===== relay-package =====\n')
    output.write((source / 'packages/relay/LICENSE').read_text())
tracked = subprocess.check_output(git_args + ['ls-files', '-z'], cwd=source).decode().split('\0')
with zipfile.ZipFile(target / 'RA2-VM-source.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in tracked:
        if not name or name.startswith(('public/theme/', 'public/icons/')) or Path(name).name.startswith('favicon') or name in {'public/apple-touch-icon.png', 'CLAUDE.md'}:
            continue
        path = source / name
        if path.is_file():
            archive.write(path, name)
    archive.write(source / 'public/winchester-mark.svg', 'public/winchester-mark.svg')
    archive.write(source / 'public/winchester-library.json', 'public/winchester-library.json')
    archive.write(root / 'tools/prepare-yuri-runtime.mjs', 'winchester-integration/prepare-yuri-runtime.mjs')
    archive.write(root / 'tools/yuri-menu.css', 'winchester-integration/yuri-menu.css')
    archive.write(root / 'tools/package-yuri-runtime.py', 'winchester-integration/package-yuri-runtime.py')
    archive.writestr('WINCHESTER_BUILD.md', 'Pinned RA2 VM revision: ' + commit + '\n\nIntegration removes the separate service worker and unlicensed menu plates, uses CSS buttons and Winchester artwork. Install with pnpm 11.24.0 using pnpm install --frozen-lockfile. Run pnpm run check, then pnpm exec vite build --base ./ to reproduce runtime/. Game programs and assets are supplied separately by the player.\n')
artifacts = []
for path in sorted(target.rglob('*')):
    if path.is_file() and path.name != 'provenance.json':
        data = path.read_bytes()
        artifacts.append({'path': path.relative_to(target).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
provenance = {'engine': 'RA2 VM', 'version': '0.1.0', 'upstream': 'https://github.com/ra2-games/ra2', 'commit': commit,
              'license': 'GPL-3.0-or-later', 'status': 'Alpha; local gameplay requires player-owned installation',
              'changes': ['Relative build base', 'No game-specific service worker', 'CSS menu instead of unlicensed plates', 'Winchester artwork and textual game labels', 'Validated import completion message for desktop shortcuts', 'Source-derived required-file cache manifest', 'Original LF shader bytes', 'Custom firmware extension .rom; content unchanged'], 'artifacts': artifacts}
(target / 'provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
print(json.dumps({'files': len(artifacts), 'bytes': sum(p['bytes'] for p in artifacts), 'commit': commit}))
