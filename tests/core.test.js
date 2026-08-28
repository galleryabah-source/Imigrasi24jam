import test from 'node:test';
import assert from 'node:assert/strict';
import { domainGuard } from '../src/core/domain-guard.js';
import { normalizeText } from '../src/core/normalization.js';
import { isAnswerUsable, canAttachDocument } from '../src/core/policy-engine.js';
import { resolveAnswer } from '../src/core/answer-engine.js';

const VERIFIED_PUBLIC_DOCUMENT = {
  access_classification: 'PUBLIC', status: 'PUBLISHED',
  immigration_relevance_status: 'VERIFIED', authority_status: 'VERIFIED',
  content_integrity_status: 'VERIFIED', allow_whatsapp_attachment: true
};

test('domain guard allows immigration questions', () => assert.equal(domainGuard('Bagaimana membuat paspor?').allowed, true));
test('domain guard rejects unrelated questions', () => assert.equal(domainGuard('Bagaimana resep nasi goreng?').allowed, false));
test('normalization is deterministic', () => assert.equal(normalizeText('  PASPOR!!!  Baru  '), 'paspor baru'));
test('published sourced answer is usable', () => assert.equal(isAnswerUsable({ status: 'PUBLISHED', source_id: 'official' }), true));
test('internal document can never be attached', () => assert.equal(canAttachDocument({ ...VERIFIED_PUBLIC_DOCUMENT, access_classification: 'PRIVATE-INTERNAL' }), false));
test('restricted document is denied by default', () => assert.equal(canAttachDocument({ ...VERIFIED_PUBLIC_DOCUMENT, access_classification: 'RESTRICTED' }), false));
test('public document without verification is denied', () => assert.equal(canAttachDocument({ ...VERIFIED_PUBLIC_DOCUMENT, authority_status: 'UNVERIFIED' }), false));
test('public verified document can pass attachment gate', () => assert.equal(canAttachDocument(VERIFIED_PUBLIC_DOCUMENT), true));
test('answer engine resolves a known question without AI', () => {
  const answers = [{ id: 'A1', status: 'PUBLISHED', source_id: 'OFFICIAL-1', intent: 'PASSPORT_NEW', question_patterns: ['Bagaimana membuat paspor?'], answer_text: 'Gunakan kanal layanan resmi yang berlaku.' }];
  const result = resolveAnswer('Bagaimana membuat paspor?', answers);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.answer.id, 'A1');
});
test('answer engine refuses out-of-domain question', () => assert.equal(resolveAnswer('Cuaca hari ini bagaimana?', []).status, 'OUT_OF_DOMAIN'));
