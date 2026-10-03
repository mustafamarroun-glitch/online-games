// Run upstream's real-game acceptance with a documented browser-only INI fixture.
// Its MCV probe counts the Allied vehicle, so both test players select Americans.
// No installed assets, VM instructions or simulation state are modified.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, '.local/ra2-vm/source');
const original = resolve(source, 'tests/real-game/browser/ra2NetworkBrowserSmoke.mts');
let code = await readFile(original, 'utf8');
code = code.replace(/from (['"])(\.{1,2}\/[^'"\n]+)\1/g, (_, quote, name) => `from ${quote}${pathToFileURL(resolve(dirname(original), name)).href}${quote}`);
const anchor = "    await context.addInitScript((game) => localStorage.setItem(`vm-resolution-${game}`, '1440x900'), game);";
if (!code.includes(anchor)) throw new Error('Upstream native acceptance setup changed.');
code = code.replace(anchor, `${anchor}
    await context.route(/\\/game\\/.*\\/ra2md\\.ini(?:\\?|$)/i, async route => {
      const response = await route.fetch();
      let section = '';
      const body = (await response.text()).split(/\\r?\\n/).map(line => {
        const heading = line.match(/^\\[([^\\]]+)\\]/);
        if (heading) section = heading[1].toLowerCase();
        if (section === 'multiplayer' && /^Side=/i.test(line)) return 'Side=Americans';
        if (section === 'lan' && /^Slot0[1-7]=/i.test(line)) return line.split('=')[0] + '=2,-2,-2';
        if (section === 'lan' && /^GameSpeed=/i.test(line)) return 'GameSpeed=3';
        return line;
      }).join('\\r\\n');
      writeFileSync(join(output, 'browser-only-test-preferences.ini'), body);
      await route.fulfill({ response, body });
    });
`);
const directory = resolve(source, 'node_modules/.cache/winchester-friends-test');
await mkdir(directory, { recursive: true });
const generated = resolve(directory, 'real-game-acceptance.mts');
await writeFile(generated, code);
const child = spawn(process.execPath, [resolve(root, '.local/ra2-vm/tooling/node_modules/pnpm/bin/pnpm.cjs'), 'exec', 'tsx', generated], { cwd: source, env: { ...process.env, RA2_BROWSER_GAME: 'yr' }, stdio: 'inherit', windowsHide: true });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
