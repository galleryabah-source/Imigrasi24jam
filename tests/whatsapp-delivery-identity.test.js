import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppDeliveryAdapter } from '../src/integrations/whatsapp/delivery-adapter.js';

function adapterReturning(result) {
  return createWhatsAppDeliveryAdapter({
    async sendText() { return result; },
    async sendAttachment() { return result; },
    async verifyWebhook() { return true; },
    async parseInbound() { return {}; },
    async parseDeliveryStatus() { return { status:'DELIVERED' }; }
  });
}

test('WhatsApp delivery requires provider-assigned message identity', async () => {
  const adapter = adapterReturning({ idempotency_key:'wa:O1:C1:1' });
  await assert.rejects(() => adapter.send({ text:'hello', idempotency_key:'wa:O1:C1:1' }), /PROVIDER_DELIVERY_IDENTITY_REQUIRED/);
});

test('WhatsApp delivery preserves distinct provider id and idempotency key', async () => {
  const adapter = adapterReturning({ message_id:'WA-OUT-1' });
  const result = await adapter.send({ text:'hello', idempotency_key:'wa:O1:C1:1' });
  assert.deepEqual(result, { provider_message_id:'WA-OUT-1', idempotency_key:'wa:O1:C1:1' });
});
