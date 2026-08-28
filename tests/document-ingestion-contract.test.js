import test from 'node:test';
import assert from 'node:assert/strict';
import { createIngestionRecord, transitionIngestion } from '../src/core/document-ingestion-contract.js';

test('new documents enter quarantine', () => {
  const record = createIngestionRecord({ id: 'D1', filename: 'regulation.pdf', mediaType: 'application/pdf', uploaderId: 'U1', accessClassification: 'PUBLIC' });
  assert.equal(record.state, 'RECEIVED');
  assert.equal(record.quarantined, true);
});

test('unsupported media is rejected before ingestion', () => {
  assert.throws(() => createIngestionRecord({ id: 'D2', filename: 'x.exe', mediaType: 'application/octet-stream', uploaderId: 'U1', accessClassification: 'PUBLIC' }), /UNSUPPORTED_DOCUMENT_TYPE/);
});

test('ingestion follows controlled validation sequence', () => {
  let record = createIngestionRecord({ id: 'D3', filename: 'law.pdf', mediaType: 'application/pdf', uploaderId: 'U1', accessClassification: 'PUBLIC' });
  for (const state of ['QUARANTINED', 'SCANNING', 'EXTRACTING', 'CLASSIFYING', 'REVIEW_REQUIRED', 'APPROVED', 'PUBLISHED']) record = transitionIngestion(record, state);
  assert.equal(record.state, 'PUBLISHED');
  assert.equal(record.quarantined, false);
});

test('invalid state transition is rejected', () => {
  const record = createIngestionRecord({ id: 'D4', filename: 'law.pdf', mediaType: 'application/pdf', uploaderId: 'U1', accessClassification: 'PUBLIC' });
  assert.throws(() => transitionIngestion(record, 'PUBLISHED'), /INVALID_INGESTION_TRANSITION/);
});

test('rejected documents cannot transition to published', () => {
  let record = createIngestionRecord({ id: 'D5', filename: 'wrong.pdf', mediaType: 'application/pdf', uploaderId: 'U1', accessClassification: 'PUBLIC' });
  record = transitionIngestion(record, 'QUARANTINED');
  record = transitionIngestion(record, 'REJECTED');
  assert.throws(() => transitionIngestion(record, 'PUBLISHED'), /INVALID_INGESTION_TRANSITION/);
});
