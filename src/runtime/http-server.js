import http from 'node:http';
import { createPostgresAdapter } from '../db/postgres-adapter.js';

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(payload);
}

export function createRuntimeServer({
  port = Number(process.env.PORT ?? 8080),
  host = process.env.HOST ?? '0.0.0.0',
  databaseUrl = process.env.DATABASE_URL
} = {}) {
  let db = null;

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'GET') {
      res.setHeader('allow', 'GET');
      return json(res, 405, { status: 'error', code: 'METHOD_NOT_ALLOWED' });
    }

    if (req.url === '/healthz') {
      return json(res, 200, {
        status: 'ok',
        service: 'imigrasi24jam',
        checks: { process: 'ok' }
      });
    }

    if (req.url === '/readyz') {
      if (!databaseUrl) {
        return json(res, 503, {
          status: 'not_ready',
          service: 'imigrasi24jam',
          checks: { database: 'not_configured' }
        });
      }

      try {
        db ??= createPostgresAdapter({ connectionString: databaseUrl });
        await db.query('SELECT 1');
        return json(res, 200, {
          status: 'ready',
          service: 'imigrasi24jam',
          checks: { database: 'ok' }
        });
      } catch {
        return json(res, 503, {
          status: 'not_ready',
          service: 'imigrasi24jam',
          checks: { database: 'unavailable' }
        });
      }
    }

    return json(res, 404, { status: 'error', code: 'NOT_FOUND' });
  });

  return Object.freeze({
    server,
    async start() {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, resolve);
      });
      return Object.freeze({ host, port });
    },
    async close() {
      if (db) {
        await db.close();
        db = null;
      }
      if (!server.listening) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    }
  });
}
