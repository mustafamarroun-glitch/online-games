import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Engine files only. Retail game files are selected inside the browser.
const root = await realpath(resolve(fileURLToPath(new URL('../experiments/san-andreas/', import.meta.url))));
const port = Number(process.env.SAN_ANDREAS_PORT || 8083);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    const requestName = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const name = requestName === 'OpenSA-preview-source.zip' || requestName === 'LICENSE' || requestName === 'provenance.json'
      ? requestName : `runtime/${requestName || 'index.html'}`;
    if (name.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(404); res.end(); return; }
    const path = await realpath(resolve(root, name));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) { res.writeHead(404); res.end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end(); }
}).listen(port, '127.0.0.1', () => console.log(`San Andreas experimental preview: http://localhost:${port}/`));
