export const DOCUMENT_ACCESS = Object.freeze({
  PUBLIC: 'PUBLIC',
  PRIVATE_INTERNAL: 'PRIVATE-INTERNAL',
  RESTRICTED: 'RESTRICTED'
});

export const KNOWLEDGE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  REVIEW: 'REVIEW',
  APPROVED: 'APPROVED',
  PUBLISHED: 'PUBLISHED',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
  QUARANTINED: 'QUARANTINED'
});

export function validateKnowledgeRecord(record) {
  const errors = [];
  if (!record?.id) errors.push('MISSING_ID');
  if (!record?.intent) errors.push('MISSING_INTENT');
  if (!Array.isArray(record?.question_patterns) || record.question_patterns.length === 0) errors.push('MISSING_QUESTION_PATTERNS');
  if (!record?.source_id) errors.push('MISSING_SOURCE');
  if (!Object.values(KNOWLEDGE_STATUS).includes(record?.status)) errors.push('INVALID_STATUS');
  return { valid: errors.length === 0, errors };
}

export function validateDocumentPublication(document) {
  const errors = [];
  if (!document?.id) errors.push('MISSING_ID');
  if (!Object.values(DOCUMENT_ACCESS).includes(document?.access_classification)) errors.push('INVALID_ACCESS_CLASSIFICATION');
  if (document?.status !== KNOWLEDGE_STATUS.PUBLISHED) errors.push('NOT_PUBLISHED');
  if (document?.immigration_relevance_status !== 'VERIFIED') errors.push('IMMIGRATION_RELEVANCE_NOT_VERIFIED');
  if (document?.authority_status !== 'VERIFIED') errors.push('AUTHORITY_NOT_VERIFIED');
  if (document?.content_integrity_status !== 'VERIFIED') errors.push('CONTENT_INTEGRITY_NOT_VERIFIED');
  return { valid: errors.length === 0, errors };
}
