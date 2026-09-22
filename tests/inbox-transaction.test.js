import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxTransaction } from '../src/core/inbox-transaction.js';

function fakeDb() {
  const calls = [];
  const db = {
    async transaction(callback) {
      const tx = { async query(sql, params) { calls.push({ sql, params });
        if (sql.includes('webhook_replay')) return { rowCount: 1, rows: [{ key_hash: 'h' }] };
        return { rowCount: 1, rows: [{ id: 'inbox-1', processing_status: 'RECEIVED' }] };
      } };
      return callback(tx);
    }
  };
  return { db, calls };
}

test('inbox ingest uses one transaction and writes replay before inbox', async () => {
  const { db, calls } = fakeDb();
  const store = createInboxTransaction(db);
  const result = await store.ingest({ provider: 'whatsapp', providerMessageId: 'wamid-1', conversationId: 'c1', sender: 's1', payload: { text: 'hello' }, replayKey: 'event-1234567890123456' });
  assert.deepEqual(result, { accepted: true, replay: false, inboxId: 'inbox-1' });
  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /INSERT INTO webhook_replay/);
  assert.match(calls[1].sql, /INSERT INTO message_inbox/);
});

test('duplicate replay never reaches inbox insert', async () => {
  const calls = [];
  const db = { async transaction(callback) { const tx = { async query(sql) { calls.push(sql); if (sql.includes('webhook_replay')) return { rowCount: 0, rows: [] }; throw new Error('INBOX_WRITE_SHOULD_NOT_RUN'); } }; return callback(tx); } };
  const store = createInboxTransaction(db);
  const result = await store.ingest({ provider: 'whatsapp', providerMessageId: 'wamid-2', conversationId: 'c1', sender: 's1', payload: {}, replayKey: 'event-duplicate-123456' });
  assert.deepEqual(result, { accepted: false, replay: true, inboxId: null });
  assert.equal(calls.length, 1);
});
