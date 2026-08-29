import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsAppInbound } from '../src/integrations/whatsapp/normalize.js';

test('normalizes a text message into canonical shape', () => {
  const result = normalizeWhatsAppInbound({ provider:'test', messageId:'M1', senderId:'S1', timestamp:100, messageType:'text', text:'  Halo  ' });
  assert.deepEqual(result, { provider:'test', providerMessageId:'M1', senderId:'S1', timestamp:100, messageType:'text', text:'Halo', media:null });
});

test('normalizes supported media metadata without retaining provider payload', () => {
  const result = normalizeWhatsAppInbound({ provider:'test', messageId:'M2', senderId:'S2', timestamp:200, messageType:'document', text:'UU', media:{ mediaId:'F1', mimeType:'application/pdf', filename:'uu.pdf', sha256:'abc' }, vendorSecret:'must-not-propagate' });
  assert.equal(result.media.filename, 'uu.pdf');
  assert.equal(Object.hasOwn(result, 'vendorSecret'), false);
});

test('rejects invalid canonical input and unsupported types', () => {
  assert.throws(() => normalizeWhatsAppInbound({ provider:'test', messageId:'M3', timestamp:1 }), /INVALID_CANONICAL_MESSAGE/);
  assert.throws(() => normalizeWhatsAppInbound({ provider:'test', messageId:'M4', senderId:'S4', timestamp:1, messageType:'location' }), /UNSUPPORTED_MESSAGE_TYPE/);
});
