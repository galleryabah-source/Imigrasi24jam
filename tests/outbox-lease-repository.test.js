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
  const db = { async query(q, params) { queries.push({ q, params }); return { rows: [] }; } };
  const repo = createOutboxLeaseRepository(db, { workerId:'W2' });
  await repo.markOutboundSent('O1', 'P1', 'wa:O1:C1:0');
  assert.match(queries[0].q, /lease_owner=\$4/);
  assert.equal(queries[0].params[2], 'wa:O1:C1:0');
  assert.equal(queries[0].params[3], 'W2');
});
