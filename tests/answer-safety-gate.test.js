import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnswerSafety } from '../src/core/answer-safety-gate.js';

test('verified sourced answer can pass safety gate', () => {
  const result = evaluateAnswerSafety({ intent: 'PASSPORT_NEW', answer: 'Informasi layanan paspor.', sources: [{ id: 'S1' }], confidence: 0.9, providerAvailable: false });
  assert.equal(result.decision, 'ANSWER');
  assert.equal(result.provider_used, false);
});

test('AI availability does not bypass safety rules', () => {
  const result = evaluateAnswerSafety({ intent: 'PASSPORT_NEW', answer: 'Informasi.', sources: [], confidence: 0.99, providerAvailable: true });
  assert.equal(result.decision, 'SAFE_FALLBACK');
  assert.equal(result.requires_human_review, true);
});

test('out-of-scope intent is blocked', () => {
  const result = evaluateAnswerSafety({ intent: 'OUT_OF_SCOPE_GENERAL', answer: 'Jawaban.', sources: [{ id: 'S1' }], confidence: 0.99 });
  assert.equal(result.decision, 'SAFE_FALLBACK');
});
