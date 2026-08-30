import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { createWebhookSecurityGate } from '../src/integrations/whatsapp/webhook-security.js';
import { processWhatsAppWebhook } from '../src/integrations/whatsapp/webhook-pipeline.js';

const secret = 'http-e2e-test-secret';
const body = JSON.stringify({ id: 'wamid-http-e2e-1', from: 'user-http-1', type: 'text', text: ' halo ' });

function sign(rawBody) {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

function transactionStub() {
  const replayKeys = new Set();
  let writes = 0;
  return {
    async ingest({ replayKey }) {
      if (replayKeys.has(replayKey)) return { accepted: false, inboxId: null };
      replayKeys.add(replayKey);
      writes += 1;
      return { accepted: true, inboxId: `i${writes}` };
    },
    get writes() { return writes; }
  };
}

async function startServer() {
  const tx = transactionStub();
  const securityGate = createWebhookSecurityGate({ secret });
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhooks/whatsapp') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'NOT_FOUND' }));
      return;
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    const signature = req.headers['x-signature'];
    const timestampSeconds = req.headers['x-timestamp'];

    let result;
    try {
      result = await processWhatsAppWebhook({
        rawBody,
        signature,
        timestampSeconds,
        securityGate,
        inboxTransaction: tx
      });
    } catch (error) {
      result = { status: 400, accepted: false, reason: error.message };
    }

    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, tx, url: `http://127.0.0.1:${port}/webhooks/whatsapp` };
}

async function post(url, rawBody, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: rawBody
  });
}

test('HTTP webhook accepts valid signed event and acknowledges replay without duplicate persistence', async (t) => {
  const { server, tx, url } = await startServer();
  t.after(() => server.close());

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const headers = { 'x-signature': sign(body), 'x-timestamp': timestamp };

  const first = await post(url, body, headers);
  const firstPayload = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstPayload.accepted, true);

  const second = await post(url, body, headers);
  const secondPayload = await second.json();
  assert.equal(second.status, 200);
  assert.equal(secondPayload.duplicate, true);
  assert.equal(tx.writes, 1);
});

test('HTTP webhook rejects invalid signature before persistence', async (t) => {
  const { server, tx, url } = await startServer();
  t.after(() => server.close());

  const response = await post(url, body, {
    'x-signature': 'sha256=invalid',
    'x-timestamp': Math.floor(Date.now() / 1000).toString()
  });
  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.accepted, false);
  assert.equal(tx.writes, 0);
});

test('HTTP webhook rejects stale timestamp before persistence', async (t) => {
  const { server, tx, url } = await startServer();
  t.after(() => server.close());

  const staleTimestamp = (Math.floor(Date.now() / 1000) - 301).toString();
  const response = await post(url, body, {
    'x-signature': sign(body),
    'x-timestamp': staleTimestamp
  });
  assert.equal(response.status, 401);
  assert.equal(tx.writes, 0);
});

test('HTTP webhook rejects malformed JSON with 400 after security validation', async (t) => {
  const { server, tx, url } = await startServer();
  t.after(() => server.close());

  const malformed = '{"id":';
  const response = await post(url, malformed, {
    'x-signature': sign(malformed),
    'x-timestamp': Math.floor(Date.now() / 1000).toString()
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.reason, 'INVALID_JSON');
  assert.equal(tx.writes, 0);
});
