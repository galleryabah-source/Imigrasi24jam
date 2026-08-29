import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockWhatsAppProvider } from '../src/core/mock-whatsapp-provider.js';
import { computeHmacSha256 } from '../src/core/webhook-security.js';

test('mock whatsapp accepts valid signed inbound webhook', async () => {
  const now = 1700000000000;
  const secret = 'test-secret';
  const provider = createMockWhatsAppProvider({ secret, clock: () => now });
  const rawBody = JSON.stringify({ messages: [{ id:'M1', from:'628', type:'text', text:'paspor' }] });
  const result = await provider.verify({ rawBody, signature: computeHmacSha256(secret, rawBody), timestamp: now / 1000 });
  assert.equal(result, true);
  const messages = await provider.parseInbound({ payload: JSON.parse(rawBody) });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].provider, 'mock-whatsapp');
});

test('mock whatsapp rejects stale webhook', async () => {
  const now = 1700000000000;
  const provider = createMockWhatsAppProvider({ secret:'test-secret', clock: () => now });
  assert.equal(await provider.verify({ rawBody:'{}', signature:'bad', timestamp:(now - 600000)/1000 }), false);
});

test('mock whatsapp delivery methods remain provider-boundary operations', async () => {
  const provider = createMockWhatsAppProvider({ secret:'test-secret' });
  const text = await provider.sendText({ to:'628', text:'OK' });
  const attachment = await provider.sendAttachment({ to:'628', attachment:{ documentId:'D1' } });
  assert.equal(text.ok, true);
  assert.equal(attachment.ok, true);
});
