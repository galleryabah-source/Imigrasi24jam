import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWebhookRequest, normalizeInboundMessage } from '../src/core/webhook-contract.js';

test('webhook rejects missing signature', () => {
  assert.deepEqual(validateWebhookRequest({ rawBody:'{}', timestamp:Date.now()/1000, secret:'s' }), { ok:false, code:'MISSING_SIGNATURE' });
});

test('webhook rejects stale timestamp', () => {
  assert.equal(validateWebhookRequest({ rawBody:'{}', signature:'x', timestamp:(Date.now()-600000)/1000, secret:'s' }).code, 'REPLAY_WINDOW_EXCEEDED');
});

test('canonical inbound message requires identity', () => {
  assert.throws(() => normalizeInboundMessage({ provider:'wa', sender:'628' }), /INVALID_CANONICAL_MESSAGE_IDENTITY/);
});

test('canonical inbound message normalizes supported type', () => {
  const m = normalizeInboundMessage({ provider:'wa', providerMessageId:'M1', conversationId:'C1', sender:'628', messageType:'text', text:'paspor' });
  assert.equal(m.providerMessageId, 'M1');
  assert.equal(m.messageType, 'text');
});
