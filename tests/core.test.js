import test from 'node:test';
import assert from 'node:assert/strict';
import { domainGuard } from '../src/core/domain-guard.js';
import { normalizeText } from '../src/core/normalization.js';
import { isAnswerUsable, canAttachDocument } from '../src/core/policy-engine.js';
import { resolveAnswer } from '../src/core/answer-engine.js';

test('domain guard allows immigration questions', () => {
  assert.equal(domainGuard('Bagaimana membuat paspor?').allowed, true);
});

test('domain guard rejects unrelated questions', () => {
  assert.equal(domainGuard('Bagaimana resep nasi goreng?').allowed, false);
});

test('normalization is deterministic', () => {
  assert.equal(normalizeText('  PASPOR!!!  Baru  '), 'paspor baru');
});

test('published sourced answer is usable', () => {
  assert.equal(isAnswerUsable({ status: 'PUBLISHED', source_id: 'official' }), true);
});

test('internal document can never be attached', () => {
  assert.equal(canAttachDocument({ access_classification: 'PRIVATE-INTERNAL', status: 'PUBLISHED', allow_whatsapp_attachment: true }), false);
});

test('public published approved document can pass attachment gate', () => {
  assert.equal(canAttachDocument({ access_classification: 'PUBLIC', status: 'PUBLISHED', allow_whatsapp_attachment: true }), true);
});

test('answer engine resolves an exact known question without AI', () => {
  const answers = [{
    id: 'A1',
    status: 'PUBLISHED',
    source_id: 'OFFICIAL-1',
    question_patterns: ['Bagaimana membuat paspor?'],
    answer_text: 'Gunakan kanal layanan resmi yang berlaku.'
  }];
  const result = resolveAnswer('Bagaimana membuat paspor?', answers);
  assert.equal(result.status, 'RESOLVED');
  assert.equal(result.answer.id, 'A1');
});

test('answer engine refuses an out-of-domain question', () => {
  const result = resolveAnswer('Cuaca hari ini bagaimana?', []);
  assert.equal(result.status, 'OUT_OF_DOMAIN');
});
