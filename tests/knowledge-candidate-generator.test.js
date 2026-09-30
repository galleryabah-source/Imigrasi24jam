import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDocumentStructure, inferImmigrationTopics, buildKnowledgeCandidates } from '../src/core/knowledge-candidate-generator.js';

test('document structure extracts sections and regulation references', () => {
  const result = detectDocumentStructure('BAB I Ketentuan Umum. Pasal 1. UU No. 6/2011 tentang Keimigrasian.');
  assert.ok(result.sections.length >= 1);
  assert.ok(result.regulation_references.length >= 1);
});

test('topic inference is deterministic and AI independent', () => {
  assert.deepEqual(inferImmigrationTopics('Informasi visa dan izin tinggal untuk WNA.'), ['VISA', 'STAY_PERMIT', 'FOREIGN_NATIONAL']);
});

test('candidate generation preserves provenance and review gate', () => {
  const candidates = buildKnowledgeCandidates({ documentId: 'D1', sourceId: 'S1', extractedText: 'UU No. 6/2011 mengatur paspor dan visa WNA.' });
  assert.ok(candidates.length >= 2);
  for (const candidate of candidates) {
    assert.equal(candidate.document_id, 'D1');
    assert.equal(candidate.source_id, 'S1');
    assert.equal(candidate.status, 'REVIEW');
    assert.ok(candidate.question_patterns.length > 0);
  }
});

test('candidate generation rejects missing provenance', () => {
  assert.throws(() => buildKnowledgeCandidates({ documentId: 'D1', extractedText: 'paspor' }), /KNOWLEDGE_PROVENANCE_REQUIRED/);
});
