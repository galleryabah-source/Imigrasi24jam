import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAttachment } from '../src/core/attachment-policy.js';

const valid = { id: 'D1', classification: 'PUBLIC', allow_whatsapp_attachment: true, status: 'PUBLISHED', immigration_valid: true };

test('validated public document may be attached to WhatsApp', () => assert.equal(evaluateAttachment(valid).allowed, true));
test('private classifications are blocked', () => assert.equal(evaluateAttachment({ ...valid, classification: 'INTERNAL' }).allowed, false));
test('public document with WhatsApp flag disabled is blocked', () => assert.equal(evaluateAttachment({ ...valid, allow_whatsapp_attachment: false }).allowed, false));
test('unvalidated document is blocked', () => assert.equal(evaluateAttachment({ ...valid, immigration_valid: false }).allowed, false));
