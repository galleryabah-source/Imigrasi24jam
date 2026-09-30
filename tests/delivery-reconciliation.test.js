import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProviderDeliveryStatus, reconcileDeliveryStatus } from '../src/core/delivery-reconciliation.js';

const identity = {
  provider:'wa',
  provider_message_id:'P-100',
  outbound_provider_message_id:'P-100',
  conversation_id:'C-100',
  outbox_id:'O-100',
  inbound_id:'I-100',
  attempt:0,
  idempotency_key:'wa:O-100:C-100:0',
  correlation_id:'wa:P-100'
};

test('provider delivery statuses normalize into canonical delivery states', () => {
  assert.deepEqual(normalizeProviderDeliveryStatus('delivered'), { provider_status:'DELIVERED', delivery_state:'SENT' });
  assert.deepEqual(normalizeProviderDeliveryStatus('failed'), { provider_status:'FAILED', delivery_state:'FAILED' });
  assert.throws(() => normalizeProviderDeliveryStatus('unknown'), /UNKNOWN_PROVIDER_DELIVERY_STATUS/);
});

test('reconciliation requires matching lifecycle identity', () => {
  assert.equal(reconcileDeliveryStatus({ identity, providerMessageId:'P-100', status:'DELIVERED' }).matched, true);
  assert.equal(reconcileDeliveryStatus({ identity, idempotencyKey:'wa:O-100:C-100:0', status:'DELIVERED' }).matched, true);
  assert.equal(reconcileDeliveryStatus({ identity, providerMessageId:'P-999', status:'DELIVERED' }).matched, false);
});
