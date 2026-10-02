import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat, readdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { startStaticServer } from '../vendor/NewShoes-main/WebAssembly/harness/static-server.mjs';

// Development-only overlay: upstream sources remain unchanged. Before an
// engine build exists this serves the importer/desktop for browser checks.
// GAME_UPSTREAM can point at the built Docker server using the same origin.
const sourceServer = process.env.GAME_UPSTREAM ? null : await startStaticServer({
  root: fileURLToPath(new URL(process.env.GAME_PACKAGED === '1' ? '../.local/github-pages/' : '../vendor/NewShoes-main/WebAssembly/', import.meta.url)),
});
const upstream = new URL(process.env.GAME_UPSTREAM || sourceServer.url);
if (process.env.GAME_PACKAGED === '1' && sourceServer) {
  const project = JSON.parse(await readFile(new URL('../deployment/project.json', import.meta.url), 'utf8'));
  const wasm = await readFile(new URL('../.local/github-pages/dist-threaded-release/cnc-port.wasm', import.meta.url));
  if (createHash('sha256').update(wasm).digest('hex') !== project.runtimeWasmSha256) throw new Error('Packaged engine checksum mismatch.');
}
const runtimeRoot = new URL('../.local/prebuilt/dist-threaded-release/', import.meta.url);
let runtimeManifest = null;
if (sourceServer && process.env.GAME_PACKAGED !== '1') {
  try {
    runtimeManifest = JSON.parse(await readFile(new URL('provenance.json', runtimeRoot), 'utf8'));
    if (runtimeManifest.expectedCommit !== '3ccaa0e9af66889be183ca910851e881d47d437c') throw new Error('Runtime source mismatch');
    for (const file of runtimeManifest.files) {
      if (!['cnc-port.js', 'cnc-port.wasm', 'cnc-port.worker.js'].includes(file.name)) throw new Error('Unexpected runtime file');
      const bytes = await readFile(new URL(file.name, runtimeRoot));
      if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Runtime checksum mismatch: ${file.name}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const overrides = new Set((await readdir(new URL('../overrides/harness/', import.meta.url), { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name));
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/' || url.pathname === '/launcher.html') {
    res.writeHead(302, { location: '/harness/play.html' });
    res.end();
    return;
  }
  if (runtimeManifest && ['GET', 'HEAD'].includes(req.method)) {
    const runtimeName = url.pathname.startsWith('/dist-threaded-release/') ? url.pathname.slice('/dist-threaded-release/'.length) : '';
    const file = runtimeManifest.files.find(file => file.name === runtimeName);
    const buildInfo = ['/harness/build-info.json', '/__cnc_build_info'].includes(url.pathname);
    if (file || buildInfo) {
      const bytes = buildInfo ? Buffer.from(JSON.stringify(runtimeManifest.metadata)) : await readFile(new URL(file.name, runtimeRoot));
      const lastModified = buildInfo ? new Date(runtimeManifest.fetchedAt) : (await stat(new URL(file.name, runtimeRoot))).mtime;
      res.writeHead(200, {
        'content-type': buildInfo ? 'application/json' : file.name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8',
        'content-length': bytes.length,
        'last-modified': lastModified.toUTCString(),
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-resource-policy': 'same-origin',
        'cache-control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
      return;
    }
  }
  const name = url.pathname.startsWith('/harness/') ? url.pathname.slice('/harness/'.length) : '';
  const brandAsset = /^assets\/winchester\/(mark\.svg|home\.webp|icon-(192|512)\.png)$/.test(name);
  if ((overrides.has(name) || brandAsset) && ['GET', 'HEAD'].includes(req.method)) {
    try {
      const body = await readFile(new URL(`../overrides/harness/${name}`, import.meta.url));
      res.writeHead(200, {
        'content-type': contentTypes[extname(name)] || 'application/octet-stream',
        'content-length': body.length,
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
        'cross-origin-resource-policy': 'same-origin',
        'cache-control': 'no-store',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (error) { res.writeHead(500); res.end(error.message); }
    return;
  }
  const proxied = httpRequest(new URL(req.url, upstream), {
    method: req.method, headers: { ...req.headers, host: upstream.host },
  }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  proxied.on('error', error => { res.writeHead(502); res.end(error.message); });
  req.pipe(proxied);
});
server.listen(Number(process.env.PREVIEW_PORT || 8081), '127.0.0.1', () => {
  console.log(`Local preview: http://localhost:${server.address().port}/harness/play.html`);
  console.log(`Upstream: ${upstream} (${sourceServer ? process.env.GAME_PACKAGED === '1' ? 'retained compiled V1 runtime; WASM checksum verified' : runtimeManifest ? 'official prebuilt runtime, verified source revision and downloaded checksums' : 'source-only: engine not compiled' : 'Docker runtime'})`);
});
process.on('SIGINT', () => { server.close(); sourceServer?.close(); });
