export function createOutboxLeaseRepository(db, { workerId, leaseSeconds = 60 } = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');
  if (!workerId) throw new Error('WORKER_ID_REQUIRED');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('INVALID_LEASE_SECONDS');

  return Object.freeze({
    async claimPendingOutbound() {
      const result = await db.query(`
        WITH candidate AS (
          SELECT id
          FROM message_outbox
          WHERE (delivery_state IN ('PENDING','RETRY') AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
             OR (delivery_state = 'PROCESSING' AND lease_expires_at <= now())
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE message_outbox o
        SET delivery_state='PROCESSING',
            lease_owner=$1,
            lease_expires_at=now() + ($2 * interval '1 second'),
            attempt_count=o.attempt_count + 1
        FROM candidate c
        WHERE o.id=c.id
        RETURNING o.*
      `, [workerId, leaseSeconds]);
      return result.rows[0] ?? null;
    },

    async markOutboundSent(id, providerMessageId = null, idempotencyKey = null) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='SENT', provider_message_id=$2, last_error=CASE WHEN $3 IS NULL THEN last_error ELSE 'IDEMPOTENCY_KEY:' || $3 END, sent_at=now(), lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$4 RETURNING id`, [id, providerMessageId, idempotencyKey, workerId]);
      return result.rowCount === 1;
    },

    async scheduleOutboundRetry(id, delaySeconds, error) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='RETRY', next_attempt_at=now() + ($2 * interval '1 second'), last_error=$3, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$4 RETURNING id`, [id, delaySeconds, error, workerId]);
      return result.rowCount === 1;
    },

    async reconcileProviderDelivery({ outboxId, providerMessageId = null, idempotencyKey = null, deliveryState }) {
      if (!outboxId || !deliveryState) throw new Error('DELIVERY_RECONCILIATION_INPUT_REQUIRED');
      if (!['PROCESSING', 'SENT', 'FAILED'].includes(deliveryState)) throw new Error('INVALID_RECONCILIATION_STATE');
      const result = await db.query(`
        UPDATE message_outbox
        SET delivery_state=$4,
            provider_message_id=COALESCE(provider_message_id, $2),
            sent_at=CASE WHEN $4='SENT' THEN COALESCE(sent_at, now()) ELSE sent_at END,
            last_error=CASE
              WHEN $3 IS NULL THEN last_error
              ELSE 'IDEMPOTENCY_KEY:' || $3
            END,
            lease_owner=CASE WHEN $4 IN ('SENT','FAILED') THEN NULL ELSE lease_owner END,
            lease_expires_at=CASE WHEN $4 IN ('SENT','FAILED') THEN NULL ELSE lease_expires_at END
        WHERE id=$1
          AND delivery_state NOT IN ('SENT','FAILED')
          AND (
            ($2 IS NOT NULL AND provider_message_id=$2)
            OR ($3 IS NOT NULL AND last_error='IDEMPOTENCY_KEY:' || $3)
          )
        RETURNING id, delivery_state, provider_message_id, sent_at
      `, [outboxId, providerMessageId, idempotencyKey, deliveryState]);
      if (result.rows[0]) return { ...result.rows[0], no_op: false };

      const terminal = await db.query(`
        SELECT id, delivery_state, provider_message_id, sent_at
        FROM message_outbox
        WHERE id=$1
          AND delivery_state IN ('SENT','FAILED')
          AND (
            ($2 IS NOT NULL AND provider_message_id=$2)
            OR ($3 IS NOT NULL AND last_error='IDEMPOTENCY_KEY:' || $3)
          )
        LIMIT 1
      `, [outboxId, providerMessageId, idempotencyKey]);

      return terminal.rows[0] ? { ...terminal.rows[0], no_op: true } : null;
    },

    async markOutboundFailed(id, error) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='FAILED', last_error=$2, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$3 RETURNING id`, [id, error, workerId]);
      return result.rowCount === 1;
    }
  });
}
