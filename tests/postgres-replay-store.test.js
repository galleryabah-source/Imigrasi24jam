import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresReplayStore } from '../src/db/postgres-replay-store.js';

test('replay admission uses atomic unique-key upsert', async () => {
  const calls = [];
  const db = { async query(sql, params) { calls.push({ sql, params }); return { rowCount: 1, rows: [{ key_hash: 'x' }] }; } };
  const store = createPostgresReplayStore(db);
  assert.equal(await store.acceptIfAbsent('same-event', 300), true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /ON CONFLICT \(key_hash\) DO UPDATE/);
  assert.match(calls[0].sql, /WHERE webhook_replay\.expires_at <= now\(\)/);
  assert.notEqual(calls[0].params[0], 'same-event');
});

test('invalid replay TTL is rejected', async () => {
  const store = createPostgresReplayStore({ query: async () => ({ rowCount: 0 }) });
  await assert.rejects(() => store.acceptIfAbsent('x', 0), /INVALID_REPLAY_TTL/);
});
