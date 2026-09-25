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

    async markOutboundSent(id, providerMessageId = null) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='SENT', provider_message_id=$2, sent_at=now(), lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$3 RETURNING id`, [id, providerMessageId, workerId]);
      return result.rowCount === 1;
    },

    async scheduleOutboundRetry(id, delaySeconds, error) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='RETRY', next_attempt_at=now() + ($2 * interval '1 second'), last_error=$3, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$4 RETURNING id`, [id, delaySeconds, error, workerId]);
      return result.rowCount === 1;
    },

    async markOutboundFailed(id, error) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='FAILED', last_error=$2, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$3 RETURNING id`, [id, error, workerId]);
      return result.rowCount === 1;
    }
  });
}
