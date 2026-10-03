import test from 'node:test';
import assert from 'node:assert/strict';
import { claimAndProcessInbound } from '../src/core/inbox-worker.js';

function fakeDb({ duplicate = false } = {}) {
  const calls = [];
  return {
    calls,
    async transaction(fn) {
      calls.push('BEGIN');
      try {
        const result = await fn({
          async query(sql, params = []) {
            calls.push({ sql, params });
            if (sql.includes('INSERT INTO message_inbox')) {
              return duplicate ? { rows: [] } : {
                rows: [{
                  id:'00000000-0000-0000-0000-000000000001',
                  conversation_id:'C1',
                  provider_message_id:'M1',
                  provider:'whatsapp',
                  processing_status:'PROCESSING'
                }]
              };
            }
            if (sql.includes('INSERT INTO conversations')) {
              return { rows:[{ conversation_id:params[0], state:params[2], intent:params[4], turn_count:params[7] }] };
            }
            if (sql.includes('INSERT INTO conversation_events')) {
              return { rows:[{ id:'CE1' }] };
            }
            if (sql.includes('INSERT INTO message_outbox')) {
              return { rows:[{
                id:'00000000-0000-0000-0000-000000000002',
                conversation_id:'C1',
                reply_to_message_id:'00000000-0000-0000-0000-000000000001',
                delivery_state:'PENDING'
              }] };
            }
            if (sql.includes('INSERT INTO audit_events')) {
              return { rows:[{ id:'A1', created_at:'2026-09-28T00:00:00Z' }] };
            }
            if (sql.includes('UPDATE message_inbox')) {
              return { rows:[{ id:'00000000-0000-0000-0000-000000000001', processing_status:'PROCESSED' }] };
            }
            throw new Error('UNEXPECTED_SQL');
          }
        });
        calls.push('COMMIT');
        return result;
      } catch (error) {
        calls.push('ROLLBACK');
        throw error;
      }
    }
  };
}

test('legacy worker delegates to canonical lifecycle with one transaction and one persistence path', async () => {
  const db = fakeDb();
  let runs = 0;
  const result = await claimAndProcessInbound(
    db,
    { provider:'whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'U1', payload:{ text:'hi' }, correlationId:'C1-M1' },
    async () => { runs++; return { text:'reply' }; }
  );
  assert.equal(result.status, 'PROCESSED');
  assert.equal(result.identity.inbound_id, result.inbound_id);
  assert.equal(result.identity.conversation_id, 'C1');
  assert.equal(result.identity.outbox_id, result.outbox_id);
  assert.equal(runs, 1);
  assert.equal(db.calls.includes('COMMIT'), true);
  assert.equal(db.calls.filter((x) => typeof x === 'object' && x.sql.includes('INSERT INTO message_inbox')).length, 1);
  assert.equal(db.calls.filter((x) => typeof x === 'object' && x.sql.includes('INSERT INTO message_outbox')).length, 1);
});

test('duplicate inbound is not processed and never reaches outbox/audit', async () => {
  const db = fakeDb({ duplicate:true });
  let runs = 0;
  let duplicates = 0;
  const process = Object.assign(async () => { runs++; return { text:'reply' }; }, {
    onDuplicate: async () => { duplicates++; }
  });

  const result = await claimAndProcessInbound(
    db,
    { provider:'whatsapp', providerMessageId:'M1', conversationId:'C1', sender:'U1' },
    process
  );

  assert.equal(result.status, 'DUPLICATE');
  assert.equal(runs, 0);
  assert.equal(duplicates, 1);
  assert.equal(db.calls.some((x) => typeof x === 'object' && x.sql.includes('message_outbox')), false);
  assert.equal(db.calls.some((x) => typeof x === 'object' && x.sql.includes('audit_events')), false);
});

test('legacy worker cannot create a second raw inbox/outbox implementation', async () => {
  const db = fakeDb();
  await claimAndProcessInbound(
    db,
    { provider:'whatsapp', providerMessageId:'M2', conversationId:'C2', sender:'U1', payload:{ text:'hi' } },
    async () => ({ text:'reply' })
  );
  const workerSource = (await import('node:fs')).readFileSync(new URL('../src/core/inbox-worker.js', import.meta.url), 'utf8');
  assert.equal(workerSource.includes('INSERT INTO message_inbox'), false);
  assert.equal(workerSource.includes('INSERT INTO message_outbox'), false);
});
