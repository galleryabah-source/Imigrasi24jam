import { createHash } from 'node:crypto';

function requireWorkerId(workerId) {
  if (!workerId || typeof workerId !== 'string') throw new Error('INBOX_WORKER_ID_REQUIRED');
  return workerId;
}

function requireLeaseSeconds(leaseSeconds) {
  if (!Number.isInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('INVALID_INBOX_LEASE_SECONDS');
  return leaseSeconds;
}

function requireReplayTtlSeconds(ttlSeconds) {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 86400) throw new Error('INVALID_REPLAY_TTL_SECONDS');
  return ttlSeconds;
}

function requireConversationVersion(version) {
  if (!Number.isInteger(version) || version < 0) throw new Error('CONVERSATION_VERSION_REQUIRED');
}

function conversationParams(conversation) {
  return [conversation.user_id ?? null, conversation.state, conversation.scope ?? null, conversation.intent ?? null,
    conversation.sub_intent ?? null, conversation.pending_question ?? null, conversation.turn_count ?? 0,
    conversation.conversation_id];
}

async function persistConversation(tx, conversation, expectedConversationVersion) {
  requireConversationVersion(expectedConversationVersion);
  const saved = await tx.query(`
    UPDATE conversations
    SET user_id=$1, state=$2, scope=$3, intent=$4, sub_intent=$5,
        pending_question=$6, turn_count=$7, version=version+1, updated_at=now()
    WHERE conversation_key=$8 AND version=$9 RETURNING *
  `, [...conversationParams(conversation), expectedConversationVersion]);
  if (saved.rowCount !== 1) throw new Error('CONVERSATION_VERSION_CONFLICT');
  return saved.rows[0];
}

async function markInboundProcessedInTransaction(tx, inboxId, workerId) {
  const processed = await tx.query(`
    UPDATE message_inbox
    SET processing_status='PROCESSED', processed_at=now(), lease_owner=NULL, lease_expires_at=NULL
    WHERE id=$1 AND processing_status='PROCESSING' AND lease_owner=$2 RETURNING id
  `, [inboxId, workerId]);
  if (processed.rowCount !== 1) throw new Error('INBOX_LEASE_LOST');
  return processed.rows[0];
}

function normalizeReplayKey(replayKey) {
  const key = String(replayKey ?? '').trim();
  if (!key) throw new Error('REPLAY_KEY_REQUIRED');
  return key;
}

function replayKeyHash(replayKey) {
  return createHash('sha256').update(normalizeReplayKey(replayKey), 'utf8').digest('hex');
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

    async claimInboundWithReplay({ provider, providerMessageId, conversationId, sender, payload, replayKey, ttlSeconds = 300 }) {
      if (typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
      const keyHash = replayKeyHash(replayKey);
      requireReplayTtlSeconds(ttlSeconds);

      return db.transaction(async (tx) => {
        const inbox = await tx.query(`
          INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (provider, provider_message_id) DO NOTHING
          RETURNING id, processing_status
        `, [provider, providerMessageId, conversationId, sender, payload ?? {}]);

        if (inbox.rowCount !== 1) {
          return Object.freeze({ accepted: false, inboxId: null, reason: 'DUPLICATE_INBOX' });
        }

        const replay = await tx.query(`
          INSERT INTO webhook_replay (key_hash, expires_at)
          VALUES ($1, now() + ($2 * interval '1 second'))
          ON CONFLICT (key_hash) DO UPDATE
            SET expires_at=EXCLUDED.expires_at
          WHERE webhook_replay.expires_at <= now()
          RETURNING key_hash
        `, [keyHash, ttlSeconds]);

        if (replay.rowCount !== 1) throw new Error('WEBHOOK_REPLAY_REJECTED');
        return Object.freeze({ accepted: true, inboxId: inbox.rows[0].id, reason: 'ADMITTED' });
      });
    },

    async claimPendingInbound({ workerId, leaseSeconds = 60 } = {}) {
      requireWorkerId(workerId); requireLeaseSeconds(leaseSeconds);
      const result = await db.query(`
        WITH candidate AS (
          SELECT id FROM message_inbox
          WHERE processing_status = 'RECEIVED'
             OR (processing_status = 'PROCESSING' AND lease_expires_at <= now())
          ORDER BY received_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE message_inbox i
        SET processing_status='PROCESSING', lease_owner=$1,
            lease_expires_at=now() + ($2 * interval '1 second'), attempt_count=i.attempt_count + 1
        FROM candidate c WHERE i.id=c.id RETURNING i.*
      `, [workerId, leaseSeconds]);
      return result.rows[0] ?? null;
    },

    async enqueueOutbound({ conversationId, replyToMessageId, provider, payload }) {
      const result = await db.query(`
        INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json)
        VALUES ($1,$2,$3,$4) RETURNING id, delivery_state
      `, [conversationId, replyToMessageId, provider, payload ?? {}]);
      return result.rows[0];
    },

    async completeInboundWithConversation({ inboxId, conversation, expectedConversationVersion, workerId }) {
      if (typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
      requireWorkerId(workerId);
      return db.transaction(async (tx) => {
        const saved = await persistConversation(tx, conversation, expectedConversationVersion);
        await markInboundProcessedInTransaction(tx, inboxId, workerId);
        return Object.freeze({ conversation: saved, inboxId });
      });
    },

    async completeInboundWithOutbound({ inboxId, conversationId, replyToMessageId, provider, payload, workerId }) {
      if (typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
      requireWorkerId(workerId);
      return db.transaction(async (tx) => {
        const outbox = await tx.query(`INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json) VALUES ($1,$2,$3,$4) RETURNING id, delivery_state`, [conversationId, replyToMessageId, provider, payload ?? {}]);
        await markInboundProcessedInTransaction(tx, inboxId, workerId);
        return outbox.rows[0];
      });
    },

    async completeInboundWithOutboundAndConversation({ inboxId, conversation, expectedConversationVersion, conversationId, replyToMessageId, provider, payload, workerId }) {
      if (typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
      requireWorkerId(workerId);
      return db.transaction(async (tx) => {
        const saved = await persistConversation(tx, conversation, expectedConversationVersion);
        const outbox = await tx.query(`INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json) VALUES ($1,$2,$3,$4) RETURNING id, delivery_state`, [conversationId, replyToMessageId, provider, payload ?? {}]);
        await markInboundProcessedInTransaction(tx, inboxId, workerId);
        return Object.freeze({ conversation: saved, outbox: outbox.rows[0] });
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
