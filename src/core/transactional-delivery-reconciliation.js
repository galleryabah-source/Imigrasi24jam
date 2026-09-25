import { createAuditEvent, AUDIT_EVENTS } from './audit-contract.js';

export async function runTransactionalDeliveryReconciliation(db, workflow) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  const required = ['resolveIdentity', 'reconcile', 'writeAudit'];
  if (!workflow || required.some((name) => typeof workflow[name] !== 'function')) {
    throw new Error('INVALID_DELIVERY_RECONCILIATION_WORKFLOW');
  }

  return db.transaction(async (tx) => {
    const identity = await workflow.resolveIdentity(tx);
    if (!identity) return Object.freeze({ status: 'UNMATCHED', identity: null, result: null, audit: [] });

    const result = await workflow.reconcile(tx, identity);
    if (!result || result.matched !== true) {
      return Object.freeze({ status: 'UNMATCHED', identity, result, audit: [] });
    }

    const audit = await workflow.writeAudit(tx, {
      identity,
      result,
      eventType: result.normalized.delivery_state === 'FAILED'
        ? AUDIT_EVENTS.DELIVERY_FAILED
        : AUDIT_EVENTS.DELIVERY_SENT
    });

    return Object.freeze({ status: 'RECONCILED', identity, result, audit });
  });
}

export function createDeliveryReconciliationAudit({ identity, result, actorId = null }) {
  const eventType = result.normalized.delivery_state === 'FAILED'
    ? AUDIT_EVENTS.DELIVERY_FAILED
    : result.normalized.delivery_state === 'SENT'
      ? AUDIT_EVENTS.DELIVERY_SENT
      : AUDIT_EVENTS.DELIVERY_STATUS_RECONCILED;

  return createAuditEvent({
    actorId,
    eventType,
    subjectType: 'CONVERSATION',
    subjectId: identity.conversation_id,
    correlationId: identity.correlation_id,
    before: { delivery_state: result.previous_delivery_state ?? null },
    after: {
      delivery_state: result.normalized.delivery_state,
      provider_status: result.normalized.provider_status,
      outbound_provider_message_id: identity.outbound_provider_message_id ?? null
    }
  });
}
