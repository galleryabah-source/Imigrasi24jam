import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;

test('durable conversation schema preserves state and lifecycle identity', { skip: !url }, async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO conversations (conversation_id, user_id, state, scope, intent, turn_count)
      VALUES ('C-HARDEN-1','U1','ANSWERING','IMMIGRATION','SERVICE_REQUIREMENTS',1)
      ON CONFLICT (conversation_id) DO UPDATE SET state=EXCLUDED.state, intent=EXCLUDED.intent, turn_count=EXCLUDED.turn_count, updated_at=now()`);
    await client.query(`INSERT INTO conversation_events
      (conversation_id,event_type,from_state,to_state,payload_json,correlation_id)
      VALUES ('C-HARDEN-1','CONVERSATION_TRANSITIONED','RETRIEVAL','ANSWERING','{}'::jsonb,'wa:WA-HARDEN-1')`);
    await client.query('COMMIT');

    const row = await client.query(`SELECT conversation_id,state,intent,turn_count FROM conversations WHERE conversation_id='C-HARDEN-1'`);
    assert.deepEqual(row.rows[0], { conversation_id:'C-HARDEN-1', state:'ANSWERING', intent:'SERVICE_REQUIREMENTS', turn_count:1 });

    const event = await client.query(`SELECT correlation_id,to_state FROM conversation_events WHERE conversation_id='C-HARDEN-1' ORDER BY created_at DESC LIMIT 1`);
    assert.equal(event.rows[0].correlation_id, 'wa:WA-HARDEN-1');
    assert.equal(event.rows[0].to_state, 'ANSWERING');
  } finally {
    await client.query(`DELETE FROM conversation_events WHERE conversation_id='C-HARDEN-1'`);
    await client.query(`DELETE FROM conversations WHERE conversation_id='C-HARDEN-1'`);
    await client.end();
  }
});
