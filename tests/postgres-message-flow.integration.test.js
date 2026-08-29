import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('postgres inbox idempotency and outbox lease integration', { skip: !url }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('CREATE TEMP TABLE inbox_it (id serial PRIMARY KEY, provider text NOT NULL, provider_message_id text NOT NULL, UNIQUE(provider, provider_message_id))');
    await client.query('CREATE TEMP TABLE outbox_it (id serial PRIMARY KEY, delivery_state text NOT NULL DEFAULT \'PENDING\', lease_owner text, lease_expires_at timestamptz, attempt_count integer NOT NULL DEFAULT 0)');

    const first = await client.query(`INSERT INTO inbox_it(provider,provider_message_id) VALUES ('wa','M1') ON CONFLICT (provider,provider_message_id) DO NOTHING RETURNING id`);
    const duplicate = await client.query(`INSERT INTO inbox_it(provider,provider_message_id) VALUES ('wa','M1') ON CONFLICT (provider,provider_message_id) DO NOTHING RETURNING id`);
    assert.equal(first.rowCount, 1);
    assert.equal(duplicate.rowCount, 0);

    await client.query(`INSERT INTO outbox_it DEFAULT VALUES`);
    await client.query('BEGIN');
    const claim = await client.query(`WITH candidate AS (SELECT id FROM outbox_it WHERE delivery_state='PENDING' FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE outbox_it o SET delivery_state='PROCESSING', lease_owner=$1, lease_expires_at=now()+interval '60 seconds', attempt_count=o.attempt_count+1 FROM candidate c WHERE o.id=c.id RETURNING o.id`, ['W1']);
    await client.query('COMMIT');
    assert.equal(claim.rowCount, 1);

    const wrongOwner = await client.query(`UPDATE outbox_it SET delivery_state='SENT' WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$2`, [claim.rows[0].id, 'W2']);
    assert.equal(wrongOwner.rowCount, 0);
  } finally {
    await client.end();
  }
});

after(() => {});
