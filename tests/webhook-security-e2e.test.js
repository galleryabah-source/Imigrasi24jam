import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createWebhookSecurityGate } from '../src/integrations/whatsapp/webhook-security.js';

const secret = 'test-webhook-secret';
const body = JSON.stringify({ id: 'wamid-security-1', from: 'user-1', type: 'text', text: 'hello' });
const timestamp = 1700000000;
const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

const gate = createWebhookSecurityGate({ secret, maxAgeSeconds: 300 });

test('valid HMAC and timestamp are accepted', () => {
  assert.equal(gate.verify({ rawBody: body, signature, timestampSeconds: timestamp, nowSeconds: timestamp }), true);
});

test('tampered body is rejected', () => {
  assert.equal(gate.verify({ rawBody: body + 'x', signature, timestampSeconds: timestamp, nowSeconds: timestamp }), false);
});

test('invalid signature is rejected', () => {
  assert.equal(gate.verify({ rawBody: body, signature: 'sha256=bad', timestampSeconds: timestamp, nowSeconds: timestamp }), false);
});

test('expired timestamp is rejected', () => {
  assert.equal(gate.verify({ rawBody: body, signature, timestampSeconds: timestamp, nowSeconds: timestamp + 301 }), false);
});

test('future timestamp outside the allowed window is rejected', () => {
  assert.equal(gate.verify({ rawBody: body, signature, timestampSeconds: timestamp + 301, nowSeconds: timestamp }), false);
});
