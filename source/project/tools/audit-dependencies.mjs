import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const semver = require('semver');
const root = new URL('../',import.meta.url);
const lockPath = process.argv[2] || 'overrides/build/package-lock.json';
const lock = JSON.parse(await readFile(new URL(lockPath,root),'utf8'));
const versions = new Map();
for (const [path,entry] of Object.entries(lock.packages)) {
  if (!path.includes('node_modules/') || !semver.valid(entry.version)) continue;
  const name = path.split('node_modules/').at(-1);
  if (!versions.has(name)) versions.set(name,new Set());
  versions.get(name).add(entry.version);
}
// Send only public package names/versions to npm's documented bulk advisory API.
const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',{
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify(Object.fromEntries([...versions].map(([name,items])=>[name,[...items]]))),
  signal:AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`npm advisory lookup failed: HTTP ${response.status}`);
const advisories = await response.json();
const affected = [];
for (const [name,items] of Object.entries(advisories)) {
  for (const advisory of items) {
    const installed = [...(versions.get(name) ?? [])].filter(version=>semver.satisfies(version,advisory.vulnerable_versions));
    if (installed.length) affected.push({name,installed,title:advisory.title,severity:advisory.severity,url:advisory.url,range:advisory.vulnerable_versions});
  }
}
const report = {checkedAt:new Date().toISOString(),lockPath,source:'npm public bulk advisory API',packages:versions.size,
  affected, scope:'Locked JavaScript build/browser dependencies. The compiled C++/WASM and embedded 7-Zip require separate review.'};
await writeFile(new URL(process.argv[3] || '.local/v3-dependency-verification.json',root),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
