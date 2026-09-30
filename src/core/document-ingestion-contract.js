export const INGESTION_STATES = Object.freeze([
  'RECEIVED', 'QUARANTINED', 'SCANNING', 'EXTRACTING', 'CLASSIFYING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'PUBLISHED'
]);

export const SUPPORTED_DOCUMENT_TYPES = Object.freeze([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain'
]);

export function createIngestionRecord({ id, filename, mediaType, uploaderId, accessClassification }) {
  if (!id || !filename || !mediaType || !uploaderId) throw new Error('INVALID_INGESTION_RECORD');
  if (!SUPPORTED_DOCUMENT_TYPES.includes(mediaType)) throw new Error('UNSUPPORTED_DOCUMENT_TYPE');
  if (!['PUBLIC', 'PRIVATE-INTERNAL', 'RESTRICTED'].includes(accessClassification)) throw new Error('INVALID_ACCESS_CLASSIFICATION');
  return Object.freeze({
    id, filename, media_type: mediaType, uploader_id: uploaderId,
    access_classification: accessClassification,
    state: 'RECEIVED', quarantined: true
  });
}

export function transitionIngestion(record, nextState) {
  if (!record || !INGESTION_STATES.includes(nextState)) throw new Error('INVALID_INGESTION_STATE');
  const allowed = {
    RECEIVED: ['QUARANTINED'],
    QUARANTINED: ['SCANNING', 'REJECTED'],
    SCANNING: ['EXTRACTING', 'REJECTED'],
    EXTRACTING: ['CLASSIFYING', 'REJECTED'],
    CLASSIFYING: ['REVIEW_REQUIRED', 'REJECTED'],
    REVIEW_REQUIRED: ['APPROVED', 'REJECTED'],
    APPROVED: ['PUBLISHED'],
    REJECTED: [],
    PUBLISHED: []
  };
  if (!allowed[record.state]?.includes(nextState)) throw new Error(`INVALID_INGESTION_TRANSITION:${record.state}->${nextState}`);
  return Object.freeze({ ...record, state: nextState, quarantined: !['APPROVED', 'PUBLISHED'].includes(nextState) });
}
