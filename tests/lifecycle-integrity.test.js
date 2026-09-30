import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLifecycleIntegrity, createLifecycleIdentity, reconcileProviderDelivery } from '../src/core/lifecycle-integrity.js';

const identity = createLifecycleIdentity({
  provider:'wa',
  providerMessageId:'WA-100',
  inboundId:'I-100',
  conversationId:'C-100',
  outboxId:'O-100',
  attempt:0,
  correlationId:'WA-100',
  outboundProviderMessageId:'WA-OUT-100'
});

test('unified lifecycle identity binds inbound, conversation, outbox and delivery', () => {
  assert.equal(identity.idempotency_key, 'wa:O-100:C-100:0');
  assert.equal(assertLifecycleIntegrity({
    identity,
    inbound:{ id:'I-100', provider:'wa', provider_message_id:'WA-100' },
    outbox:{ id:'O-100', conversation_id:'C-100', reply_to_message_id:'I-100' },
    delivery:{ conversation_id:'C-100', idempotency_key:'wa:O-100:C-100:0', delivery_state:'SENT' },
    auditEvents:[
      { event_type:'MESSAGE_RECEIVED', correlation_id:'WA-100' },
      { event_type:'OUTBOX_ENQUEUED', correlation_id:'WA-100' },
      { event_type:'DELIVERY_SENT', correlation_id:'WA-100' }
    ]
  }), true);
});

test('lifecycle rejects competing inbound or outbox identity', () => {
  assert.throws(() => assertLifecycleIntegrity({
    identity,
    inbound:{ id:'I-999', provider:'wa', provider_message_id:'WA-100' },
    outbox:{ id:'O-100', conversation_id:'C-100', reply_to_message_id:'I-100' },
    delivery:{ conversation_id:'C-100', idempotency_key:'wa:O-100:C-100:0', delivery_state:'SENT' }
  }), /LIFECYCLE_INBOUND_MISMATCH/);

  assert.throws(() => assertLifecycleIntegrity({
    identity,
    inbound:{ id:'I-100', provider:'wa', provider_message_id:'WA-100' },
    outbox:{ id:'O-100', conversation_id:'C-999', reply_to_message_id:'I-100' },
    delivery:{ conversation_id:'C-999', idempotency_key:'wa:O-100:C-100:0', delivery_state:'SENT' }
  }), /LIFECYCLE_OUTBOX_MISMATCH/);
});

test('provider reconciliation matches only deterministic lifecycle identity', () => {
  assert.deepEqual(reconcileProviderDelivery({ identity, providerMessageId:'WA-OUT-999', idempotencyKey:null, status:'DELIVERED' }), {
    matched:false, by:null, status:'DELIVERED'
  });
  assert.deepEqual(reconcileProviderDelivery({ identity, providerMessageId:'WA-OUT-100', idempotencyKey:null, status:'DELIVERED' }), {
    matched:true, by:'OUTBOUND_PROVIDER_MESSAGE_ID', status:'DELIVERED'
  });
});
