import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebhookSignature, validateWebhookTimestamp, createWebhookSecurityGate } from '../src/integrations/whatsapp/webhook-security.js';

const secret = 'test-webhook-secret';
const body = '{"message":"hello"}';
const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

test('accepts valid HMAC signature', () => {
  assert.equal(verifyWebhookSignature({ rawBody: body, signature, secret }), true);
});

test('rejects invalid signature', () => {
  assert.equal(verifyWebhookSignature({ rawBody: body, signature: 'sha256=bad', secret }), false);
});

test('rejects stale webhook timestamp', () => {
  assert.equal(validateWebhookTimestamp(1000, { nowSeconds: 1401, maxAgeSeconds: 300 }), false);
  assert.equal(validateWebhookTimestamp(1200, { nowSeconds: 1401, maxAgeSeconds: 300 }), true);
});

test('security gate requires both signature and fresh timestamp', () => {
  const gate = createWebhookSecurityGate({ secret, maxAgeSeconds: 300 });
  assert.equal(gate.verify({ rawBody: body, signature, timestampSeconds: 1400, nowSeconds: 1401 }), true);
  assert.equal(gate.verify({ rawBody: body, signature: 'sha256=bad', timestampSeconds: 1400, nowSeconds: 1401 }), false);
  assert.equal(gate.verify({ rawBody: body, signature, timestampSeconds: 900, nowSeconds: 1401 }), false);
});
