import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidence, validateEvidenceForAnswer } from '../src/core/evidence-citation.js';

test('evidence requires complete provenance', () => {
  const evidence = buildEvidence({ documentId: 'D1', documentVersionId: 'DV1', sourceId: 'S1', page: 4, section: 'Pasal 5', excerpt: 'Ketentuan...' });
  assert.equal(evidence.page, 4);
  assert.equal(validateEvidenceForAnswer([evidence]).valid, true);
});

test('answer without evidence is blocked', () => {
  assert.equal(validateEvidenceForAnswer([]).valid, false);
});

test('invalid page is rejected', () => {
  assert.throws(() => buildEvidence({ documentId: 'D1', documentVersionId: 'DV1', sourceId: 'S1', page: 0 }), /INVALID_EVIDENCE_PAGE/);
});
