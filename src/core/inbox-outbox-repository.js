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

    async upsertConversationState(conversation, { correlationId = null, eventType = 'CONVERSATION_TRANSITIONED' } = {}) {
      if (!conversation?.conversation_id || !conversation?.state) throw new Error('CONVERSATION_STATE_REQUIRED');
      const result = await db.query(`
        INSERT INTO conversations
          (conversation_id, user_id, state, scope, intent, sub_intent, pending_question, turn_count, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
        ON CONFLICT (conversation_id) DO UPDATE SET
          user_id=EXCLUDED.user_id,
          state=EXCLUDED.state,
          scope=EXCLUDED.scope,
          intent=EXCLUDED.intent,
          sub_intent=EXCLUDED.sub_intent,
          pending_question=EXCLUDED.pending_question,
          turn_count=EXCLUDED.turn_count,
          updated_at=now()
        RETURNING conversation_id, state, scope, intent, sub_intent, pending_question, turn_count
      `, [
        conversation.conversation_id,
        conversation.user_id ?? null,
        conversation.state,
        conversation.scope ?? null,
        conversation.intent ?? null,
        conversation.sub_intent ?? null,
        conversation.pending_question ?? null,
        Number(conversation.turn_count ?? 0)
      ]);
      if (correlationId) {
        await db.query(`
          INSERT INTO conversation_events
            (conversation_id, event_type, from_state, to_state, payload_json, correlation_id)
          VALUES ($1,$2,$3,$4,$5::jsonb,$6)
        `, [
          conversation.conversation_id,
          eventType,
          conversation.previous_state ?? null,
          conversation.state,
          JSON.stringify({ intent: conversation.intent ?? null, scope: conversation.scope ?? null }),
          correlationId
        ]);
      }
      return result.rows[0] ?? null;
    },

    async enqueueOutbound({ conversationId, replyToMessageId, provider, payload }) {
      const result = await db.query(`
        INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json)
        VALUES ($1,$2,$3,$4)
        RETURNING id, conversation_id, reply_to_message_id, provider, payload_json, delivery_state, attempt_count
      `, [conversationId, replyToMessageId, provider, payload ?? {}]);
      return result.rows[0];
    },

    async markInboundProcessed(id) {
      const result = await db.query(`UPDATE message_inbox SET processing_status='PROCESSED', processed_at=now() WHERE id=$1 AND processing_status='PROCESSING' RETURNING id, processing_status`, [id]);
      return result.rows[0] ?? null;
    }
  });
}
