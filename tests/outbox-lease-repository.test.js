import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutboxLeaseRepository } from '../src/core/outbox-lease-repository.js';

const auditEvent = {
  event_type: 'ANSWER_SERVED',
  subject_type: 'MESSAGE_OUTBOX',
  subject_id: '00000000-0000-0000-0000-000000000001',
  before_json: null,
  after_json: { delivery_state: 'SENT', provider_message_id: 'P1' },
  reason: 'Provider accepted outbound answer',
  created_at: '2026-09-11T00:00:00.000Z'
};

test('claim query uses SKIP LOCKED and worker lease', async () => {
  let sql = '';
  const db = { async query(q) { sql = q; return { rows: [{ id:'O1', delivery_state:'PROCESSING', lease_owner:'W1' }] }; } };
  const repo = createOutboxLeaseRepository(db, { workerId:'W1', leaseSeconds:60 });
  const job = await repo.claimPendingOutbound();
  assert.equal(job.id, 'O1');
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /lease_expires_at/);
});

test('worker cannot finalize a job it does not own', async () => {
  const queries = [];
  const db = { async query(q, params) { queries.push({ q, params }); return { rows: [], rowCount: 0 }; } };
  const repo = createOutboxLeaseRepository(db, { workerId:'W2' });
  await assert.rejects(() => repo.markOutboundSent('O1', 'P1'), /OUTBOX_LEASE_LOST/);
  assert.match(queries[0].q, /lease_owner=\$3/);
  assert.equal(queries[0].params[2], 'W2');
});

test('owner may finalize an actively leased job', async () => {
  const db = { async query() { return { rows: [{ id: 'O1' }], rowCount: 1 }; } };
  const repo = createOutboxLeaseRepository(db, { workerId:'W1' });
  const result = await repo.markOutboundSent('O1', 'P1');
  assert.equal(result.id, 'O1');
});

test('successful outbound ACK persists audit and SENT state in one transaction', async () => {
  const queries = [];
  const tx = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO audit_events')) return { rowCount: 1, rows: [{ id: 'audit-1' }] };
      if (sql.includes('UPDATE message_outbox')) return { rowCount: 1, rows: [{ id: auditEvent.subject_id }] };
      throw new Error('UNEXPECTED_QUERY');
    }
  };
  const db = {
    async query() { throw new Error('NON_TRANSACTIONAL_PATH_NOT_ALLOWED'); },
    async transaction(callback) { return callback(tx); }
  };
  const repository = createOutboxLeaseRepository(db, { workerId: 'worker-1' });
  const result = await repository.markOutboundSent(auditEvent.subject_id, 'P1', auditEvent);

  assert.deepEqual(result, { id: auditEvent.subject_id });
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /INSERT INTO audit_events/);
  assert.match(queries[1].sql, /UPDATE message_outbox SET delivery_state='SENT'/);
  assert.equal(queries[0].params[1], 'ANSWER_SERVED');
  assert.equal(queries[0].params[3], auditEvent.subject_id);
  assert.equal(queries[1].params[1], 'P1');
});

test('audit persistence failure prevents outbound state transition', async () => {
  let updateCalled = false;
  const tx = {
    async query(sql) {
      if (sql.includes('INSERT INTO audit_events')) throw new Error('AUDIT_DB_UNAVAILABLE');
      updateCalled = true;
      return { rowCount: 1, rows: [{ id: 'unexpected' }] };
    }
  };
  const db = {
    async query() { throw new Error('NON_TRANSACTIONAL_PATH_NOT_ALLOWED'); },
    async transaction(callback) { return callback(tx); }
  };
  const repository = createOutboxLeaseRepository(db, { workerId: 'worker-2' });
  await assert.rejects(() => repository.markOutboundSent(auditEvent.subject_id, 'P1', auditEvent), /AUDIT_DB_UNAVAILABLE/);
  assert.equal(updateCalled, false);
});
