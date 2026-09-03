function requireWorkerId(workerId) {
  if (!workerId || typeof workerId !== 'string') throw new Error('INBOX_WORKER_ID_REQUIRED');
  return workerId;
}

function requireLeaseSeconds(leaseSeconds) {
  if (!Number.isInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('INVALID_INBOX_LEASE_SECONDS');
  return leaseSeconds;
}

export function createInboxOutboxRepository(db) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');

  return Object.freeze({
    async claimInbound({ provider, providerMessageId, conversationId, sender, payload }) {
      const result = await db.query(`
        INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (provider, provider_message_id) DO NOTHING
        RETURNING id, processing_status
      `, [provider, providerMessageId, conversationId, sender, payload ?? {}]);
      return result.rows[0] ?? null;
    },

    async claimPendingInbound({ workerId, leaseSeconds = 60 } = {}) {
      requireWorkerId(workerId);
      requireLeaseSeconds(leaseSeconds);
      const result = await db.query(`
        WITH candidate AS (
          SELECT id
          FROM message_inbox
          WHERE processing_status = 'RECEIVED'
             OR (processing_status = 'PROCESSING' AND lease_expires_at <= now())
          ORDER BY received_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE message_inbox i
        SET processing_status='PROCESSING',
            lease_owner=$1,
            lease_expires_at=now() + ($2 * interval '1 second'),
            attempt_count=i.attempt_count + 1
        FROM candidate c
        WHERE i.id=c.id
        RETURNING i.*
      `, [workerId, leaseSeconds]);
      return result.rows[0] ?? null;
    },

    async enqueueOutbound({ conversationId, replyToMessageId, provider, payload }) {
      const result = await db.query(`
        INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json)
        VALUES ($1,$2,$3,$4)
        RETURNING id, delivery_state
      `, [conversationId, replyToMessageId, provider, payload ?? {}]);
      return result.rows[0];
    },

    async completeInboundWithOutbound({ inboxId, conversationId, replyToMessageId, provider, payload, workerId }) {
      if (typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
      requireWorkerId(workerId);
      return db.transaction(async (tx) => {
        const outbox = await tx.query(`
          INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json)
          VALUES ($1,$2,$3,$4)
          RETURNING id, delivery_state
        `, [conversationId, replyToMessageId, provider, payload ?? {}]);
        const processed = await tx.query(`
          UPDATE message_inbox
          SET processing_status='PROCESSED', processed_at=now(), lease_owner=NULL, lease_expires_at=NULL
          WHERE id=$1 AND processing_status='PROCESSING' AND lease_owner=$2
          RETURNING id
        `, [inboxId, workerId]);
        if (processed.rowCount !== 1) throw new Error('INBOX_LEASE_LOST');
        return outbox.rows[0];
      });
    },

    async markInboundProcessed(id, workerId) {
      requireWorkerId(workerId);
      const result = await db.query(`UPDATE message_inbox SET processing_status='PROCESSED', processed_at=now(), lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND processing_status='PROCESSING' AND lease_owner=$2 RETURNING id`, [id, workerId]);
      if (result.rowCount !== 1) throw new Error('INBOX_LEASE_LOST');
      return result.rows[0];
    },

    async markInboundFailed(id, error, workerId) {
      requireWorkerId(workerId);
      const result = await db.query(`UPDATE message_inbox SET processing_status='FAILED', lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND processing_status='PROCESSING' AND lease_owner=$2 RETURNING id`, [id, workerId]);
      if (result.rowCount !== 1) throw new Error('INBOX_LEASE_LOST');
      return Object.freeze({ id, error: String(error ?? '').slice(0, 2000) });
    }
  });
}
