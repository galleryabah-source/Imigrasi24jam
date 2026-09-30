import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocumentMetadata, assessExtractedText, classifyValidationOutcome } from '../src/core/document-validator.js';

test('metadata validator rejects missing provenance fields', () => {
  const result = validateDocumentMetadata({ filename: 'x.pdf', media_type: 'application/pdf', access_classification: 'PUBLIC' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('MISSING_CHECKSUM'));
});

test('metadata validator accepts a structurally complete record', () => {
  assert.equal(validateDocumentMetadata({ filename: 'regulation.pdf', media_type: 'application/pdf', checksum_sha256: 'abc', uploader_id: 'U1', access_classification: 'PUBLIC' }).valid, true);
});

test('immigration text is classified as relevant', () => {
  const result = assessExtractedText('Undang-undang keimigrasian mengatur paspor, visa dan izin tinggal WNA.');
  assert.equal(result.immigration_relevance_status, 'VERIFIED');
});

test('unrelated text is held for review', () => {
  const result = assessExtractedText('Panduan memasak dan resep makanan untuk keluarga.');
  assert.equal(result.immigration_relevance_status, 'REVIEW_REQUIRED');
});

test('unverified integrity keeps a document quarantined', () => {
  const assessment = assessExtractedText('Undang-undang keimigrasian mengatur paspor dan visa WNA.');
  assert.equal(classifyValidationOutcome({ metadataValid: true, contentAssessment: assessment, integrityVerified: false }), 'QUARANTINED');
});

test('valid content still requires human review before publication', () => {
  const assessment = assessExtractedText('Undang-undang keimigrasian mengatur paspor dan visa WNA.');
  assert.equal(classifyValidationOutcome({ metadataValid: true, contentAssessment: assessment, integrityVerified: true }), 'REVIEW_REQUIRED');
});
