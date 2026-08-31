import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { createWebhookSecurityGate } from '../src/integrations/whatsapp/webhook-security.js';
import { processWhatsAppWebhook } from '../src/integrations/whatsapp/webhook-pipeline.js';

const secret = 'security-e2e-secret';
const messageId = 'wamid-security-e2e-1';
const body = JSON.stringify({ id: messageId, from: 'security-user', type: 'text', text: 'permohonan paspor' });

const sign = (rawBody) => `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;

function makeServer() {
  const replayKeys = new Set();
  let writes = 0;
  const tx = {
    async ingest({ replayKey }) {
      if (replayKeys.has(replayKey)) return { accepted: false, inboxId: null };
      replayKeys.add(replayKey);
      writes += 1;
      return { accepted: true, inboxId: `security-${writes}` };
    },
    get writes() { return writes; }
  };
  const securityGate = createWebhookSecurityGate({ secret });
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhooks/whatsapp') {
      res.writeHead(404).end();
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString('utf8');
    let result;
    try {
      result = await processWhatsAppWebhook({
        rawBody,
        signature: req.headers['x-signature'],
        timestampSeconds: req.headers['x-timestamp'],
        securityGate,
        inboxTransaction: tx
      });
    } catch (error) {
      result = { status: 400, accepted: false, reason: error.message };
    }
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result));
  });
  return { server, tx };
}

async function post(url, rawBody, timestamp, signature = sign(rawBody)) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-timestamp': String(timestamp),
      'x-signature': signature
    },
    body: rawBody
  });
}

async function withServer(fn) {
  const state = makeServer();
  await new Promise((resolve) => state.server.listen(0, '127.0.0.1', resolve));
  const { port } = state.server.address();
  try { return await fn(`http://127.0.0.1:${port}/webhooks/whatsapp`, state.tx); }
  finally { await new Promise((resolve) => state.server.close(resolve)); }
}

test('security gate accepts valid HMAC against the raw HTTP body', async () => {
  await withServer(async (url, tx) => {
    const response = await post(url, body, Math.floor(Date.now() / 1000));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accepted, true);
    assert.equal(tx.writes, 1);
  });
});

test('security gate rejects tampered raw body even when signature was made for another body', async () => {
  await withServer(async (url, tx) => {
    const original = JSON.stringify({ id: messageId, from: 'security-user', type: 'text', text: 'permohonan paspor' });
    const tampered = JSON.stringify({ id: messageId, from: 'security-user', type: 'text', text: 'dokumen internal' });
    const response = await post(url, tampered, Math.floor(Date.now() / 1000), sign(original));
    assert.equal(response.status, 401);
    assert.equal(tx.writes, 0);
  });
});

test('security gate rejects stale and future timestamps before persistence', async () => {
  await withServer(async (url, tx) => {
    const now = Math.floor(Date.now() / 1000);
    const stale = await post(url, body, now - 301);
    assert.equal(stale.status, 401);
    const future = await post(url, body, now + 301);
    assert.equal(future.status, 401);
    assert.equal(tx.writes, 0);
  });
});

test('security gate enforces message-id replay idempotency across valid timestamps', async () => {
  await withServer(async (url, tx) => {
    const now = Math.floor(Date.now() / 1000);
    const first = await post(url, body, now);
    const second = await post(url, body, now + 1);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).duplicate, true);
    assert.equal(tx.writes, 1);
  });
});

test('security gate rejects malformed JSON after signature validation without persistence', async () => {
  await withServer(async (url, tx) => {
    const malformed = '{"id":';
    const response = await post(url, malformed, Math.floor(Date.now() / 1000));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).reason, 'INVALID_JSON');
    assert.equal(tx.writes, 0);
  });
});
