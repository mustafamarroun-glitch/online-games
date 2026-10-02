"""Preserve the experimental runtime and its corresponding source, without game data."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
source = root / '.local' / 'opensa'
target = root / 'experiments' / 'san-andreas'
target.mkdir(parents=True, exist_ok=True)
git = ['git', '-c', f'safe.directory={source.as_posix()}', '-C', str(source)]
revision = subprocess.check_output(git + ['rev-parse', 'HEAD'], text=True).strip()
tracked = subprocess.check_output(git + ['ls-files', '-z']).decode().split('\0')
extra = ['packages/loaders/src/asset-local-loader/runtime-files.ts', 'packages/loaders/src/asset-local-loader/runtime-files.test.ts', 'packages/loaders/src/asset-local-loader/folder-upload.ts', 'packages/loaders/src/asset-local-loader/folder-upload.test.ts', 'apps/web/src/assets/winchester.svg']
with zipfile.ZipFile(target / 'OpenSA-preview-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name in sorted(set(tracked + extra)):
        if name and (source / name).is_file():
            archive.write(source / name, name)
shutil.copyfile(source / 'LICENSE', target / 'LICENSE')
runtime = target / 'runtime'
if runtime.resolve() != (root / 'experiments' / 'san-andreas' / 'runtime').resolve():
    raise RuntimeError('Unexpected runtime output path')
if runtime.exists():
    shutil.rmtree(runtime)
shutil.copytree(source / 'dist', runtime)
index = target / 'runtime' / 'index.html'
html = index.read_text(encoding='utf-8')
html = html.replace('<title>OpenSA — an open-source game engine compatible with RenderWare (GTA San Andreas), in the browser</title>', '<title>Winchester OS · San Andreas experiment</title>')
html = html.replace('href="/', 'href="./')
html = html.replace('</body>', '<a href="./OpenSA-preview-source.zip" style="position:fixed;bottom:12px;left:16px;color:white;font:12px sans-serif;z-index:10000">OpenSA preview source (AGPL-3.0)</a></body>')
index.write_text(html, encoding='utf-8')
manifest_file = runtime / 'site.webmanifest'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
for icon in manifest['icons']:
    icon['src'] = './' + icon['src'].lstrip('/')
manifest_file.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
artifacts = []
for file in sorted(target.rglob('*')):
    if file.is_file() and file.name != 'provenance.json':
        artifacts.append({'path': file.relative_to(target).as_posix(), 'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
provenance = {
    'baseline': 'https://github.com/Avatarchik/opensa',
    'revision': revision,
    'engineVersion': '0.2.0',
    'license': 'AGPL-3.0-only',
    'date': '2026-10-02',
    'scope': 'Winchester OS solo exploration preview. No campaign or multiplayer. Local folder selection supports native handles and a webkitdirectory fallback.',
    'changes': ['Filter unused native files/audio/archive data from loose VFS imports', 'Limit the catalogue to user-provided San Andreas files', 'Identify Winchester experimental scope and preserve corresponding source', 'Add actual File-based folder selection when showDirectoryPicker is unavailable', 'Keep fallback-selected files in the current desktop session without copying archives to IndexedDB', 'Use the Winchester mark and accessible folder-loading feedback'],
    'buildDependencyReview': 'Lockfile-only advisory patches in package.json/package-lock.json; lifecycle scripts disabled. The previously verified compiled runtime is unchanged, and a fresh source build remains unverified.',
    'artifacts': artifacts,
}
(target / 'provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
print(json.dumps({'revision': revision, 'artifacts': len(artifacts), 'bytes': sum(item['bytes'] for item in artifacts), 'path': str(target)}))
