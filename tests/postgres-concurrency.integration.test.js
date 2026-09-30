import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('real postgres concurrent workers claim different jobs', { skip: !url }, async () => {
  const setup = new Client({ connectionString: url });
  await setup.connect();
  try {
    await setup.query(`CREATE TEMP TABLE outbox_concurrency_it (id serial PRIMARY KEY, delivery_state text NOT NULL DEFAULT 'PENDING', lease_owner text, lease_expires_at timestamptz, attempt_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`);
    await setup.query(`INSERT INTO outbox_concurrency_it DEFAULT VALUES`);
    await setup.query(`INSERT INTO outbox_concurrency_it DEFAULT VALUES`);
  } finally { await setup.end(); }

  const a = new Client({ connectionString: url });
  const b = new Client({ connectionString: url });
  await Promise.all([a.connect(), b.connect()]);
  try {
    // Temporary tables are session-local, so use an independent shared table for the concurrency probe.
    await a.query(`CREATE TABLE IF NOT EXISTS imigrasi24_concurrency_probe (id bigserial PRIMARY KEY, delivery_state text NOT NULL DEFAULT 'PENDING', lease_owner text, lease_expires_at timestamptz, attempt_count integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`);
    await a.query(`TRUNCATE imigrasi24_concurrency_probe`);
    await a.query(`INSERT INTO imigrasi24_concurrency_probe DEFAULT VALUES`);
    await a.query(`INSERT INTO imigrasi24_concurrency_probe DEFAULT VALUES`);

    const claim = async (client, worker) => {
      await client.query('BEGIN');
      try {
        const result = await client.query(`WITH candidate AS (SELECT id FROM imigrasi24_concurrency_probe WHERE delivery_state='PENDING' ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE imigrasi24_concurrency_probe o SET delivery_state='PROCESSING', lease_owner=$1, lease_expires_at=now()+interval '60 seconds', attempt_count=o.attempt_count+1 FROM candidate c WHERE o.id=c.id RETURNING o.id, o.lease_owner`, [worker]);
        await client.query('COMMIT');
        return result.rows[0] ?? null;
      } catch (e) { await client.query('ROLLBACK'); throw e; }
    };
    const [r1, r2] = await Promise.all([claim(a, 'W1'), claim(b, 'W2')]);
    assert.ok(r1 && r2);
    assert.notEqual(r1.id, r2.id);
    assert.notEqual(r1.lease_owner, r2.lease_owner);
  } finally {
    await a.end(); await b.end();
  }
});
