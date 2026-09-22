import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAttachment } from '../src/core/attachment-policy.js';

const valid = {
  id: 'D1',
  access_classification: 'PUBLIC',
  allow_whatsapp_attachment: true,
  status: 'PUBLISHED',
  immigration_valid: true,
  authority_valid: true,
  integrity_verified: true
};

test('public attachment requires every publication gate', () => {
  assert.equal(evaluateAttachment(valid).allowed, true);
});

test('private and restricted classifications are denied', () => {
  for (const classification of ['PRIVATE-INTERNAL', 'RESTRICTED']) {
    assert.equal(evaluateAttachment({ ...valid, access_classification: classification }).allowed, false);
  }
});

test('missing validation gates are denied', () => {
  for (const field of ['immigration_valid', 'authority_valid', 'integrity_verified']) {
    assert.equal(evaluateAttachment({ ...valid, [field]: false }).allowed, false);
  }
});

test('unpublished and WhatsApp-disabled documents are denied', () => {
  assert.equal(evaluateAttachment({ ...valid, status: 'REVIEW' }).allowed, false);
  assert.equal(evaluateAttachment({ ...valid, allow_whatsapp_attachment: false }).allowed, false);
});

test('legacy INTERNAL classification cannot bypass the policy', () => {
  assert.equal(evaluateAttachment({ ...valid, access_classification: 'INTERNAL' }).allowed, false);
});
