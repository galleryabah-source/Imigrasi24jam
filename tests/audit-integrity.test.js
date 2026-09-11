import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAuditMaterial, hashAuditMaterial, createAuditIntegrityRepository, verifyAuditChain } from '../src/core/audit-integrity.js';

const event = Object.freeze({
  actor_id: null,
  event_type: 'ANSWER_SERVED',
  subject_type: 'MESSAGE_OUTBOX',
  subject_id: '00000000-0000-0000-0000-000000000001',
  before_json: null,
  after_json: { delivery_state: 'SENT', provider_message_id: 'P1' },
  reason: 'Provider accepted outbound answer',
  created_at: '2026-09-11T00:00:00.000Z'
});

test('canonical audit material is key-order independent and Date-safe', () => {
  const a = canonicalAuditMaterial(event, 1, '0'.repeat(64));
  const b = canonicalAuditMaterial({ ...event, after_json: { provider_message_id: 'P1', delivery_state: 'SENT' }, created_at: new Date(event.created_at) }, 1, '0'.repeat(64));
  assert.equal(a, b);
  assert.match(hashAuditMaterial(a), /^[0-9a-f]{64}$/);
});

test('audit append serializes sequence and previous hash inside a transaction', async () => {
  const queries = [];
  const tx = { async query(sql, params) {
    queries.push({ sql, params });
    if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
    if (sql.includes('ORDER BY sequence_no DESC')) return { rows: [] };
    if (sql.includes('INSERT INTO audit_events')) return { rowCount: 1, rows: [{ id: 'a1', sequence_no: 1, previous_hash: '0'.repeat(64), event_hash: 'h1' }] };
    throw new Error('UNEXPECTED_QUERY');
  } };
  const db = { async query() {}, async transaction(callback) { return callback(tx); } };
  const repo = createAuditIntegrityRepository(db);
  const result = await repo.append(event);
  assert.equal(result.sequence_no, 1);
  assert.equal(queries.length, 3);
  assert.equal(queries[0].params[0], 84172431);
});

test('audit verifier detects tampering', async () => {
  const db = { async query() { return { rows: [{ ...event, id: 'a1', sequence_no: 1, previous_hash: '0'.repeat(64), event_hash: 'bad' }] }; } };
  const result = await verifyAuditChain(db);
  assert.equal(result.intact, false);
  assert.equal(result.reason, 'EVENT_HASH_MISMATCH');
});

test('audit verifier detects sequence gaps', async () => {
  const db = { async query() { return { rows: [{ ...event, id: 'a3', sequence_no: 3, previous_hash: '0'.repeat(64), event_hash: 'bad' }] }; } };
  const result = await verifyAuditChain(db);
  assert.equal(result.intact, false);
  assert.equal(result.reason, 'SEQUENCE_GAP');
});
