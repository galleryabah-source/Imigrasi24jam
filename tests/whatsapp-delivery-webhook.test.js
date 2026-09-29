import test from 'node:test';
import assert from 'node:assert/strict';
import { handleWhatsAppDeliveryWebhook } from '../src/core/whatsapp-delivery-webhook.js';

test('webhook verification is the first gate before reconciliation', async () => {
  const calls = [];
  const db = { transaction: async () => { calls.push('transaction'); throw new Error('SHOULD_NOT_REACH_TRANSACTION'); } };
  const provider = {
    verifyWebhook: async () => { calls.push('verify'); return { valid:false }; },
    parseInbound: async () => null,
    parseDeliveryStatus: async () => { calls.push('parse'); return null; },
    sendText: async () => ({}),
    sendAttachment: async () => ({})
  };
  const result = await handleWhatsAppDeliveryWebhook({ db, providerAdapter:provider, request:{} });
  assert.equal(result.status,'REJECTED');
  assert.deepEqual(calls,['verify']);
});

test('verified webhook enters the canonical reconciliation transaction', async () => {
  const calls = [];
  const db = {
    transaction: async (fn) => fn({
      async query(sql) {
        calls.push(sql);
        if (/FROM message_outbox/.test(sql)) return { rows:[{
          outbox_id:'O1', conversation_id:'C1', provider:'wa',
          outbound_provider_message_id:'WA-OUT-1', inbound_id:'I1',
          inbound_provider_message_id:'WA-IN-1'
        }]};
        if (/UPDATE message_outbox/.test(sql)) return { rows:[{
          id:'O1', delivery_state:'SENT', provider_message_id:'WA-OUT-1'
        }]};
        if (/INSERT INTO audit_events/.test(sql)) return { rows:[{ id:'A1' }]};
        throw new Error('UNEXPECTED_SQL');
      }
    })
  };
  const provider = {
    verifyWebhook: async () => { calls.push('verify'); return { valid:true }; },
    parseInbound: async () => null,
    parseDeliveryStatus: async () => { calls.push('parse'); return { status:'DELIVERED', provider_message_id:'WA-OUT-1' }; },
    sendText: async () => ({ provider_message_id:'WA-OUT-1' }),
    sendAttachment: async () => ({ provider_message_id:'WA-OUT-1' })
  };
  const result = await handleWhatsAppDeliveryWebhook({ db, providerAdapter:provider, request:{} });
  assert.equal(result.status,'RECONCILED');
  assert.equal(calls[0],'verify');
  assert.equal(calls.includes('parse'),true);
  assert.equal(calls.filter((v)=>typeof v==='string' && v.startsWith('UPDATE message_outbox')).length,1);
});
