export const AUDIT_EVENTS = Object.freeze({
  KNOWLEDGE_CREATED: 'KNOWLEDGE_CREATED',
  KNOWLEDGE_UPDATED: 'KNOWLEDGE_UPDATED',
  KNOWLEDGE_APPROVED: 'KNOWLEDGE_APPROVED',
  KNOWLEDGE_REJECTED: 'KNOWLEDGE_REJECTED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_VALIDATED: 'DOCUMENT_VALIDATED',
  DOCUMENT_QUARANTINED: 'DOCUMENT_QUARANTINED',
  DOCUMENT_APPROVED: 'DOCUMENT_APPROVED',
  DOCUMENT_PUBLISHED: 'DOCUMENT_PUBLISHED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  DOCUMENT_ATTACHED: 'DOCUMENT_ATTACHED',
  ANSWER_SERVED: 'ANSWER_SERVED'
});

export function createAuditEvent({ actorId = null, eventType, subjectType, subjectId, before = null, after = null, reason = null, at = new Date() }) {
  if (!eventType || !subjectType || !subjectId) throw new Error('INVALID_AUDIT_EVENT');
  return Object.freeze({ actor_id: actorId, event_type: eventType, subject_type: subjectType, subject_id: subjectId, before_json: before, after_json: after, reason, created_at: new Date(at).toISOString() });
}
