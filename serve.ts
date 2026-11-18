// A tiny static server for game/ (Node 22, standard library only), so an
// entry can be played locally without a build step: `node serve.ts`
// serves game/ on http://localhost:8080 (or --port <n>). --host binds a
// different interface when the game is shown on another machine on the
// local network; it still defaults to loopback only. --verbose logs every
// request; without it the server only speaks on errors and at startup.
// This is a development convenience, not a web server for the internet:
// it serves only files under game/, refuses any path outside it, and
// never executes anything.
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const requested = portIndex === -1 ? 8080 : Number(args[portIndex + 1]);
const port = Number.isInteger(requested) && requested > 0 && requested < 65536 ? requested : 8080;
const hostIndex = args.indexOf('--host');
const host = hostIndex === -1 ? '127.0.0.1' : (args[hostIndex + 1] || '127.0.0.1');
const verbose = args.includes('--verbose');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  // only reads are served: anything else gets a plain 405, so a stray
  // POST can never reach the file path below.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end('method not allowed');
    return;
  }
  // browsers ask for a favicon on every page load; there is none, and a
  // silent 204 keeps it out of the logs instead of a 404 per visit.
  if (pathname === '/favicon.ico') {
    response.writeHead(204).end();
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  if (verbose) console.log(`${request.method} ${pathname} -> 200 (${size} bytes)`);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.on('error', (err) => {
  console.error(`serve.ts: cannot listen on port ${port} (${err.message})`);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`game/ is on http://${host}:${port} (serving ${root})`);
  console.log('shots: add ?shot=cover|walk|mission|night&seed=7 to stage a screenshot');
});
