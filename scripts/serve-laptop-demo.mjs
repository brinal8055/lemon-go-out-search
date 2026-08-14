import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const demoFile = fileURLToPath(new URL('../tools/laptop-demo/index.html', import.meta.url));
const host = '127.0.0.1';
const port = 4173;

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', `http://${host}:${port}`).pathname;
  if (path !== '/' && path !== '/index.html') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'text/html; charset=utf-8',
  });
  createReadStream(demoFile).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Lemon laptop demo: http://${host}:${port}`);
  console.log('Keep this process running while using the interface.');
});
