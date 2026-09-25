import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditEvent, AUDIT_EVENTS } from '../src/core/audit-contract.js';

test('audit event requires consequential identifiers', () => {
  assert.throws(() => createAuditEvent({ eventType: AUDIT_EVENTS.DOCUMENT_UPLOADED, subjectType: 'DOCUMENT' }), /INVALID_AUDIT_EVENT/);
});

test('audit event rejects unknown event types', () => {
  assert.throws(() => createAuditEvent({ eventType: 'UNKNOWN', subjectType: 'MESSAGE', subjectId: 'M1' }), /INVALID_AUDIT_EVENT_TYPE/);
});

test('audit event supports lifecycle correlation identity', () => {
  const event = createAuditEvent({ eventType: AUDIT_EVENTS.MESSAGE_RECEIVED, subjectType: 'MESSAGE', subjectId: 'M1', correlationId: 'C1' });
  assert.equal(event.correlation_id, 'C1');
});

test('audit event is immutable and preserves before/after values', () => {
  const event = createAuditEvent({
    actorId: 'U1', eventType: AUDIT_EVENTS.DOCUMENT_PUBLISHED, subjectType: 'DOCUMENT', subjectId: 'D1',
    before: { status: 'APPROVED' }, after: { status: 'PUBLISHED' }, reason: 'Approved by reviewer'
  });
  assert.equal(event.actor_id, 'U1');
  assert.equal(event.before_json.status, 'APPROVED');
  assert.equal(event.after_json.status, 'PUBLISHED');
  assert.equal(Object.isFrozen(event), true);
});
