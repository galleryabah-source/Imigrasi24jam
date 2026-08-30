import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWebhookSecurityGate } from '../src/integrations/whatsapp/webhook-security.js';
import { processWhatsAppWebhook } from '../src/integrations/whatsapp/webhook-pipeline.js';

const secret = 'pipeline-secret';
const body = JSON.stringify({ id: 'wamid-e2e-1', from: 'user-1', type: 'text', text: ' hello ' });

function signedRequest(timestampSeconds) {
  return {
    timestampSeconds,
    signature: `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`
  };
}

function transactionStub() {
  let writes = 0;
  return { async ingest() { writes += 1; return writes === 1 ? { accepted: true, inboxId: 'i1' } : { accepted: false, inboxId: null }; }, get writes() { return writes; } };
}

test('security rejection prevents replay/inbox processing', async () => {
  const tx = transactionStub();
  const timestamp = Math.floor(Date.now() / 1000);
  const result = await processWhatsAppWebhook({ rawBody: body, signature: 'sha256=bad', timestampSeconds: timestamp, securityGate: createWebhookSecurityGate({ secret }), inboxTransaction: tx });
  assert.equal(result.status, 401);
  assert.equal(tx.writes, 0);
});

test('valid event is admitted once and duplicate is acknowledged', async () => {
  const tx = transactionStub();
  const securityGate = createWebhookSecurityGate({ secret });
  const timestamp = Math.floor(Date.now() / 1000);
  const { signature } = signedRequest(timestamp);
  const first = await processWhatsAppWebhook({ rawBody: body, signature, timestampSeconds: timestamp, securityGate, inboxTransaction: tx });
  const second = await processWhatsAppWebhook({ rawBody: body, signature, timestampSeconds: timestamp, securityGate, inboxTransaction: tx });
  assert.equal(first.status, 200);
  assert.equal(first.accepted, true);
  assert.equal(second.status, 200);
  assert.equal(second.duplicate, true);
  assert.equal(tx.writes, 2);
});
