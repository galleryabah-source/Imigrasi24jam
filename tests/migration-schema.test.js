import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('complete migration schema gate', { skip: !url }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const tables = ['knowledge_sources','intents','documents','document_versions','knowledge_items','question_patterns','answer_versions','policies','approvals','document_validations','audit_events','regulatory_relationships','evidence_items','knowledge_evidence','message_inbox','message_outbox','conversations'];
    const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])`, [tables]);
    assert.equal(new Set(result.rows.map(r => r.table_name)).size, tables.length);

    const constraints = await client.query(`SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='public' AND table_name='message_inbox' AND constraint_type='UNIQUE'`);
    assert.ok(constraints.rows.length >= 1);

    const lease = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='message_outbox' AND column_name = ANY($1::text[])`, [['lease_owner','lease_expires_at']]);
    assert.deepEqual(new Set(lease.rows.map(r => r.column_name)), new Set(['lease_owner','lease_expires_at']));

    const inboxLease = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='message_inbox' AND column_name = ANY($1::text[])`, [['lease_owner','lease_expires_at','attempt_count']]);
    assert.deepEqual(new Set(inboxLease.rows.map(r => r.column_name)), new Set(['lease_owner','lease_expires_at','attempt_count']));

    const conversation = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name = ANY($1::text[])`, [['conversation_key','state','turn_count','version','updated_at']]);
    assert.deepEqual(new Set(conversation.rows.map(r => r.column_name)), new Set(['conversation_key','state','turn_count','version','updated_at']));
  } finally {
    await client.end();
  }
});
