import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRuntimeServer } from '../src/runtime/http-server.js';

function request(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('health endpoint is independent of database readiness', async () => {
  const runtime = createRuntimeServer({ port: 0, databaseUrl: undefined });
  await runtime.start();
  const address = runtime.server.address();
  try {
    const result = await request(address.port, '/healthz');
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'ok');
    assert.equal(result.body.checks.process, 'ok');
  } finally {
    await runtime.close();
  }
});

test('readiness fails closed when production database is not configured', async () => {
  const runtime = createRuntimeServer({ port: 0, databaseUrl: undefined });
  await runtime.start();
  const address = runtime.server.address();
  try {
    const result = await request(address.port, '/readyz');
    assert.equal(result.status, 503);
    assert.equal(result.body.status, 'not_ready');
    assert.equal(result.body.checks.database, 'not_configured');
  } finally {
    await runtime.close();
  }
});

test('unknown route returns 404', async () => {
  const runtime = createRuntimeServer({ port: 0, databaseUrl: undefined });
  await runtime.start();
  const address = runtime.server.address();
  try {
    const result = await request(address.port, '/unknown');
    assert.equal(result.status, 404);
    assert.equal(result.body.code, 'NOT_FOUND');
  } finally {
    await runtime.close();
  }
});
