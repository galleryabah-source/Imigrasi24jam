import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppDeliveryAdapter } from '../src/integrations/whatsapp/delivery-adapter.js';

function adapter(overrides = {}) {
  return {
    async verifyWebhook() { return { verified:true }; },
    async parseInbound() { return {}; },
    async sendText(message) { return { provider_message_id:'P-TEXT', seen:message }; },
    async sendAttachment(message) { return { provider_message_id:'P-ATTACH', seen:message }; },
    async parseDeliveryStatus() { return { state:'DELIVERED' }; },
    ...overrides
  };
}

test('delivery adapter gives outbox one provider.send seam', async () => {
  const delivery = createWhatsAppDeliveryAdapter(adapter());
  const result = await delivery.send({ to:'6281', text:'halo', idempotency_key:'wa:O1:C1:0' });
  assert.equal(result.provider_message_id, 'P-TEXT');
  assert.equal(result.idempotency_key, 'wa:O1:C1:0');
});

test('delivery adapter routes attachment payloads through the same seam', async () => {
  let seen;
  const delivery = createWhatsAppDeliveryAdapter(adapter({
    async sendAttachment(message) { seen = message; return { provider_message_id:'P-ATTACH' }; }
  }));
  const result = await delivery.send({ to:'6281', text:'dokumen', attachments:[{ document_id:'D1' }], idempotency_key:'wa:O2:C2:0' });
  assert.equal(result.provider_message_id, 'P-ATTACH');
  assert.equal(result.idempotency_key, 'wa:O2:C2:0');
  assert.deepEqual(seen.attachment, { document_id:'D1' });
});

test('delivery adapter rejects multiple attachments until an explicit batch contract exists', async () => {
  const delivery = createWhatsAppDeliveryAdapter(adapter());
  await assert.rejects(() => delivery.send({ attachments:[{id:'A'},{id:'B'}] }), /WHATSAPP_ATTACHMENT_CARDINALITY_UNSUPPORTED/);
});

test('delivery adapter preserves provider delivery identity requirement', async () => {
  const delivery = createWhatsAppDeliveryAdapter(adapter({
    async sendText() { return {}; }
  }));
  await assert.rejects(() => delivery.send({ text:'x' }), /PROVIDER_DELIVERY_IDENTITY_REQUIRED/);
});
