"""Create a portable project backup without credentials or browser game data."""
import datetime, hashlib, json, pathlib, zipfile, re

root = pathlib.Path(__file__).resolve().parent.parent
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
version = json.loads((root / 'deployment/project.json').read_text())['projectVersion']
if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-preview\.\d+)?', version):
    raise ValueError('Invalid project version.')
destination = root / 'output/backups' / f'Online-Games-v{version}-{stamp}.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
files = {}
def include(path, archive_name=None):
    if path.is_symlink() or not path.is_file():
        raise ValueError(f'Unsupported backup input: {path}')
    files[archive_name or path.relative_to(root).as_posix()] = path

for path in root.iterdir():
    if path.is_file() and (path.suffix.lower() in {'.md', '.ps1', '.yaml'} or path.name in {
        'Dockerfile', '.dockerignore', '.gitignore', 'NewShoes-source.zip'
    }):
        include(path)
for folder in ['tools', 'overrides', 'deployment', 'output/playwright']:
    for path in (root / folder).rglob('*'):
        if path.is_file(): include(path)
# Preserve the reviewed experimental source and runtime at their development paths.
experiment = root / 'experiments/san-andreas'
provenance = json.loads((experiment / 'provenance.json').read_text())
include(experiment / 'provenance.json')
for item in provenance['artifacts']:
    path = experiment / item['path']
    if not path.resolve().is_relative_to(experiment.resolve()):
        raise ValueError('Unsafe experimental backup path.')
    if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise ValueError('Experimental backup checksum mismatch.')
    include(path)
# Preserve the independently packaged Yuri engine and corresponding source.
yuri = root / 'experiments/yuris-revenge'
if (yuri / 'provenance.json').exists():
    include(yuri / 'provenance.json')
    for item in json.loads((yuri / 'provenance.json').read_text())['artifacts']:
        path = yuri / item['path']
        if not path.resolve().is_relative_to(yuri.resolve()):
            raise ValueError('Unsafe Yuri backup path.')
        if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('Yuri backup checksum mismatch.')
        include(path)
# Use the verified static publication inventory, not an unrestricted .local scan.
package = json.loads((root / '.local/deployment/package-manifest.json').read_text())
for item in package['pages']:
    path = root / '.local/deployment/pages' / item['name']
    if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
        raise ValueError(f'Publication file changed: {item["name"]}')
    include(path, 'published-site/' + item['name'])
# Never collect arbitrary setup/config files from .local, even when they are JSON.
# Only verification reports produced by our review tools belong in this backup.
for path in (root / '.local').glob('*verification.json'):
    include(path, 'verification/' + path.name)
for name in ['README.md', '.gitignore']:
    include(root / '.local/github-pages' / name, 'published-site/' + name)
records = []
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, path in sorted(files.items()):
        # No auth/runtime caches, hidden Git dirs, or retail game archives.
        if any(part in {'.git', 'gh', 'node_modules', '__pycache__'} for part in pathlib.PurePosixPath(name).parts):
            raise ValueError(f'Excluded directory in backup: {name}')
        if path.suffix.lower() in {'.big', '.iso', '.bin', '.sav', '.rep'}:
            raise ValueError(f'Game data belongs in its separate backup: {name}')
        data = path.read_bytes()
        records.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        archive.writestr(name, data)
    instructions = '''# Restore Online Games

This backup includes maintained project files, exact upstream source ZIP,
compiled public website, build instructions, project notes and test evidence.

1. Extract this ZIP to a new project directory.
2. To republish the existing build, use published-site/ as the static site.
   It contains the locally compiled engine, service worker, UI, licenses and
   complete corresponding source. No Docker is needed to serve that build.
3. To change and rebuild the engine, follow DOCKER_SETUP.md. Docker extracts
   NewShoes-source.zip inside Linux and applies overrides/. Do not replace
   the archive with a Windows extraction: upstream has case-sensitive paths.
4. Tooling that reads vendor/NewShoes-main expects the original source to be
   extracted there. Keep NewShoes-source.zip intact for Docker builds.
5. Game data is SEPARATE: extract Zero-Hour-backup.zip, visit the website,
   select that extracted folder, then Install in this browser.

GitHub: https://github.com/mustafamarroun-glitch/online-games
Website: https://mustafamarroun-glitch.github.io/online-games/

Not included: account login/admin credentials, private setup files, Docker image/cache, browser storage,
game saves/replays held only in the browser, installed game executables,
optional movies, or unrelated files. Engine binaries ARE in published-site/.
Keep both backup ZIPs on another drive or private storage for laptop recovery.
The public-site TURN client configuration is included because it is part of
the published website. It is distinct from account login/admin credentials.
'''
    archive.writestr('RESTORE.md', instructions)
    archive.writestr('BACKUP-MANIFEST.json', json.dumps({'projectVersion': version, 'createdAt': stamp, 'files': records}, indent=2))
# Verify the completed ZIP by reading every member and checking its content.
with zipfile.ZipFile(destination) as archive:
    if archive.testzip() is not None: raise ValueError('Backup ZIP CRC verification failed.')
    manifest = json.loads(archive.read('BACKUP-MANIFEST.json'))
    if set(archive.namelist()) != set(files) | {'RESTORE.md', 'BACKUP-MANIFEST.json'}:
        raise ValueError('Unexpected backup entries.')
    for item in manifest['files']:
        if hashlib.sha256(archive.read(item['path'])).hexdigest() != item['sha256']:
            raise ValueError(f'Backup checksum mismatch: {item["path"]}')
checksum = hashlib.sha256(destination.read_bytes()).hexdigest()
destination.with_suffix('.zip.sha256').write_text(f'{checksum}  {destination.name}\n')
print(json.dumps({'backup': str(destination), 'bytes': destination.stat().st_size,
                  'files': len(records) + 2, 'sha256': checksum,
                  'verification': 'all entries read, CRC and SHA-256 passed'}, indent=2))
