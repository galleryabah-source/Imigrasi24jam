import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestCanonicalMessage } from '../src/core/inbox-gateway.js';

test('inbox gateway persists canonical message exactly once', async () => {
  const calls = [];
  const repository = { insertInbound: async (message) => { calls.push(message); return { duplicate:false, messageId:'DB1' }; } };
  const provider = { acceptWebhook: async () => ({ accepted:true }) };
  const message = { provider:'mock-whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'S1', messageType:'text', text:'paspor', attachments:[] };
  const result = await ingestCanonicalMessage({ repository, message, provider });
  assert.equal(result.accepted, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.messageId, 'DB1');
  assert.deepEqual(calls[0], message);
});

test('duplicate inbound remains idempotent', async () => {
  const repository = { insertInbound: async () => ({ duplicate:true, messageId:'DB1' }) };
  const provider = { acceptWebhook: async () => ({ accepted:true }) };
  const result = await ingestCanonicalMessage({ repository, message:{ provider:'mock-whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'S1' }, provider });
  assert.equal(result.duplicate, true);
});
