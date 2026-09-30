import test from 'node:test';
import assert from 'node:assert/strict';
import { insertAuditEvent } from '../src/db/audit-repository.js';

test('audit repository persists the canonical audit contract fields', async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows:[{ id:'A1', created_at:'2026-09-25T00:00:00.000Z' }] };
  }};
  const row = await insertAuditEvent(db, {
    actor_id:'U1',
    event_type:'DELIVERY_SENT',
    subject_type:'CONVERSATION',
    subject_id:'C1',
    before_json:{ delivery_state:'PROCESSING' },
    after_json:{ delivery_state:'SENT' },
    reason:null,
    correlation_id:'CORR-1',
    created_at:'2026-09-25T00:00:00.000Z'
  });
  assert.equal(row.id,'A1');
  assert.equal(calls.length,1);
  assert.match(calls[0].sql,/INSERT INTO audit_events/);
  assert.equal(calls[0].params[8],'2026-09-25T00:00:00.000Z');
});
