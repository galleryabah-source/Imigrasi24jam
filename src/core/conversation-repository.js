function normalizeConversation(row) {
  if (!row?.id || !row.conversation_key) throw new Error('CONVERSATION_ROW_INVALID');
  return Object.freeze({
    id: row.id,
    conversation_id: row.conversation_key,
    user_id: row.user_id ?? null,
    state: row.state,
    scope: row.scope ?? null,
    intent: row.intent ?? null,
    sub_intent: row.sub_intent ?? null,
    pending_question: row.pending_question ?? null,
    turn_count: Number(row.turn_count ?? 0),
    version: Number(row.version ?? 0)
  });
}

export function createConversationRepository(db) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');

  return Object.freeze({
    async getOrCreate({ conversationId, userId = null } = {}) {
      if (!conversationId || typeof conversationId !== 'string') throw new Error('CONVERSATION_ID_REQUIRED');
      const result = await db.query(`
        INSERT INTO conversations (conversation_key, user_id)
        VALUES ($1,$2)
        ON CONFLICT (conversation_key) DO UPDATE SET updated_at=conversations.updated_at
        RETURNING *
      `, [conversationId, userId]);
      return normalizeConversation(result.rows[0]);
    },

    async save({ conversation, expectedVersion } = {}) {
      if (!conversation?.conversation_id) throw new Error('CONVERSATION_ID_REQUIRED');
      if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new Error('CONVERSATION_VERSION_REQUIRED');
      const result = await db.query(`
        UPDATE conversations
        SET user_id=$1, state=$2, scope=$3, intent=$4, sub_intent=$5,
            pending_question=$6, turn_count=$7, version=version+1, updated_at=now()
        WHERE conversation_key=$8 AND version=$9
        RETURNING *
      `, [conversation.user_id ?? null, conversation.state, conversation.scope ?? null, conversation.intent ?? null,
          conversation.sub_intent ?? null, conversation.pending_question ?? null, conversation.turn_count ?? 0,
          conversation.conversation_id, expectedVersion]);
      if (result.rowCount !== 1) throw new Error('CONVERSATION_VERSION_CONFLICT');
      return normalizeConversation(result.rows[0]);
    }
  });
}
