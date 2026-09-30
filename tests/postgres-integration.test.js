import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createPostgresAdapter } from '../src/db/postgres-adapter.js';

const adapter = process.env.DATABASE_URL ? createPostgresAdapter({ connectionString: process.env.DATABASE_URL }) : null;

test('postgres adapter connects and can execute a query', { skip: !adapter }, async () => {
  const result = await adapter.query('SELECT 1 AS ok');
  assert.equal(result.rows[0].ok, 1);
});

test('transaction commits atomically', { skip: !adapter }, async () => {
  const table = 'imigrasi24jam_tx_test';
  await adapter.query(`CREATE TEMP TABLE ${table} (id integer PRIMARY KEY, value text)`);
  await adapter.transaction(async (tx) => {
    await tx.query(`INSERT INTO ${table} (id, value) VALUES ($1, $2)`, [1, 'committed']);
  });
  const result = await adapter.query(`SELECT value FROM ${table} WHERE id = 1`);
  assert.equal(result.rows[0].value, 'committed');
});

test('transaction rolls back on failure', { skip: !adapter }, async () => {
  const table = 'imigrasi24jam_rollback_test';
  await adapter.query(`CREATE TEMP TABLE ${table} (id integer PRIMARY KEY, value text)`);
  await assert.rejects(() => adapter.transaction(async (tx) => {
    await tx.query(`INSERT INTO ${table} (id, value) VALUES ($1, $2)`, [1, 'must-rollback']);
    throw new Error('EXPECTED_FAILURE');
  }), /EXPECTED_FAILURE/);
  const result = await adapter.query(`SELECT count(*)::int AS count FROM ${table}`);
  assert.equal(result.rows[0].count, 0);
});

after(async () => { if (adapter) await adapter.close(); });
