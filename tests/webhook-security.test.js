import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHmacSha256, validateWebhookSignature, validateReplayTimestamp, normalizeInboundWebhook } from '../src/core/webhook-security.js';

test('valid HMAC signature is accepted', () => {
  const body = '{"message":{"id":"M1","from":"6281","text":"paspor"}}';
  const sig = computeHmacSha256('test-secret', body);
  assert.equal(validateWebhookSignature({ secret:'test-secret', rawBody:body, signature:`sha256=${sig}` }), true);
  assert.equal(validateWebhookSignature({ secret:'wrong', rawBody:body, signature:`sha256=${sig}` }), false);
});

test('replay timestamp is bounded', () => {
  const now = Date.parse('2026-08-29T00:00:00.000Z');
  assert.equal(validateReplayTimestamp('2026-08-28T23:58:00.000Z', { nowMs:now }), true);
  assert.equal(validateReplayTimestamp('2026-08-28T23:40:00.000Z', { nowMs:now }), false);
});

test('canonical inbound normalization rejects missing identity', () => {
  assert.throws(() => normalizeInboundWebhook({ provider:'test', payload:{ message:{ from:'6281' } } }), /INVALID_WEBHOOK_MESSAGE/);
  const result = normalizeInboundWebhook({ provider:'test', payload:{ message:{ id:'M1', from:'6281', type:'text', text:'Apa syarat paspor?' } } });
  assert.deepEqual({ provider:result.provider, providerMessageId:result.providerMessageId, sender:result.sender, text:result.text }, { provider:'test', providerMessageId:'M1', sender:'6281', text:'Apa syarat paspor?' });
});
