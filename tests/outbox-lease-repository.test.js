import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutboxLeaseRepository } from '../src/core/outbox-lease-repository.js';

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
