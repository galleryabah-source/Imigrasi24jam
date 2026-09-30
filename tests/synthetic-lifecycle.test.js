import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticMessageLifecycle } from '../src/core/synthetic-lifecycle.js';

function fakeTransaction(fn) {
  return fn({});
}

test('synthetic lifecycle proves one identity from inbound through audit', async () => {
  const result = await runSyntheticMessageLifecycle({ transaction:fakeTransaction });
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.calls, ['inbound','conversation','outbox','reconciliation','audit','integrity']);
  assert.equal(result.identity.correlation_id, 'SYNTH-WA-001');
  assert.equal(result.identity.idempotency_key, 'wa:O-001:C-001:0');
  assert.ok(result.auditEvents.every((event) => event.correlation_id === 'SYNTH-WA-001'));
});

test('synthetic lifecycle fails atomically before integrity completion', async () => {
  const commits = [];
  const transaction = async (fn) => {
    try {
      const result = await fn({});
      commits.push('COMMIT');
      return result;
    } catch (error) {
      commits.push('ROLLBACK');
      throw error;
    }
  };

  await assert.rejects(() => runSyntheticMessageLifecycle({ transaction, failAt:'audit' }), /SYNTHETIC_FAILURE_AUDIT/);
  assert.deepEqual(commits, ['ROLLBACK']);
});

test('synthetic lifecycle rejects an unmatched provider callback', async () => {
  const { createLifecycleIdentity } = await import('../src/core/lifecycle-integrity.js');
  const { reconcileDeliveryStatus } = await import('../src/core/delivery-reconciliation.js');
  const identity = createLifecycleIdentity({
    provider:'wa', providerMessageId:'WA-IN-001', inboundId:'I-001',
    conversationId:'C-001', outboxId:'O-001', attempt:0, correlationId:'SYNTH-WA-001'
  });
  const result = reconcileDeliveryStatus({ identity, providerMessageId:'WA-UNKNOWN', status:'DELIVERED' });
  assert.equal(result.matched, false);
});
