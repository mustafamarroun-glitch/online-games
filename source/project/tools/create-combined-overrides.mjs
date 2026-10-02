import { readFile, writeFile, mkdir } from 'node:fs/promises';

const sourceRoot = new URL('../vendor/NewShoes-main/WebAssembly/harness/', import.meta.url);
const outputRoot = new URL('../overrides/harness/', import.meta.url);
await mkdir(outputRoot, { recursive: true });
function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw new Error(`Source anchor changed: ${before}`);
  return source.replace(before, after);
}

const originalContract = await readFile(new URL('launcher-archive-specs.js', sourceRoot), 'utf8');
const combinedContract = replaceOnce(originalContract,
  '  globalThis.ZeroHArchiveSpecs = Object.freeze(specs);', String.raw`
  // Local project profile for an installed, combined Generals/Zero Hour set.
  // The original contract is retained for comparison. No archive is renamed
  // to impersonate separate base data. Runtime boot remains the acceptance gate.
  const additionalBaseEntries = {
    "TerrainZH.big": ["Art\\Terrain\\TLCliff01a.tga"],
    "TexturesZH.big": ["Art\\Textures\\sncommandbar.tga"],
    "W3DZH.big": ["Art\\W3D\\ABArFrcCmd.W3D"],
  };
  const combined = specs.filter((spec) => spec.edition === "zh"
      && spec.name !== "LooseScripts.big" && spec.name !== "Gensec.big")
    .map((spec) => Object.freeze({ ...spec,
      requiredEntries: Object.freeze([...spec.requiredEntries,
        ...(additionalBaseEntries[spec.name] || [])]),
    }));
  const packedArchive = (name, edition, requiredEntries) => Object.freeze({
    name, sourceName: name, artifactSourceName: name, edition,
    acceptedEditions: Object.freeze([edition]),
    requiredEntries: Object.freeze(requiredEntries),
  });
  combined.push(packedArchive("Music.big", "base", ["Data\\Audio\\Tracks\\CHI_01.mp3"]));
  combined.push(packedArchive("ScriptsZH.big", "zh", [
    "Data\\Scripts\\SkirmishScripts.scb",
    "Data\\Scripts\\MultiplayerScripts.scb",
    "Data\\Scripts\\Scripts.ini",
  ]));
  globalThis.ZeroHOriginalArchiveSpecs = Object.freeze(specs);
  globalThis.ZeroHArchiveProfile = "combined-installed-v1";
  globalThis.ZeroHArchiveSpecs = Object.freeze(combined);`);
await writeFile(new URL('launcher-archive-specs.js', outputRoot), combinedContract);

// Manifests and remembered source handles belong to this explicit profile.
// Every worker and runtime consumer reads the same shared archive contract.
let manager = await readFile(new URL('launcher-asset-manager.mjs', sourceRoot), 'utf8');
manager = replaceOnce(manager, 'const INSTALLED_KEY = "zeroh-installed-library.v5";',
  'const INSTALLED_KEY = "zeroh-installed-library.combined.v6";');
manager = replaceOnce(manager,
  'const OLD_INSTALLED_KEYS = ["zeroh-installed-library.v4", "zeroh-installed-library.v3", "zeroh-installed-library.v2", "zeroh-installed-library.v1"];',
  'const OLD_INSTALLED_KEYS = [];');
manager = replaceOnce(manager, 'const LIBRARY_VERSION = 5;', 'const LIBRARY_VERSION = 6;');
manager = replaceOnce(manager, 'const HANDLE_DB = "zeroh-asset-handles";',
  'const HANDLE_DB = "zeroh-asset-handles.combined.v1";');
await writeFile(new URL('launcher-asset-manager.mjs', outputRoot), manager);

let worker = await readFile(new URL('launcher-asset-worker.js', sourceRoot), 'utf8');
worker = replaceOnce(worker, '  const archiveSize = u32(header, 4);',
  `  // This installation includes a localized W3D archive whose total size is
  // big endian. Accept that encoding only when it exactly matches the physical
  // reader size; retain all directory, payload-range, and content validation.
  const littleEndianSize = u32(header, 4);
  const bigEndianSize = u32be(header, 4);
  const archiveSize = littleEndianSize === reader.size ? littleEndianSize
    : bigEndianSize === reader.size ? bigEndianSize : littleEndianSize;`);
await writeFile(new URL('launcher-asset-worker.js', outputRoot), worker);
console.log('Generated combined-installation contract, library manager, and archive validator overrides.');
