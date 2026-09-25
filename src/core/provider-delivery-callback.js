import { createOutboxLeaseRepository } from './outbox-lease-repository.js';
import { createPostgresDeliveryIdentityResolver } from './postgres-delivery-reconciliation.js';
import { runTransactionalDeliveryReconciliation, createDeliveryReconciliationAudit } from './transactional-delivery-reconciliation.js';
import { normalizeProviderDeliveryStatus } from './delivery-reconciliation.js';
import { insertAuditEvent } from '../db/audit-repository.js';

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
      const normalized = normalizeProviderDeliveryStatus(identity._parsed.status);
      const result = await repo.reconcileProviderDelivery({
        outboxId: identity.outbox_id,
        providerMessageId: identity._parsed.provider_message_id ?? null,
        idempotencyKey: identity._parsed.idempotency_key ?? identity.idempotency_key,
        deliveryState: normalized.delivery_state
      });
      if (!result) return { matched:false };
      return { matched:true, normalized, previous_delivery_state: result.previous_delivery_state ?? null, outbound_provider_message_id:result.provider_message_id };
    },
    writeAudit: async (tx, data) => {
      const event = createDeliveryReconciliationAudit({ identity:data.identity, result:data.result, actorId });
      const persisted = await insertAuditEvent(tx, event);
      return persisted ? [persisted] : [];
    }
  });
}