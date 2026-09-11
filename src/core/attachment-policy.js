const LEVELS = Object.freeze(['PUBLIC', 'PRIVATE-INTERNAL', 'RESTRICTED']);

export function evaluateAttachment(document, { whatsapp = true } = {}) {
  if (!document) return Object.freeze({ allowed: false, reason: 'DOCUMENT_REQUIRED' });
  const classification = String(document.access_classification ?? document.classification ?? '').toUpperCase();
  if (!LEVELS.includes(classification)) return Object.freeze({ allowed: false, reason: 'INVALID_CLASSIFICATION' });
  if (classification !== 'PUBLIC') return Object.freeze({ allowed: false, reason: 'NON_PUBLIC_DOCUMENT' });
  if (whatsapp && document.allow_whatsapp_attachment !== true) return Object.freeze({ allowed: false, reason: 'WHATSAPP_ATTACHMENT_DISABLED' });
  if (document.status !== 'PUBLISHED') return Object.freeze({ allowed: false, reason: 'DOCUMENT_NOT_PUBLISHED' });
  if (document.immigration_valid !== true) return Object.freeze({ allowed: false, reason: 'DOCUMENT_NOT_VALIDATED' });
  if (document.authority_valid !== true) return Object.freeze({ allowed: false, reason: 'AUTHORITY_NOT_VALIDATED' });
  if (document.integrity_verified !== true) return Object.freeze({ allowed: false, reason: 'INTEGRITY_NOT_VERIFIED' });
  return Object.freeze({ allowed: true, reason: 'PUBLIC_ATTACHMENT_ALLOWED', document_id: document.id });
}
