import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('message_outbox supports real concurrent claim, ownership, and lease recovery', { skip: !url }, async () => {
  const seed = new Client({ connectionString: url });
  await seed.connect();
  const marker = `IT-${crypto.randomUUID()}`;
  let ids = [];
  try {
    const inserted = await seed.query(`INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json) VALUES ('integration-test',$1,$2,'test-user','{}') RETURNING id`, [marker, marker]);
    const inboxId = inserted.rows[0].id;
    const out = await seed.query(`INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json) VALUES ($1,$2,'integration-test','{"text":"test"}') RETURNING id`, [marker, inboxId]);
    ids = [out.rows[0].id];
  } finally { await seed.end(); }

  const a = new Client({ connectionString: url });
  const b = new Client({ connectionString: url });
  await Promise.all([a.connect(), b.connect()]);
  try {
    const claim = async (client, worker) => {
      await client.query('BEGIN');
      try {
        const r = await client.query(`WITH candidate AS (SELECT id FROM message_outbox WHERE id=$2 AND ((delivery_state IN ('PENDING','RETRY') AND (next_attempt_at IS NULL OR next_attempt_at <= now())) OR (delivery_state='PROCESSING' AND lease_expires_at <= now())) FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE message_outbox o SET delivery_state='PROCESSING', lease_owner=$1, lease_expires_at=now()+interval '1 second', attempt_count=o.attempt_count+1 FROM candidate c WHERE o.id=c.id RETURNING o.id, o.lease_owner`, [worker, ids[0]]);
        await client.query('COMMIT');
        return r.rows[0] ?? null;
      } catch (e) { await client.query('ROLLBACK'); throw e; }
    };

    const [r1, r2] = await Promise.all([claim(a, 'W1'), claim(b, 'W2')]);
    assert.ok(r1 || r2);
    if (r1 && r2) assert.notEqual(r1.id, r2.id);
    const owner = r1?.lease_owner ?? r2?.lease_owner;
    assert.ok(owner);

    const wrong = await b.query(`UPDATE message_outbox SET delivery_state='SENT' WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$2`, [ids[0], owner === 'W1' ? 'W2' : 'W1']);
    assert.equal(wrong.rowCount, 0);

    await new Promise(r => setTimeout(r, 1100));
    const reclaimClient = owner === 'W1' ? b : a;
    const newOwner = owner === 'W1' ? 'W2' : 'W1';
    const reclaimed = await claim(reclaimClient, newOwner);
    assert.equal(reclaimed?.id, ids[0]);
    assert.equal(reclaimed?.lease_owner, newOwner);
    assert.notEqual(reclaimed.lease_owner, owner);

    const staleOwnerTransition = await seedUnavailableTransition(url, ids[0], owner);
    assert.equal(staleOwnerTransition, 0);
  } finally {
    await a.end(); await b.end();
    const cleanup = new Client({ connectionString: url });
    await cleanup.connect();
    try { await cleanup.query(`DELETE FROM message_outbox WHERE id = ANY($1::uuid[])`, [ids]); await cleanup.query(`DELETE FROM message_inbox WHERE provider='integration-test' AND provider_message_id=$1`, [marker]); } finally { await cleanup.end(); }
  }
});


async function seedUnavailableTransition(connectionString, id, staleOwner) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      `UPDATE message_outbox
       SET delivery_state='SENT', sent_at=now()
       WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$2`,
      [id, staleOwner]
    );
    return result.rowCount;
  } finally {
    await client.end();
  }
}
