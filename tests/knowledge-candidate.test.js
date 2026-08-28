import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeCandidate } from '../src/core/knowledge-candidate.js';

test('knowledge candidate always starts in review', () => {
  const candidate = buildKnowledgeCandidate({
    documentId: 'D1', sourceId: 'S1', intent: 'PASSPORT_NEW',
    questionPatterns: ['syarat paspor baru', 'buat paspor'], answerText: 'Informasi resmi.'
  });
  assert.equal(candidate.status, 'REVIEW');
  assert.equal(candidate.question_patterns.length, 2);
});

test('invalid candidate cannot be created', () => {
  assert.throws(() => buildKnowledgeCandidate({ documentId: 'D1', sourceId: 'S1', intent: 'PASSPORT_NEW', questionPatterns: [], answerText: '' }), /INVALID_KNOWLEDGE_CANDIDATE/);
});
