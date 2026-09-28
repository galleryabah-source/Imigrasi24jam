import { createInboxOutboxRepository } from './inbox-outbox-repository.js';
import { createAuditEvent, AUDIT_EVENTS } from './audit-contract.js';

function lifecycleAuditEvents({ inbound, conversation, outbound, correlationId, actorId = null }) {
  const events = [
    createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.MESSAGE_RECEIVED,
      subjectType: 'CONVERSATION',
      subjectId: conversation.conversation_id,
      correlationId,
      after: { inbound_id: inbound.id, provider: inbound.provider, provider_message_id: inbound.provider_message_id }
    }),
    createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.CONVERSATION_TRANSITIONED,
      subjectType: 'CONVERSATION',
      subjectId: conversation.conversation_id,
      correlationId,
      after: { state: conversation.state, intent: conversation.intent ?? null }
    }),
    createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.OUTBOX_ENQUEUED,
      subjectType: 'CONVERSATION',
      subjectId: conversation.conversation_id,
      correlationId,
      after: { outbox_id: outbound.id, reply_to_message_id: outbound.reply_to_message_id }
    })
  ];

  if (conversation.status === 'ANSWER' || conversation.state === 'ANSWERING') {
    events.push(createAuditEvent({
      actorId,
      eventType: AUDIT_EVENTS.ANSWER_SERVED,
      subjectType: 'CONVERSATION',
      subjectId: conversation.conversation_id,
      correlationId,
      after: { outbox_id: outbound.id }
    }));
  }

  return events;
}

/**
 * Canonical inbound lifecycle:
 * durable admission → conversation processing → outbox enqueue → audit.
 *
 * Delivery is intentionally outside this transaction and remains owned by
 * the canonical outbox worker/provider adapter seam.
 */
export async function runCanonicalInboundLifecycle(db, {
  message,
  processConversation,
  provider = message?.provider,
  actorId = null,
  correlationId = message?.correlationId ?? message?.providerMessageId ?? null
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
      return Object.freeze({ status: 'DUPLICATE', inbound: null, conversation: null, outbound: null, audit: [] });
    }

    const inbound = admission.row;
    const conversation = await processConversation(inbound, { tx, correlationId });
    if (!conversation || !conversation.conversation_id) throw new Error('CONVERSATION_ID_REQUIRED');

    const outboundPayload = conversation.outboundPayload ?? { text: conversation.text ?? conversation.response ?? '' };
    if (!String(outboundPayload.text ?? '').trim()) {
      throw new Error('OUTBOUND_TEXT_REQUIRED');
    }

    const outbound = await repository.enqueueOutbound({
      conversationId: inbound.conversation_id,
      replyToMessageId: inbound.id,
      provider,
      payload: outboundPayload
    });

    const audit = lifecycleAuditEvents({
      inbound,
      conversation,
      outbound,
      correlationId: correlationId ?? inbound.provider_message_id,
      actorId
    });

    for (const event of audit) {
      const result = await tx.query(
        `INSERT INTO audit_events
          (id, actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, correlation_id, created_at)
         VALUES
          (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
         RETURNING id, created_at`,
        [
          event.actor_id,
          event.event_type,
          event.subject_type,
          event.subject_id,
          JSON.stringify(event.before_json ?? null),
          JSON.stringify(event.after_json ?? null),
          event.reason,
          event.correlation_id,
          event.created_at
        ]
      );
      if (!result.rows[0]) throw new Error('AUDIT_WRITE_FAILED');
    }

    const processed = await repository.markInboundProcessed(inbound.id);
    if (!processed) throw new Error('INBOX_PROCESSING_COMMIT_FAILED');

    return Object.freeze({ status: 'COMMITTED', inbound, conversation, outbound, audit });
  });
}
