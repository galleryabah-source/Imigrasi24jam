import { reconcileProviderDelivery } from './lifecycle-integrity.js';

const STATUS_MAP = Object.freeze({
  ACCEPTED: 'PROCESSING',
  SENT: 'SENT',
  DELIVERED: 'SENT',
  READ: 'SENT',
  FAILED: 'FAILED'
});

export function normalizeProviderDeliveryStatus(status) {
  const normalized = String(status ?? '').trim().toUpperCase();
  const deliveryState = STATUS_MAP[normalized];
  if (!deliveryState) throw new Error('UNKNOWN_PROVIDER_DELIVERY_STATUS');
  return Object.freeze({ provider_status: normalized, delivery_state: deliveryState });
}

export function reconcileDeliveryStatus({ identity, providerMessageId = null, idempotencyKey = null, status }) {
  const normalized = normalizeProviderDeliveryStatus(status);
  const match = reconcileProviderDelivery({
    identity,
    providerMessageId,
    idempotencyKey,
    status: normalized.provider_status
  });
  if (!match.matched) return Object.freeze({ ...match, normalized });
  return Object.freeze({ ...match, normalized });
}

export function createDeliveryReconciliationContract({ parseDeliveryStatus, resolveIdentity, persist }) {
  if (typeof parseDeliveryStatus !== 'function') throw new Error('DELIVERY_STATUS_PARSER_REQUIRED');
  if (typeof resolveIdentity !== 'function') throw new Error('DELIVERY_IDENTITY_RESOLVER_REQUIRED');
  if (typeof persist !== 'function') throw new Error('DELIVERY_RECONCILIATION_PERSIST_REQUIRED');

  return Object.freeze({
    async reconcile(request) {
      const parsed = await parseDeliveryStatus(request);
      if (!parsed || !parsed.status) throw new Error('INVALID_PROVIDER_DELIVERY_STATUS');
      const identity = await resolveIdentity(parsed);
      if (!identity) return Object.freeze({ status: 'UNMATCHED' });
      const result = reconcileDeliveryStatus({
        identity,
        providerMessageId: parsed.provider_message_id ?? null,
        idempotencyKey: parsed.idempotency_key ?? null,
        status: parsed.status
      });
      if (!result.matched) return Object.freeze({ status: 'UNMATCHED', result });
      const persisted = await persist({ identity, result });
      return Object.freeze({ status: 'RECONCILED', result, persisted });
    }
  });
}
