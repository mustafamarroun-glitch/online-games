// Serve only inventoried engine code. Player files are selected inside each browser.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { values } = parseArgs({ options: {
  port: { type: 'string', default: '15176' },
  room: { type: 'string' },
}, strict: true });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid relay port.');
if (!/^yuri-[a-f0-9]{24}$/.test(values.room || '')) throw new Error('A random Yuri session room is required.');
const roomPath = '/' + values.room;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = new Map();
for (const [folder, prefix] of [['yuris-revenge', '/play/'], ['yuri-relay', '/relay/']]) {
  const directory = resolve(root, 'experiments', folder);
  const manifestBytes = await readFile(resolve(directory, 'provenance.json'));
  const manifest = JSON.parse(manifestBytes);
  for (const file of manifest.artifacts) {
    if (file.path.split(/[\\/]/).some(part => part.startsWith('.') || part === '..') || /\.(exe|dll|mix|sav|rep|big)$/i.test(file.path)) throw new Error('Retail or unsafe file in public inventory.');
    const path = resolve(directory, file.path);
    if (!path.startsWith(directory + sep)) throw new Error('Unsafe engine path.');
    if (hash(await readFile(path)) !== file.sha256) throw new Error('Engine checksum mismatch: ' + file.path);
    // The relay bundle runs locally. Public downloads provide its complete corresponding source and notices.
    if (folder === 'yuri-relay' && file.path === 'relay.cjs') continue;
    files.set(prefix + file.path.replace(/^runtime\//, ''), path);
  }
  files.set(prefix + 'provenance.json', resolve(directory, 'provenance.json'));
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.wasm': 'application/wasm', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.zip': 'application/zip' };
const isolation = { 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'require-corp', 'cross-origin-resource-policy': 'same-origin', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
const { createGameRelay } = require('../experiments/yuri-relay/relay.cjs');
const relay = createGameRelay({ maxConnections: 8 });
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/healthz') {
      res.writeHead(200, { ...isolation, 'content-type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, service: 'winchester-yuri-multiplayer', ...relay.getHealth(), stats: relay.getStats() }));
      return;
    }
    if (pathname === '/') {
      const host = req.headers.host;
      // Complete relay URLs are normalized to WS/WSS by the game's existing address parser.
      const query = new URLSearchParams({ network: '1', relay: host + roomPath });
      res.writeHead(302, { ...isolation, location: '/play/?' + query }).end();
      return;
    }
    const path = files.get(pathname === '/play/' ? '/play/index.html' : pathname);
    if (!path) { res.writeHead(404, isolation).end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { ...isolation, 'content-type': types[extname(path)] || 'application/octet-stream', 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(400, isolation).end(); }
});
server.on('upgrade', (req, socket, head) => {
  try {
    if (new URL(req.url, 'http://localhost').pathname !== roomPath) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    relay.handleUpgrade(req, socket, head);
  } catch { socket.destroy(); }
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  relay.close();
  server.close();
  await relay.drained();
  server.closeAllConnections();
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
server.on('error', error => { console.error(error); relay.close(); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Yuri multiplayer: http://127.0.0.1:${port}/ · room ${values.room}`));
