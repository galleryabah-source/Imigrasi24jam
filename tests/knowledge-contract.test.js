import test from 'node:test';
import assert from 'node:assert/strict';
import { validateKnowledgeRecord, validateDocumentPublication, DOCUMENT_ACCESS } from '../src/core/knowledge-contract.js';

test('knowledge requires provenance and question patterns', () => {
  assert.equal(validateKnowledgeRecord({ id: 'K1', intent: 'PASSPORT_NEW', question_patterns: ['buat paspor'], source_id: 'S1', status: 'PUBLISHED' }).valid, true);
});

test('knowledge without source is rejected', () => {
  assert.equal(validateKnowledgeRecord({ id: 'K1', intent: 'PASSPORT_NEW', question_patterns: ['buat paspor'], status: 'PUBLISHED' }).valid, false);
});

test('public document publication requires verified relevance, authority and integrity', () => {
  const result = validateDocumentPublication({
    id: 'D1', access_classification: DOCUMENT_ACCESS.PUBLIC, status: 'PUBLISHED',
    immigration_relevance_status: 'VERIFIED', authority_status: 'VERIFIED', content_integrity_status: 'VERIFIED'
  });
  assert.equal(result.valid, true);
});

test('private document fails public publication gate', () => {
  const result = validateDocumentPublication({
    id: 'D2', access_classification: DOCUMENT_ACCESS.PRIVATE_INTERNAL, status: 'PUBLISHED',
    immigration_relevance_status: 'VERIFIED', authority_status: 'VERIFIED', content_integrity_status: 'VERIFIED'
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.includes('INVALID_ACCESS_CLASSIFICATION'), false);
});
