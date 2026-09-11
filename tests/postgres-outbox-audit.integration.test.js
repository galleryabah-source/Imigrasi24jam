import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createPostgresAdapter } from '../src/db/postgres-adapter.js';
import { createOutboxLeaseRepository } from '../src/core/outbox-lease-repository.js';
import { createAuditEvent, AUDIT_EVENTS } from '../src/core/audit-contract.js';
import { verifyAuditChain } from '../src/core/audit-integrity.js';

const url = process.env.DATABASE_URL;
const adapter = url ? createPostgresAdapter({ connectionString: url }) : null;

function makeMarker() {
  return `OAI-${crypto.randomUUID()}`;
}

test('real postgres atomically commits ANSWER_SERVED audit with outbox SENT', { skip: !adapter }, async () => {
  const marker = makeMarker();
  const workerId = `audit-it-${crypto.randomUUID()}`;
  let inboxId;
  let outboxId;

  try {
    await adapter.transaction(async (tx) => {
      const inbox = await tx.query(`INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json, processing_status, lease_owner, lease_expires_at) VALUES ('integration-test',$1,$2,'test-user','{}','PROCESSING',$3,now()+interval '60 seconds') RETURNING id`, [marker, marker, workerId]);
      inboxId = inbox.rows[0].id;
      const outbox = await tx.query(`INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json, delivery_state, lease_owner, lease_expires_at) VALUES ($1,$2,'integration-test','{"text":"answer"}','PROCESSING',$3,now()+interval '60 seconds') RETURNING id`, [marker, inboxId, workerId]);
      outboxId = outbox.rows[0].id;
    });

    const repository = createOutboxLeaseRepository(adapter, { workerId, leaseSeconds: 60 });
    const auditEvent = createAuditEvent({
      eventType: AUDIT_EVENTS.ANSWER_SERVED,
      subjectType: 'MESSAGE_OUTBOX',
      subjectId: outboxId,
      after: { delivery_state: 'SENT', provider_message_id: 'provider-it-1', conversation_id: marker, reply_to_message_id: inboxId },
      reason: 'PostgreSQL atomic outbox/audit integration test'
    });

    await repository.markOutboundSent(outboxId, 'provider-it-1', auditEvent);

    const outbox = await adapter.query('SELECT delivery_state, provider_message_id, lease_owner, lease_expires_at FROM message_outbox WHERE id=$1', [outboxId]);
    assert.equal(outbox.rows[0].delivery_state, 'SENT');
    assert.equal(outbox.rows[0].provider_message_id, 'provider-it-1');
    assert.equal(outbox.rows[0].lease_owner, null);
    assert.equal(outbox.rows[0].lease_expires_at, null);

    const audit = await adapter.query('SELECT event_type, subject_type, subject_id, after_json FROM audit_events WHERE id=$1', [auditEvent.id]);
    assert.equal(audit.rowCount, 1);
    assert.equal(audit.rows[0].event_type, 'ANSWER_SERVED');
    assert.equal(audit.rows[0].subject_type, 'MESSAGE_OUTBOX');
    assert.equal(audit.rows[0].subject_id, outboxId);
    assert.deepEqual(audit.rows[0].after_json, auditEvent.after_json);

    const verified = await verifyAuditChain(adapter);
    assert.equal(verified.intact, true);
  } finally {
    if (outboxId) await adapter.query('DELETE FROM message_outbox WHERE id=$1', [outboxId]);
    if (inboxId) await adapter.query('DELETE FROM message_inbox WHERE id=$1', [inboxId]);
  }
});

test('real postgres rolls back ANSWER_SERVED audit when outbox lease ownership is lost', { skip: !adapter }, async () => {
  const marker = makeMarker();
  const workerId = `audit-it-${crypto.randomUUID()}`;
  const replacementWorker = `replacement-${crypto.randomUUID()}`;
  let inboxId;
  let outboxId;

  try {
    await adapter.transaction(async (tx) => {
      const inbox = await tx.query(`INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json, processing_status, lease_owner, lease_expires_at) VALUES ('integration-test',$1,$2,'test-user','{}','PROCESSING',$3,now()+interval '60 seconds') RETURNING id`, [marker, marker, workerId]);
      inboxId = inbox.rows[0].id;
      const outbox = await tx.query(`INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json, delivery_state, lease_owner, lease_expires_at) VALUES ($1,$2,'integration-test','{"text":"answer"}','PROCESSING',$3,now()+interval '60 seconds') RETURNING id`, [marker, inboxId, workerId]);
      outboxId = outbox.rows[0].id;
    });

    await adapter.query('UPDATE message_outbox SET lease_owner=$2 WHERE id=$1', [outboxId, replacementWorker]);
    const repository = createOutboxLeaseRepository(adapter, { workerId, leaseSeconds: 60 });
    const auditEvent = createAuditEvent({
      eventType: AUDIT_EVENTS.ANSWER_SERVED,
      subjectType: 'MESSAGE_OUTBOX',
      subjectId: outboxId,
      after: { delivery_state: 'SENT', provider_message_id: 'provider-it-lost', conversation_id: marker, reply_to_message_id: inboxId },
      reason: 'Lease-loss rollback integration test'
    });

    await assert.rejects(() => repository.markOutboundSent(outboxId, 'provider-it-lost', auditEvent), /OUTBOX_LEASE_LOST/);

    const audit = await adapter.query('SELECT count(*)::int AS count FROM audit_events WHERE id=$1', [auditEvent.id]);
    assert.equal(audit.rows[0].count, 0);
    const outbox = await adapter.query('SELECT delivery_state, provider_message_id, lease_owner FROM message_outbox WHERE id=$1', [outboxId]);
    assert.equal(outbox.rows[0].delivery_state, 'PROCESSING');
    assert.equal(outbox.rows[0].provider_message_id, null);
    assert.equal(outbox.rows[0].lease_owner, replacementWorker);
  } finally {
    if (outboxId) await adapter.query('DELETE FROM message_outbox WHERE id=$1', [outboxId]);
    if (inboxId) await adapter.query('DELETE FROM message_inbox WHERE id=$1', [inboxId]);
  }
});

after(async () => { if (adapter) await adapter.close(); });
