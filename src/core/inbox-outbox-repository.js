export function createInboxOutboxRepository(db) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');

  return Object.freeze({
    async insertIfNew({ provider, providerMessageId, conversationId, sender, payload }) {
      const result = await db.query(`
        INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json, processing_status)
        VALUES ($1,$2,$3,$4,$5,'PROCESSING')
        ON CONFLICT (provider, provider_message_id) DO NOTHING
        RETURNING id, processing_status
      `, [provider, providerMessageId, conversationId, sender, payload ?? {}]);
      return Object.freeze({ inserted: result.rows.length === 1, row: result.rows[0] ?? null });
    },

    async claimInbound(message) { return (await this.insertIfNew(message)).row; },

    async enqueueOutbound({ conversationId, replyToMessageId, provider, payload }) {
      const result = await db.query(`
        INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json)
        VALUES ($1,$2,$3,$4)
        RETURNING id, delivery_state
      `, [conversationId, replyToMessageId, provider, payload ?? {}]);
      return result.rows[0];
    },

    async markInboundProcessed(id) {
      const result = await db.query(`UPDATE message_inbox SET processing_status='PROCESSED', processed_at=now() WHERE id=$1 AND processing_status='PROCESSING' RETURNING id, processing_status`, [id]);
      return result.rows[0] ?? null;
    }
  });
}
