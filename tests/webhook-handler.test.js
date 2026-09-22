import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWhatsAppWebhook } from '../src/integrations/whatsapp/webhook-handler.js';

test('invalid signature is rejected before parsing or persistence', async () => {
  let parsed = false;
  const result = await handleWhatsAppWebhook({ rawBody: '{"id":"x"}', signature: 'bad', timestamp: '1', verifySignature: () => false, replayStore: {}, inboxTransaction: { ingest: async () => { parsed = true; } } });
  assert.equal(result.status, 401);
  assert.equal(parsed, false);
});

test('valid webhook is canonicalized and persisted transactionally', async () => {
  let received;
  const result = await handleWhatsAppWebhook({ rawBody: JSON.stringify({ id: 'wamid-1', from: 'user-1', type: 'text', text: ' hello ' }), signature: 'sig', timestamp: '1700000000', verifySignature: () => true, replayStore: {}, inboxTransaction: { ingest: async (value) => { received = value; return { accepted: true, inboxId: 'i1' }; } } });
  assert.equal(result.status, 200);
  assert.equal(result.accepted, true);
  assert.equal(received.providerMessageId, 'wamid-1');
  assert.equal(received.payload.text, 'hello');
});
