import test from 'node:test';
import assert from 'node:assert/strict';
import { claimAndProcessInbound } from '../src/core/inbox-worker.js';

function fakeDb() {
  let inserted = true;
  const calls = [];
  return { calls, async transaction(fn) { return fn({ async query(sql) { calls.push(sql); if (sql.includes('INSERT INTO message_inbox')) return { rows: inserted ? [{ id:'I1', conversation_id:'C1', provider_message_id:'M1' }] : [] }; if (sql.includes('INSERT INTO message_outbox')) return { rows:[{ id:'O1', delivery_state:'PENDING' }] }; return { rows:[] }; } }); } };
}

test('inbound processing and outbox enqueue share one transaction', async () => {
  const db = fakeDb(); let runs = 0;
  const result = await claimAndProcessInbound(db, { provider:'whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'U1', payload:{ text:'hi' } }, async () => { runs++; return { text:'reply' }; });
  assert.equal(result.status, 'PROCESSED');
  assert.equal(runs, 1);
  assert.equal(db.calls.filter((x) => x.includes('INSERT INTO')).length, 2);
});

test('duplicate inbound is not processed', async () => {
  const db = fakeDb(); db.transaction = async (fn) => fn({ async query(sql) { if (sql.includes('INSERT INTO message_inbox')) return { rows:[] }; throw new Error('must not continue'); } });
  let runs = 0;
  const result = await claimAndProcessInbound(db, { provider:'whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'U1' }, async () => { runs++; return {}; });
  assert.equal(result.status, 'DUPLICATE');
  assert.equal(runs, 0);
});
