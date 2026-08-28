import test from 'node:test';
import assert from 'node:assert/strict';
import { canPublishDocument, canSendWhatsAppAttachment } from '../src/core/database-contract.js';

const validPublicDocument = {
  access_classification: 'PUBLIC',
  status: 'PUBLISHED',
  immigration_relevance_status: 'VERIFIED',
  authority_status: 'VERIFIED',
  content_integrity_status: 'VERIFIED',
  approval_id: 'APP-1',
  quarantined: false,
  allow_whatsapp_attachment: true,
  effective_from: '2020-01-01T00:00:00.000Z',
  allowed_intents: ['PASSPORT_NEW']
};

test('verified public document can be published', () => {
  assert.equal(canPublishDocument(validPublicDocument), true);
});

test('private document cannot be published publicly', () => {
  assert.equal(canPublishDocument({ ...validPublicDocument, access_classification: 'PRIVATE-INTERNAL' }), false);
});

test('unverified document cannot be published', () => {
  assert.equal(canPublishDocument({ ...validPublicDocument, immigration_relevance_status: 'PENDING' }), false);
});

test('quarantined document cannot be published', () => {
  assert.equal(canPublishDocument({ ...validPublicDocument, quarantined: true }), false);
});

test('attachment requires context intent and explicit permission', () => {
  assert.equal(canSendWhatsAppAttachment(validPublicDocument, { intent: 'PASSPORT_NEW' }), true);
  assert.equal(canSendWhatsAppAttachment(validPublicDocument, { intent: 'VISA_GENERAL' }), false);
  assert.equal(canSendWhatsAppAttachment({ ...validPublicDocument, allow_whatsapp_attachment: false }, { intent: 'PASSPORT_NEW' }), false);
});
