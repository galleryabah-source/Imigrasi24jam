import { createHash } from 'node:crypto';

function hashReplayKey(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

export function createInboxTransaction(db) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');

  return Object.freeze({
    async ingest({ provider, providerMessageId, conversationId, sender, payload, replayKey, replayTtlSeconds = 300 }) {
      if (!provider || !providerMessageId || !conversationId || !sender) throw new Error('INBOX_FIELDS_REQUIRED');
      if (!replayKey) throw new Error('REPLAY_KEY_REQUIRED');
      const ttl = Number(replayTtlSeconds);
      if (!Number.isInteger(ttl) || ttl <= 0 || ttl > 86400) throw new Error('INVALID_REPLAY_TTL');
      const keyHash = hashReplayKey(replayKey);

      return db.transaction(async (tx) => {
        const replay = await tx.query(`
          INSERT INTO webhook_replay (key_hash, expires_at)
          VALUES ($1, now() + ($2 * interval '1 second'))
          ON CONFLICT (key_hash) DO UPDATE
            SET expires_at = EXCLUDED.expires_at
            WHERE webhook_replay.expires_at <= now()
          RETURNING key_hash
        `, [keyHash, ttl]);

        if (replay.rowCount !== 1) return Object.freeze({ accepted: false, replay: true, inboxId: null });

        const inbox = await tx.query(`
          INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (provider, provider_message_id) DO NOTHING
          RETURNING id, processing_status
        `, [provider, providerMessageId, conversationId, sender, payload ?? {}]);

        if (inbox.rowCount !== 1) return Object.freeze({ accepted: false, replay: true, inboxId: null });
        return Object.freeze({ accepted: true, replay: false, inboxId: inbox.rows[0].id });
      });
    }
  });
}
