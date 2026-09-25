import { createOutboxLeaseRepository } from './outbox-lease-repository.js';
import { createPostgresDeliveryIdentityResolver } from './postgres-delivery-reconciliation.js';
import { runTransactionalDeliveryReconciliation, createDeliveryReconciliationAudit } from './transactional-delivery-reconciliation.js';

export async function reconcileProviderCallbackTransaction(db, { provider, parseDeliveryStatus, request, actorId = null } = {}) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  if (!provider || typeof parseDeliveryStatus !== 'function') throw new Error('DELIVERY_CALLBACK_CONTRACT_REQUIRED');
  return runTransactionalDeliveryReconciliation(db, {
    resolveIdentity: async (tx) => {
      const parsed = await parseDeliveryStatus(request);
      if (!parsed || !parsed.status) throw new Error('INVALID_PROVIDER_DELIVERY_STATUS');
      const resolver = createPostgresDeliveryIdentityResolver(tx, { provider });
      const identity = await resolver(parsed);
      return identity ? { ...identity, _parsed: parsed } : null;
    },
    reconcile: async (tx, identity) => {
      const repo = createOutboxLeaseRepository(tx, { workerId: `reconciliation:${provider}` });
      const result = await repo.reconcileProviderDelivery({
        outboxId: identity.outbox_id,
        providerMessageId: identity._parsed.provider_message_id ?? null,
        idempotencyKey: identity._parsed.idempotency_key ?? identity.idempotency_key,
        deliveryState: identity._parsed.status === 'FAILED' ? 'FAILED' : 'SENT'
      });
      if (!result) return { matched:false };
      return { matched:true, normalized:{ provider_status:identity._parsed.status, delivery_state:result.delivery_state }, outbound_provider_message_id:result.provider_message_id };
    },
    writeAudit: async (tx, data) => {
      const event = createDeliveryReconciliationAudit({ identity:data.identity, result:data.result, actorId });
      const persisted = await tx.query(
        `INSERT INTO audit_events (id, actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, correlation_id) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8) RETURNING id`,
        [event.actor_id,event.event_type,event.subject_type,event.subject_id,JSON.stringify(event.before_json),JSON.stringify(event.after_json),event.reason,event.correlation_id]
      );
      return persisted.rows;
    }
  });
}