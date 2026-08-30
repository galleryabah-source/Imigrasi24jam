import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createPostgresReplayStore } from '../src/db/postgres-replay-store.js';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('PostgreSQL replay store admits one concurrent delivery', { skip: !url }, async () => {
  const clients = Array.from({ length: 10 }, () => new Client({ connectionString: url }));
  await Promise.all(clients.map((c) => c.connect()));
  try {
    await clients[0].query('CREATE TABLE IF NOT EXISTS webhook_replay (key_hash text PRIMARY KEY, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');
    await clients[0].query('TRUNCATE webhook_replay');
    const results = await Promise.all(clients.map((client) => createPostgresReplayStore(client).acceptIfAbsent('concurrent-message-0123456789', 300)));
    assert.equal(results.filter(Boolean).length, 1);
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
});

test('expired PostgreSQL replay key can be admitted again', { skip: !url }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const store = createPostgresReplayStore(client);
    await client.query('TRUNCATE webhook_replay');
    assert.equal(await store.acceptIfAbsent('expired-message-0123456789', 1), true);
    await client.query(`UPDATE webhook_replay SET expires_at = now() - interval '1 second' WHERE key_hash = encode(digest($1, 'sha256'), 'hex')`, ['expired-message-0123456789']);
    assert.equal(await store.acceptIfAbsent('expired-message-0123456789', 300), true);
  } finally { await client.end(); }
});
