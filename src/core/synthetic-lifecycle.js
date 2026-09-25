import { createLifecycleIdentity, assertLifecycleIntegrity } from './lifecycle-integrity.js';
import { reconcileDeliveryStatus } from './delivery-reconciliation.js';

export async function runSyntheticMessageLifecycle({ transaction, providerStatus = 'DELIVERED', failAt = null } = {}) {
  if (typeof transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');

  return transaction(async (tx) => {
    const calls = [];
    const correlationId = 'SYNTH-WA-001';
    const provider = 'wa';
    const providerMessageId = 'WA-IN-001';
    const inbound = { id:'I-001', provider, provider_message_id:providerMessageId, conversation_id:'C-001' };
    calls.push('inbound');
    if (failAt === 'inbound') throw new Error('SYNTHETIC_FAILURE_INBOUND');

    const conversation = { id:'C-001', correlation_id:correlationId };
    calls.push('conversation');
    if (failAt === 'conversation') throw new Error('SYNTHETIC_FAILURE_CONVERSATION');

    const outbox = { id:'O-001', conversation_id:'C-001', reply_to_message_id:'I-001' };
    calls.push('outbox');
    if (failAt === 'outbox') throw new Error('SYNTHETIC_FAILURE_OUTBOX');

    const identity = createLifecycleIdentity({
      provider,
      providerMessageId,
      inboundId:inbound.id,
      conversationId:conversation.id,
      outboxId:outbox.id,
      attempt:0,
      correlationId
    });

    const delivery = {
      conversation_id:'C-001',
      idempotency_key:identity.idempotency_key,
      delivery_state:'SENT'
    };

    const reconciliation = reconcileDeliveryStatus({
      identity,
      providerMessageId:'WA-OUT-001',
      idempotencyKey:identity.idempotency_key,
      status:providerStatus
    });
    calls.push('reconciliation');
    if (!reconciliation.matched) throw new Error('SYNTHETIC_RECONCILIATION_UNMATCHED');

    const auditEvents = [
      { event_type:'MESSAGE_RECEIVED', correlation_id:correlationId },
      { event_type:'CONVERSATION_TRANSITIONED', correlation_id:correlationId },
      { event_type:'OUTBOX_ENQUEUED', correlation_id:correlationId },
      { event_type:'DELIVERY_SENT', correlation_id:correlationId }
    ];
    calls.push('audit');
    if (failAt === 'audit') throw new Error('SYNTHETIC_FAILURE_AUDIT');

    assertLifecycleIntegrity({ identity, inbound, outbox, delivery, auditEvents });
    calls.push('integrity');

    return Object.freeze({ status:'PASS', calls, identity, reconciliation, auditEvents });
  });
}
