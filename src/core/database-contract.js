export const ACCESS_CLASSIFICATIONS = Object.freeze(['PUBLIC', 'PRIVATE-INTERNAL', 'RESTRICTED']);
export const DOCUMENT_STATUSES = Object.freeze([
  'PENDING_SCAN', 'QUARANTINED', 'REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'EXPIRED', 'ARCHIVED'
]);

export function canPublishDocument(document) {
  return Boolean(
    document &&
    document.access_classification === 'PUBLIC' &&
    document.status === 'PUBLISHED' &&
    document.immigration_relevance_status === 'VERIFIED' &&
    document.authority_status === 'VERIFIED' &&
    document.content_integrity_status === 'VERIFIED' &&
    document.approval_id &&
    document.quarantined !== true
  );
}

export function canSendWhatsAppAttachment(document, context = {}) {
  return Boolean(
    canPublishDocument(document) &&
    document.allow_whatsapp_attachment === true &&
    document.effective_from <= (context.now ?? new Date().toISOString()) &&
    (!document.effective_until || document.effective_until > (context.now ?? new Date().toISOString())) &&
    context.intent && Array.isArray(document.allowed_intents) && document.allowed_intents.includes(context.intent)
  );
}
