import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createPostgresReplayStore } from '../src/db/postgres-replay-store.js';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('real PostgreSQL replay admission has exactly one winner', { skip: !url }, async () => {
  const setup = new Client({ connectionString: url });
  await setup.connect();
  try {
    await setup.query('CREATE TEMP TABLE IF NOT EXISTS webhook_replay (key_hash text PRIMARY KEY, expires_at timestamptz NOT NULL)');
  } finally { await setup.end(); }

  const clients = await Promise.all(Array.from({ length: 10 }, async () => {
    const client = new Client({ connectionString: url });
    await client.connect();
    return client;
  }));
  try {
    const stores = clients.map((client) => createPostgresReplayStore(client));
    const results = await Promise.all(stores.map((store) => store.acceptIfAbsent('concurrent-integration-key', 300)));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(results.filter((v) => !v).length, 9);
  } finally {
    await Promise.all(clients.map((client) => client.end()));
  }
});
