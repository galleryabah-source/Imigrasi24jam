import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAttachment } from '../src/core/attachment-policy.js';

const valid = {
  id: 'D1',
  classification: 'PUBLIC',
  allow_whatsapp_attachment: true,
  status: 'PUBLISHED',
  immigration_valid: true,
  authority_valid: true,
  integrity_verified: true
};

test('fully validated public document may be attached to WhatsApp', () => assert.equal(evaluateAttachment(valid).allowed, true));
test('PRIVATE-INTERNAL is blocked', () => assert.equal(evaluateAttachment({ ...valid, classification: 'PRIVATE-INTERNAL' }).allowed, false));
test('legacy INTERNAL classification is invalid', () => assert.equal(evaluateAttachment({ ...valid, classification: 'INTERNAL' }).allowed, false));
test('restricted classification is blocked', () => assert.equal(evaluateAttachment({ ...valid, classification: 'RESTRICTED' }).allowed, false));
test('public document with WhatsApp flag disabled is blocked', () => assert.equal(evaluateAttachment({ ...valid, allow_whatsapp_attachment: false }).allowed, false));
test('unvalidated document is blocked', () => assert.equal(evaluateAttachment({ ...valid, immigration_valid: false }).allowed, false));
test('authority-unvalidated document is blocked', () => assert.equal(evaluateAttachment({ ...valid, authority_valid: false }).allowed, false));
test('integrity-unverified document is blocked', () => assert.equal(evaluateAttachment({ ...valid, integrity_verified: false }).allowed, false));
test('unpublished document is blocked', () => assert.equal(evaluateAttachment({ ...valid, status: 'REVIEW' }).allowed, false));
test('access_classification takes precedence when supplied', () => assert.equal(evaluateAttachment({ ...valid, classification: 'PUBLIC', access_classification: 'PRIVATE-INTERNAL' }).allowed, false));
