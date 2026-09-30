import { createLifecycleIdentity, createCanonicalCorrelationId } from './lifecycle-integrity.js';

export function createPostgresDeliveryIdentityResolver(db, { provider } = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');
  if (!provider) throw new Error('PROVIDER_REQUIRED');

  return async function resolveIdentity({
    outbox_id = null,
    provider_message_id = null,
    idempotency_key = null
  } = {}) {
    const result = await db.query(`
      SELECT
        o.id AS outbox_id,
        o.conversation_id,
        o.provider,
        o.provider_message_id AS outbound_provider_message_id,
        o.attempt_count,
        o.reply_to_message_id AS inbound_id,
        i.provider_message_id AS inbound_provider_message_id
      FROM message_outbox o
      JOIN message_inbox i ON i.id = o.reply_to_message_id
      WHERE o.provider = $1
        AND (
          ($2::text IS NOT NULL AND o.id::text = $2)
          OR ($3::text IS NOT NULL AND o.provider_message_id = $3)
          OR ($4::text IS NOT NULL AND o.last_error = 'IDEMPOTENCY_KEY:' || $4)
        )
      LIMIT 1
    `, [provider, outbox_id, provider_message_id, idempotency_key]);

    const row = result.rows[0];
    if (!row) return null;

    return createLifecycleIdentity({
      provider: row.provider,
      inboundProviderMessageId: row.inbound_provider_message_id,
      outboundProviderMessageId: row.outbound_provider_message_id ?? provider_message_id,
      inboundId: row.inbound_id,
      conversationId: row.conversation_id,
      outboxId: row.outbox_id,
      attempt: Number(row.attempt_count ?? 0),
      correlationId: createCanonicalCorrelationId({
        provider: row.provider,
        inboundProviderMessageId: row.inbound_provider_message_id
      })
    });
  };
}

export function createPostgresDeliveryPersistence(outboxRepository) {
  if (!outboxRepository || typeof outboxRepository.reconcileProviderDelivery !== 'function') {
    throw new Error('OUTBOX_REPOSITORY_RECONCILIATION_REQUIRED');
  }

  return async ({ identity, result }) => outboxRepository.reconcileProviderDelivery({
    outboxId: identity.outbox_id,
    providerMessageId: identity.outbound_provider_message_id ?? null,
    idempotencyKey: identity.idempotency_key,
    deliveryState: result.normalized.delivery_state
  });
}
