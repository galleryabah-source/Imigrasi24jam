import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhatsAppReplayIdentity } from '../src/integrations/whatsapp/replay-identity.js';

test('same provider event produces same replay identity', () => {
  const a = createWhatsAppReplayIdentity({ provider: 'WhatsApp', messageId: ' wamid-1 ', timestamp: '1700000000' });
  const b = createWhatsAppReplayIdentity({ provider: 'whatsapp', messageId: 'wamid-1', timestamp: '1700000000' });
  assert.equal(a, b);
});

test('different provider event identity produces different hash', () => {
  const a = createWhatsAppReplayIdentity({ messageId: 'wamid-1', timestamp: '1700000000' });
  const b = createWhatsAppReplayIdentity({ messageId: 'wamid-2', timestamp: '1700000000' });
  assert.notEqual(a, b);
});
