import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppProviderContract } from '../src/integrations/whatsapp/provider-contract.js';

test('WhatsApp contract rejects outbound sends without idempotency key', async () => {
  const calls = [];
  const provider = createWhatsAppProviderContract({
    verifyWebhook: async () => true,
    parseInbound: async () => ({}),
    sendText: async (message) => { calls.push(['text', message]); return { provider_message_id: 'p1' }; },
    sendAttachment: async (message) => { calls.push(['attachment', message]); return { provider_message_id: 'p2' }; },
    parseDeliveryStatus: async () => ({})
  });

  await assert.rejects(() => provider.sendText({ text: 'hello', options: {} }), /WHATSAPP_IDEMPOTENCY_KEY_REQUIRED/);
  await assert.rejects(() => provider.sendAttachment({ text: 'hello', attachments: [{ id: 'a1' }], options: {} }), /WHATSAPP_IDEMPOTENCY_KEY_REQUIRED/);
  assert.equal(calls.length, 0);
});

test('WhatsApp contract forwards stable outbound idempotency key to adapter', async () => {
  const calls = [];
  const provider = createWhatsAppProviderContract({
    verifyWebhook: async () => true,
    parseInbound: async () => ({}),
    sendText: async (message) => { calls.push(message); return { provider_message_id: 'p1' }; },
    sendAttachment: async (message) => { calls.push(message); return { provider_message_id: 'p2' }; },
    parseDeliveryStatus: async () => ({})
  });

  await provider.sendText({ text: 'hello', options: { idempotency_key: 'imigrasi24jam:outbox:abc' } });
  await provider.sendAttachment({ attachments: [{ id: 'a1' }], options: { idempotency_key: 'imigrasi24jam:outbox:def' } });

  assert.equal(calls[0].options.idempotency_key, 'imigrasi24jam:outbox:abc');
  assert.equal(calls[1].options.idempotency_key, 'imigrasi24jam:outbox:def');
});
