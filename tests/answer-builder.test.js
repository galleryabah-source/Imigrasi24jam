import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeterministicAnswer, renderPlainAnswer } from '../src/core/answer-builder.js';

test('answer builder only uses published knowledge and verified evidence', () => {
  const answer = buildDeterministicAnswer({ knowledge: { id: 'K1', status: 'PUBLISHED', direct_answer: 'Jawaban resmi.' }, evidence: [{ id: 'E1', status: 'VERIFIED' }] });
  assert.equal(answer.direct_answer, 'Jawaban resmi.');
  assert.deepEqual(answer.evidence_ids, ['E1']);
});

test('unverified evidence blocks answer generation', () => {
  assert.throws(() => buildDeterministicAnswer({ knowledge: { id: 'K1', status: 'PUBLISHED', direct_answer: 'Jawaban.' }, evidence: [{ id: 'E1', status: 'REVIEW' }] }), /VERIFIED_EVIDENCE_REQUIRED/);
});

test('renderer does not invent omitted fields', () => {
  const text = renderPlainAnswer({ direct_answer: 'Jawaban resmi.' });
  assert.equal(text, 'Jawaban resmi.');
});
