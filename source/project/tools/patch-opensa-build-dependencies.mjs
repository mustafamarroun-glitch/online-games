import { readFile,writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const semver=createRequire(import.meta.url)('semver');
const root=new URL('../',import.meta.url);
const report=JSON.parse(await readFile(new URL('.local/v3-opensa-dependency-verification.json',root),'utf8'));
const file=new URL('.local/opensa/package.json',root);
const pkg=JSON.parse(await readFile(file,'utf8'));
const names=[...new Set(report.affected.map(item=>item.name))];
pkg.overrides={...pkg.overrides};
const changes=[];
for(const name of names){
  const items=report.affected.filter(item=>item.name===name);
  const response=await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Could not check ${name}`);
  const info=await response.json();
  const available=Object.keys(info.versions).filter(version=>semver.valid(version)&&!semver.prerelease(version));
  for(const major of [...new Set(items.flatMap(item=>item.installed).map(semver.major))]){
    const current=items.flatMap(item=>item.installed).filter(version=>semver.major(version)===major).sort(semver.rcompare)[0];
    const safe=available.filter(version=>semver.gte(version,current)&&items.every(item=>!semver.satisfies(version,item.range))).sort(semver.compare);
    const version=safe.find(version=>semver.major(version)===major) || safe[0];
    if(!version)throw new Error(`No patch available: ${name}`);
    if(pkg.devDependencies?.[name]) { pkg.devDependencies[name]=version; pkg.overrides[name]=`$${name}`; }
    else pkg.overrides[`${name}@>=${major} <${major+1}`]=version;
    changes.push({name,from:current,to:version});
  }
}
for(const name of ['@vitest/browser-playwright','@vitest/coverage-v8']) {
  if(pkg.devDependencies?.[name])pkg.devDependencies[name]=pkg.devDependencies.vitest;
}
await writeFile(file,JSON.stringify(pkg,null,2)+'\n');
await writeFile(new URL('.local/v3-opensa-build-patches.json',root),JSON.stringify(changes,null,2));
console.log(JSON.stringify(changes,null,2));
