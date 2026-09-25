import test from 'node:test';
import assert from 'node:assert/strict';
import { runTransactionalDeliveryReconciliation, createDeliveryReconciliationAudit } from '../src/core/transactional-delivery-reconciliation.js';

const identity = {
  conversation_id:'C1',
  correlation_id:'CORR-1',
  outbound_provider_message_id:'WA-OUT-1'
};

test('delivery reconciliation and audit execute in one transaction', async () => {
  const calls = [];
  const result = await runTransactionalDeliveryReconciliation(
    { transaction: async (fn) => fn({}) },
    {
      resolveIdentity: async () => { calls.push('resolve'); return identity; },
      reconcile: async (_tx, value) => { calls.push('reconcile'); assert.equal(value, identity); return { matched:true, normalized:{ provider_status:'DELIVERED', delivery_state:'SENT' } }; },
      writeAudit: async (_tx, data) => { calls.push('audit'); assert.equal(data.identity, identity); assert.equal(data.eventType, 'DELIVERY_SENT'); return [{ id:'A1' }]; }
    }
  );
  assert.equal(result.status, 'RECONCILED');
  assert.deepEqual(calls, ['resolve','reconcile','audit']);
});

test('unmatched delivery callback does not write audit', async () => {
  const calls = [];
  const result = await runTransactionalDeliveryReconciliation(
    { transaction: async (fn) => fn({}) },
    {
      resolveIdentity: async () => { calls.push('resolve'); return null; },
      reconcile: async () => { calls.push('reconcile'); return null; },
      writeAudit: async () => { calls.push('audit'); }
    }
  );
  assert.equal(result.status, 'UNMATCHED');
  assert.deepEqual(calls, ['resolve']);
});

test('delivery audit preserves the same lifecycle correlation identity', () => {
  const event = createDeliveryReconciliationAudit({
    identity,
    result:{ normalized:{ provider_status:'FAILED', delivery_state:'FAILED' } }
  });
  assert.equal(event.event_type, 'DELIVERY_FAILED');
  assert.equal(event.subject_id, 'C1');
  assert.equal(event.correlation_id, 'CORR-1');
  assert.equal(event.after_json.outbound_provider_message_id, 'WA-OUT-1');
});


test('delivery reconciliation rolls back state and audit together on audit failure', async () => {
  const events = [];
  const db = {
    transaction: async (fn) => {
      try {
        const result = await fn({});
        events.push('COMMIT');
        return result;
      } catch (error) {
        events.push('ROLLBACK');
        throw error;
      }
    }
  };
  await assert.rejects(
    () => runTransactionalDeliveryReconciliation(db, {
      resolveIdentity: async () => identity,
      reconcile: async () => ({ matched:true, normalized:{ provider_status:'DELIVERED', delivery_state:'SENT' } }),
      writeAudit: async () => { throw new Error('AUDIT_WRITE_FAILED'); }
    }),
    /AUDIT_WRITE_FAILED/
  );
  assert.deepEqual(events, ['ROLLBACK']);
});

test('reconciliation does not mutate when callback identity is unmatched', async () => {
  const calls = [];
  const result = await runTransactionalDeliveryReconciliation(
    { transaction: async (fn) => fn({}) },
    {
      resolveIdentity: async () => null,
      reconcile: async () => { calls.push('reconcile'); },
      writeAudit: async () => { calls.push('audit'); }
    }
  );
  assert.equal(result.status, 'UNMATCHED');
  assert.deepEqual(calls, []);
});
