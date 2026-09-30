import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppProviderContract } from '../src/integrations/whatsapp/provider-contract.js';

test('provider contract requires all transport boundaries', () => {
  assert.throws(() => createWhatsAppProviderContract({}), /WHATSAPP_ADAPTER_METHOD_REQUIRED:verifyWebhook/);
});

test('provider contract delegates without exposing provider implementation', async () => {
  const calls = [];
  const contract = createWhatsAppProviderContract({
    async verifyWebhook(r) { calls.push(['verify', r]); return { verified:true }; },
    async parseInbound(r) { calls.push(['parse', r]); return { provider_message_id:'M1' }; },
    async sendText(m) { calls.push(['text', m]); return { provider_message_id:'P1' }; },
    async sendAttachment(m) { calls.push(['attachment', m]); return { provider_message_id:'P2' }; },
    async parseDeliveryStatus(r) { calls.push(['status', r]); return { state:'SENT' }; }
  });
  assert.deepEqual(await contract.verifyWebhook('request'), { verified:true });
  assert.deepEqual(await contract.parseInbound('payload'), { provider_message_id:'M1' });
  assert.deepEqual(await contract.sendText({ text:'hello' }), { provider_message_id:'P1' });
  assert.deepEqual(await contract.sendAttachment({ document_id:'D1' }), { provider_message_id:'P2' });
  assert.deepEqual(await contract.parseDeliveryStatus('status'), { state:'SENT' });
  assert.equal(calls.length, 5);
});
