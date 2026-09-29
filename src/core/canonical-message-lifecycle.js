import { createInboxOutboxRepository } from './inbox-outbox-repository.js';
import { createAuditEvent, AUDIT_EVENTS } from './audit-contract.js';
import { insertAuditEvent } from '../db/audit-repository.js';
import { createLifecycleIdentity, createCanonicalCorrelationId } from './lifecycle-integrity.js';

function lifecycleAuditEvents({ inbound, conversation, outbound, correlationId, actorId = null }) {
  const subjectId = inbound.id;

  const events = [
    createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.MESSAGE_RECEIVED,
      subjectType: 'CONVERSATION',
      subjectId,
      correlationId,
      after: {
        inbound_id: inbound.id,
        conversation_id: inbound.conversation_id,
        provider: inbound.provider,
        provider_message_id: inbound.provider_message_id
      }
    }),
    createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.CONVERSATION_TRANSITIONED,
      subjectType: 'CONVERSATION',
      subjectId,
      correlationId,
      after: {
        inbound_id: inbound.id,
        conversation_id: conversation.conversation_id,
        state: conversation.state,
        intent: conversation.intent ?? null
      }
    }),
    createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.OUTBOX_ENQUEUED,
      subjectType: 'CONVERSATION',
      subjectId,
      correlationId,
      after: {
        inbound_id: inbound.id,
        conversation_id: outbound.conversation_id,
        outbox_id: outbound.id,
        reply_to_message_id: outbound.reply_to_message_id
      }
    })
  ];

  if (conversation.status === 'ANSWER' || conversation.state === 'ANSWERING') {
    events.push(createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.ANSWER_SERVED,
      subjectType: 'CONVERSATION',
      subjectId,
      correlationId,
      after: {
        inbound_id: inbound.id,
        conversation_id: conversation.conversation_id,
        outbox_id: outbound.id
      }
    }));
  }

  return events;
}

/**
 * Canonical inbound lifecycle:
 * durable admission → conversation processing → outbox enqueue → audit.
 *
 * Identity is established from durable IDs inside this transaction. Delivery
 * remains outside this transaction and extends the same identity with the
 * outbound provider delivery ID/idempotency key.
 */
export async function runCanonicalInboundLifecycle(db, {
  message,
  processConversation,
  provider = message?.provider,
  actorId = null
} = {}) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  if (!message) throw new Error('MESSAGE_REQUIRED');
  if (typeof processConversation !== 'function') throw new Error('CONVERSATION_PROCESSOR_REQUIRED');

  return db.transaction(async (tx) => {
    const repository = createInboxOutboxRepository(tx);
    const admission = await repository.insertIfNew({
      provider,
      providerMessageId: message.providerMessageId,
      conversationId: message.conversationId,
      sender: message.sender,
      payload: message.payload ?? { text: message.text ?? '' }
    });

    if (!admission.inserted) {
      return Object.freeze({
        status: 'DUPLICATE',
        inbound: null,
        conversation: null,
        outbound: null,
        identity: null,
        audit: []
      });
    }

    const inbound = admission.row;
    const canonicalCorrelationId = createCanonicalCorrelationId({
      provider: inbound.provider,
      inboundProviderMessageId: inbound.provider_message_id
    });
    const conversation = await processConversation(inbound, { tx, correlationId: canonicalCorrelationId });

    if (!conversation || !conversation.conversation_id) {
      throw new Error('CONVERSATION_ID_REQUIRED');
    }
    if (conversation.conversation_id !== inbound.conversation_id) {
      throw new Error('CONVERSATION_IDENTITY_MISMATCH');
    }

    const outboundPayload = conversation.outboundPayload ?? {
      text: conversation.text ?? conversation.response ?? ''
    };
    if (!String(outboundPayload.text ?? '').trim()) {
      throw new Error('OUTBOUND_TEXT_REQUIRED');
    }

    const outbound = await repository.enqueueOutbound({
      conversationId: inbound.conversation_id,
      replyToMessageId: inbound.id,
      provider,
      payload: outboundPayload
    });

    const identity = createLifecycleIdentity({
      provider,
      inboundProviderMessageId: inbound.provider_message_id,
      inboundId: inbound.id,
      conversationId: inbound.conversation_id,
      outboxId: outbound.id,
      attempt: Number(outbound.attempt_count ?? 0),
      correlationId: canonicalCorrelationId
    });

    const audit = lifecycleAuditEvents({
      inbound,
      conversation,
      outbound,
      correlationId: identity.correlation_id,
      actorId
    });

    for (const event of audit) {
      const persisted = await insertAuditEvent(tx, event);
      if (!persisted) throw new Error('AUDIT_WRITE_FAILED');
    }

    const processed = await repository.markInboundProcessed(inbound.id);
    if (!processed) throw new Error('INBOX_PROCESSING_COMMIT_FAILED');

    return Object.freeze({
      status: 'COMMITTED',
      inbound,
      conversation,
      outbound,
      identity,
      audit
    });
  });
}
