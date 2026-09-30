import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Hex, normalizeDocumentFingerprint, classifyDuplicate } from '../src/core/document-fingerprint.js';

test('sha256 fingerprint is deterministic', () => {
  assert.equal(sha256Hex('imigrasi24jam'), sha256Hex('imigrasi24jam'));
  assert.notEqual(sha256Hex('a'), sha256Hex('b'));
});

test('fingerprint metadata is normalized', () => {
  const result = normalizeDocumentFingerprint({ checksumSha256: 'ABC123', filename: ' LAW.PDF ', mediaType: ' APPLICATION/PDF ' });
  assert.equal(result.checksum_sha256, 'abc123');
  assert.equal(result.filename, 'law.pdf');
  assert.equal(result.media_type, 'application/pdf');
});

test('exact duplicates are rejected from fresh ingestion', () => {
  assert.equal(classifyDuplicate({ checksumExists: true }), 'EXACT_DUPLICATE');
});

test('possible semantic duplicates require review', () => {
  assert.equal(classifyDuplicate({ checksumExists: false, semanticDuplicate: true }), 'POSSIBLE_DUPLICATE_REVIEW');
});
