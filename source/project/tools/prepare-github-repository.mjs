import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifact = resolve(root, '.local/deployment/pages');
const destination = resolve(root, '.local/github-pages');
const manifest = JSON.parse(await readFile(resolve(root, '.local/deployment/package-manifest.json'), 'utf8'));
const expected = new Set([...manifest.pages.map(file => file.name), 'README.md', '.gitignore']);
await mkdir(destination, { recursive: true });
// Preserve this checkout across subsequent deployments, but refuse unrelated files.
async function inspect(path, prefix = '') {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (!prefix && entry.name === '.git') continue;
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink: ${name}`);
    if (entry.isDirectory()) await inspect(resolve(path, entry.name), name + '/');
    else if (!expected.has(name)) throw new Error(`Unexpected publication file: ${name}`);
  }
}
await inspect(destination);
for (const file of manifest.pages) {
  const bytes = await readFile(resolve(artifact, file.name));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Changed artifact: ${file.name}`);
  const target = resolve(destination, file.name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(artifact, file.name), target);
}
await writeFile(resolve(destination, '.gitignore'), '*.big\n*.iso\n*.sav\n*.rep\n.env*\n');
await writeFile(resolve(destination, 'README.md'), await readFile(resolve(root, 'README.md'), 'utf8'));
console.log(`Prepared ${manifest.pages.length + 2} reviewed publication files at ${destination}`);
