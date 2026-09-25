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
  const result = await claimAndProcessInbound(db, { provider:'whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'U1', payload:{ text:'hi' }, correlationId:'C1-M1' }, async () => { runs++; return { text:'reply' }; });
  assert.equal(result.status, 'PROCESSED');
  assert.equal(runs, 1);
  assert.equal(db.calls.filter((x) => x.includes('INSERT INTO')).length, 2);
});

test('duplicate inbound is not processed', async () => {
  const db = fakeDb(); db.transaction = async (fn) => fn({ async query(sql) { if (sql.includes('INSERT INTO message_inbox')) return { rows:[] }; throw new Error('must not continue'); } });
  let runs = 0; let duplicates = 0;
  const result = await claimAndProcessInbound(db, { provider:'whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'U1' }, Object.assign(async () => { runs++; return {}; }, { onDuplicate: async () => { duplicates++; } }));
  assert.equal(result.status, 'DUPLICATE');
  assert.equal(runs, 0);
  assert.equal(duplicates, 1);
});


test('outbox is anchored to the durable inbound conversation identity', async () => {
  const db = {
    calls: [],
    async transaction(fn) {
      return fn({
        async query(sql, params = []) {
          db.calls.push({ sql, params });
          if (sql.includes('INSERT INTO message_inbox')) return { rows: [{ id:'I2', conversation_id:'CANONICAL-C2', provider_message_id:'M2' }] };
          if (sql.includes('INSERT INTO message_outbox')) return { rows:[{ id:'O2', delivery_state:'PENDING' }] };
          return { rows:[] };
        }
      });
    }
  };
  await claimAndProcessInbound(
    db,
    { provider:'whatsapp', providerMessageId:'M2', conversationId:'UNTRUSTED-C2', sender:'U1', payload:{ text:'hi' } },
    async () => ({ text:'reply' })
  );
  const outboxCall = db.calls.find((x) => x.sql.includes('INSERT INTO message_outbox'));
  assert.equal(outboxCall.params[0], 'CANONICAL-C2');
});
