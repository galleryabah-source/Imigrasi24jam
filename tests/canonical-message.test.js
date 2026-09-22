import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeWhatsAppMessage } from '../src/integrations/whatsapp/canonical-message.js';

test('canonicalizes provider message deterministically', () => {
  const value = canonicalizeWhatsAppMessage({ id: ' wamid-1 ', from: ' user-1 ', type: 'text', text: ' hello ' });
  assert.equal(value.provider, 'whatsapp');
  assert.equal(value.messageId, 'wamid-1');
  assert.equal(value.conversationId, 'user-1');
  assert.equal(value.sender, 'user-1');
  assert.equal(value.type, 'text');
  assert.equal(value.text, 'hello');
});

test('rejects missing canonical identity fields', () => {
  assert.throws(() => canonicalizeWhatsAppMessage({ id: 'only-id' }), /CANONICAL_MESSAGE_FIELDS_REQUIRED/);
});
