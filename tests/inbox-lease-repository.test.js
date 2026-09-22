import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxOutboxRepository } from '../src/core/inbox-outbox-repository.js';

test('claim inbox uses SKIP LOCKED and reclaims expired processing leases', async () => {
  let sql = '';
  let params = [];
  const db = {
    async query(q, p) {
      sql = q;
      params = p;
      return { rows: [{ id: 'I1', processing_status: 'PROCESSING', lease_owner: 'W1' }] };
    }
  };
  const repo = createInboxOutboxRepository(db);
  const row = await repo.claimPendingInbound({ workerId: 'W1', leaseSeconds: 60 });
  assert.equal(row.id, 'I1');
  assert.match(sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(sql, /lease_expires_at/);
  assert.equal(params[0], 'W1');
  assert.equal(params[1], 60);
});

test('inbox worker cannot finalize a message it does not own', async () => {
  const queries = [];
  const db = {
    async query(q, params) {
      queries.push({ q, params });
      return { rows: [], rowCount: 0 };
    }
  };
  const repo = createInboxOutboxRepository(db);
  await assert.rejects(() => repo.markInboundProcessed('I1', 'W2'), /INBOX_LEASE_LOST/);
  assert.match(queries[0].q, /lease_owner=\$2/);
  assert.equal(queries[0].params[1], 'W2');
});

test('inbox owner may finalize an actively leased message', async () => {
  const db = { async query() { return { rows: [{ id: 'I1' }], rowCount: 1 }; } };
  const repo = createInboxOutboxRepository(db);
  const result = await repo.markInboundProcessed('I1', 'W1');
  assert.equal(result.id, 'I1');
});

test('inbox repository requires worker identity for processing claims', async () => {
  const db = { async query() { throw new Error('must not query'); } };
  const repo = createInboxOutboxRepository(db);
  await assert.rejects(() => repo.claimPendingInbound(), /INBOX_WORKER_ID_REQUIRED/);
});
