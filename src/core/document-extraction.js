export const EXTRACTION_STATES = Object.freeze(['QUEUED','EXTRACTING','EXTRACTED','PARTIAL','FAILED']);

const SUPPORTED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain'
]);

export function createExtractionJob({ documentId, mediaType, storageKey }) {
  if (!documentId || !storageKey) throw new Error('INVALID_EXTRACTION_JOB');
  if (!SUPPORTED_TYPES.has(mediaType)) throw new Error('UNSUPPORTED_EXTRACTION_TYPE');
  return Object.freeze({ document_id: documentId, media_type: mediaType, storage_key: storageKey, state: 'QUEUED' });
}

export function normalizeExtractedText(text) {
  return String(text ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildExtractedDocument({ text, pages = [], metadata = {}, extractor = 'unknown', extractorVersion = 'unknown' }) {
  const normalizedText = normalizeExtractedText(text);
  return Object.freeze({
    text: normalizedText,
    text_length: normalizedText.length,
    pages: Array.isArray(pages) ? pages : [],
    metadata: metadata ?? {},
    extractor,
    extractor_version: extractorVersion,
    extraction_quality: normalizedText.length > 0 ? 'TEXT_AVAILABLE' : 'NO_TEXT'
  });
}
