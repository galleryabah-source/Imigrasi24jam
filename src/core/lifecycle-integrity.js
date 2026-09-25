import { createDeliveryIdempotencyKey } from './outbox-worker.js';

export const LIFECYCLE_EVENT_TYPES = Object.freeze([
  'MESSAGE_RECEIVED',
  'MESSAGE_DUPLICATE',
  'CONVERSATION_TRANSITIONED',
  'OUTBOX_ENQUEUED',
  'DELIVERY_SENT',
  'DELIVERY_RETRY',
  'DELIVERY_FAILED',
  'DELIVERY_LEASE_LOST',
  'ANSWER_SERVED'
]);

export function createLifecycleIdentity({ provider, providerMessageId, inboundId, conversationId, outboxId, attempt = 0, correlationId }) {
  if (!provider || !providerMessageId || !inboundId || !conversationId || !outboxId || !correlationId) {
    throw new Error('LIFECYCLE_IDENTITY_REQUIRED');
  }
  const idempotencyKey = createDeliveryIdempotencyKey({ provider, outboundId: outboxId, conversationId, attempt });
  return Object.freeze({
    provider,
    provider_message_id: providerMessageId,
    inbound_id: inboundId,
    conversation_id: conversationId,
    outbox_id: outboxId,
    attempt,
    idempotency_key: idempotencyKey,
    correlation_id: String(correlationId)
  });
}

export function assertLifecycleIntegrity({ identity, inbound, outbox, delivery, auditEvents = [] }) {
  if (!identity) throw new Error('LIFECYCLE_IDENTITY_REQUIRED');
  if (!inbound || inbound.id !== identity.inbound_id || inbound.provider !== identity.provider || inbound.provider_message_id !== identity.provider_message_id) {
    throw new Error('LIFECYCLE_INBOUND_MISMATCH');
  }
  if (!outbox || outbox.id !== identity.outbox_id || outbox.conversation_id !== identity.conversation_id || outbox.reply_to_message_id !== identity.inbound_id) {
    throw new Error('LIFECYCLE_OUTBOX_MISMATCH');
  }
  if (!delivery || delivery.conversation_id !== identity.conversation_id || delivery.idempotency_key !== identity.idempotency_key) {
    throw new Error('LIFECYCLE_DELIVERY_MISMATCH');
  }
  if (!['SENT', 'RETRY', 'FAILED', 'PROCESSING', 'PENDING'].includes(delivery.delivery_state)) {
    throw new Error('INVALID_DELIVERY_STATE');
  }
  for (const event of auditEvents) {
    if (event.correlation_id !== identity.correlation_id) throw new Error('LIFECYCLE_AUDIT_CORRELATION_MISMATCH');
    if (!LIFECYCLE_EVENT_TYPES.includes(event.event_type)) throw new Error('LIFECYCLE_AUDIT_EVENT_MISMATCH');
  }
  return true;
}

export function reconcileProviderDelivery({ identity, providerMessageId = null, idempotencyKey = null, status }) {
  if (!identity || !status) throw new Error('RECONCILIATION_INPUT_REQUIRED');
  if (providerMessageId && providerMessageId === identity.provider_message_id) return Object.freeze({ matched: true, by: 'PROVIDER_MESSAGE_ID', status });
  if (idempotencyKey && idempotencyKey === identity.idempotency_key) return Object.freeze({ matched: true, by: 'IDEMPOTENCY_KEY', status });
  return Object.freeze({ matched: false, by: null, status });
}
