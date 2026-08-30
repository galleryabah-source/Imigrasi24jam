import test from 'node:test';
import assert from 'node:assert/strict';
import { createExtractionJob, normalizeExtractedText, buildExtractedDocument } from '../src/core/document-extraction.js';

test('extraction job validates supported media', () => {
  const job = createExtractionJob({ documentId: 'D1', mediaType: 'application/pdf', storageKey: 'documents/D1' });
  assert.equal(job.state, 'QUEUED');
  assert.throws(() => createExtractionJob({ documentId: 'D2', mediaType: 'image/jpeg', storageKey: 'documents/D2' }), /UNSUPPORTED_EXTRACTION_TYPE/);
});

test('extracted text is normalized deterministically', () => {
  assert.equal(normalizeExtractedText(' A  B\r\n\r\n\r\n C\u0000 '), 'A B\n\nC');
});

test('extraction result records provenance and quality', () => {
  const result = buildExtractedDocument({ text: 'Paspor\n  WNA', pages: [{ page: 1 }], extractor: 'native', extractorVersion: '1.0' });
  assert.equal(result.text, 'Paspor\nWNA');
  assert.equal(result.extractor, 'native');
  assert.equal(result.extraction_quality, 'TEXT_AVAILABLE');
});

test('empty extraction is explicitly marked no text', () => {
  assert.equal(buildExtractedDocument({ text: '' }).extraction_quality, 'NO_TEXT');
});
