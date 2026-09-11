import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createPostgresAdapter } from '../src/db/postgres-adapter.js';
import { createAuditIntegrityRepository, appendAuditEventInTransaction, verifyAuditChain } from '../src/core/audit-integrity.js';

const url = process.env.DATABASE_URL;
const adapter = url ? createPostgresAdapter({ connectionString: url }) : null;

function makeEvent(subjectId, label) {
  return {
    actor_id: null,
    event_type: 'ANSWER_SERVED',
    subject_type: 'AUDIT_INTEGRITY_IT',
    subject_id: subjectId,
    before_json: null,
    after_json: { label },
    reason: 'Disposable PostgreSQL audit-integrity integration test'
  };
}

test('real postgres serializes concurrent audit appends into one valid chain', { skip: !adapter }, async () => {
  const repository = createAuditIntegrityRepository(adapter);
  const subjectIds = [crypto.randomUUID(), crypto.randomUUID()];
  const [first, second] = await Promise.all([
    repository.append(makeEvent(subjectIds[0], 'A')),
    repository.append(makeEvent(subjectIds[1], 'B'))
  ]);

  assert.ok(first.sequence_no);
  assert.ok(second.sequence_no);
  assert.notEqual(first.sequence_no, second.sequence_no);
  const ordered = [first, second].sort((a, b) => Number(a.sequence_no) - Number(b.sequence_no));
  assert.equal(ordered[0].previous_hash, '0'.repeat(64));
  assert.equal(ordered[1].previous_hash, ordered[0].event_hash);

  const verified = await verifyAuditChain(adapter);
  assert.equal(verified.intact, true);
});

test('real postgres rolls back audit append when surrounding transaction fails', { skip: !adapter }, async () => {
  const subjectId = crypto.randomUUID();
  await assert.rejects(() => adapter.transaction(async (tx) => {
    await appendAuditEventInTransaction(tx, makeEvent(subjectId, 'ROLLBACK'));
    throw new Error('EXPECTED_AUDIT_ROLLBACK');
  }), /EXPECTED_AUDIT_ROLLBACK/);

  const result = await adapter.query('SELECT count(*)::int AS count FROM audit_events WHERE subject_type=$1 AND subject_id=$2', ['AUDIT_INTEGRITY_IT', subjectId]);
  assert.equal(result.rows[0].count, 0);
});

after(async () => { if (adapter) await adapter.close(); });
