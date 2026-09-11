import test from 'node:test';
import assert from 'node:assert/strict';
import { createConversationRepository } from '../src/core/conversation-repository.js';

test('conversation repository creates and normalizes durable state', async () => {
  const calls = [];
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 'c1', conversation_key: 'wa:628123', user_id: 'u1', state: 'NEW',
          scope: null, intent: null, sub_intent: null, pending_question: null,
          turn_count: 0, version: 0
        }]
      };
    }
  };
  const repository = createConversationRepository(db);
  const conversation = await repository.getOrCreate({ conversationId: 'wa:628123', userId: 'u1' });

  assert.equal(conversation.conversation_id, 'wa:628123');
  assert.equal(conversation.user_id, 'u1');
  assert.equal(conversation.version, 0);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /ON CONFLICT \(conversation_key\)/);
});

test('conversation repository rejects stale optimistic version', async () => {
  const db = {
    async query() { return { rowCount: 0, rows: [] }; }
  };
  const repository = createConversationRepository(db);

  await assert.rejects(
    repository.save({
      conversation: { conversation_id: 'wa:628123', user_id: 'u1', state: 'RETRIEVAL', turn_count: 1 },
      expectedVersion: 0
    }),
    /CONVERSATION_VERSION_CONFLICT/
  );
});

test('conversation repository increments version only on successful save', async () => {
  const db = {
    async query(sql) {
      assert.match(sql, /version=version\+1/);
      return {
        rowCount: 1,
        rows: [{
          id: 'c1', conversation_key: 'wa:628123', user_id: 'u1', state: 'RETRIEVAL',
          scope: 'IMMIGRATION', intent: 'PASSPORT_REQUIREMENTS', sub_intent: null,
          pending_question: null, turn_count: 1, version: 1
        }]
      };
    }
  };
  const repository = createConversationRepository(db);
  const saved = await repository.save({
    conversation: { conversation_id: 'wa:628123', user_id: 'u1', state: 'RETRIEVAL', scope: 'IMMIGRATION', intent: 'PASSPORT_REQUIREMENTS', turn_count: 1 },
    expectedVersion: 0
  });

  assert.equal(saved.version, 1);
  assert.equal(saved.turn_count, 1);
});
