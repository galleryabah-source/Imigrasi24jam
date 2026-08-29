import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderAdapter, acceptWebhook } from '../src/core/provider-adapter.js';

test('provider adapter requires all transport capabilities', () => {
  assert.throws(() => createProviderAdapter({}), /PROVIDER_VERIFY_REQUIRED/);
});

test('verified webhook is normalized through provider adapter', async () => {
  const adapter = createProviderAdapter({
    verify: async () => true,
    parseInbound: async () => [{ provider:'mock', providerMessageId:'M1', conversationId:'C1', sender:'S1', messageType:'text', text:'paspor' }],
    sendText: async () => ({ ok:true }),
    sendAttachment: async () => ({ ok:true })
  });
  const result = await acceptWebhook(adapter, { rawBody:'{}' });
  assert.equal(result.accepted, true);
  assert.equal(result.messages[0].providerMessageId, 'M1');
});

test('failed verification never reaches parser', async () => {
  let parsed = false;
  const adapter = createProviderAdapter({
    verify: async () => false,
    parseInbound: async () => { parsed = true; return []; },
    sendText: async () => ({ ok:true }),
    sendAttachment: async () => ({ ok:true })
  });
  const result = await acceptWebhook(adapter, {});
  assert.equal(result.accepted, false);
  assert.equal(parsed, false);
});
