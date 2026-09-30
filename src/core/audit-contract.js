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
  ANSWER_SERVED: 'ANSWER_SERVED',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  MESSAGE_DUPLICATE: 'MESSAGE_DUPLICATE',
  CONVERSATION_TRANSITIONED: 'CONVERSATION_TRANSITIONED',
  OUTBOX_ENQUEUED: 'OUTBOX_ENQUEUED',
  DELIVERY_SENT: 'DELIVERY_SENT',
  DELIVERY_STATUS_RECONCILED: 'DELIVERY_STATUS_RECONCILED',
  DELIVERY_RETRY: 'DELIVERY_RETRY',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  DELIVERY_LEASE_LOST: 'DELIVERY_LEASE_LOST'
});

export function createAuditEvent({ actorId = null, eventType, subjectType, subjectId, before = null, after = null, reason = null, correlationId = null, at = new Date() }) {
  if (!eventType || !AUDIT_EVENTS[eventType]) throw new Error('INVALID_AUDIT_EVENT_TYPE');
  if (!subjectType || !subjectId) throw new Error('INVALID_AUDIT_EVENT');
  if (correlationId !== null && !String(correlationId).trim()) throw new Error('INVALID_AUDIT_CORRELATION');
  return Object.freeze({
    actor_id: actorId,
    event_type: eventType,
    subject_type: subjectType,
    subject_id: subjectId,
    before_json: before,
    after_json: after,
    reason,
    correlation_id: correlationId,
    created_at: new Date(at).toISOString()
  });
}
