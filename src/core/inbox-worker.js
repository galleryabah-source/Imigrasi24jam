import { runCanonicalInboundLifecycle } from './canonical-message-lifecycle.js';

/**
 * Compatibility entry point for legacy callers.
 *
 * This file is deliberately no longer a persistence implementation. It is an
 * adapter into the canonical lifecycle so there is exactly one production
 * Inbox → Conversation → Outbox → Audit path.
 */
export async function claimAndProcessInbound(
  db,
  { provider, providerMessageId, conversationId, sender, payload, correlationId = providerMessageId },
  process
) {
  if (!db || typeof db.transaction !== 'function') throw new Error('TRANSACTION_REQUIRED');
  if (typeof process !== 'function') throw new Error('PROCESSOR_REQUIRED');

  const result = await runCanonicalInboundLifecycle(db, {
    message: {
      provider,
      providerMessageId,
      conversationId,
      sender,
      payload,
      correlationId
    },
    processConversation: async (inbound, context) => {
      const legacyResult = await process(inbound, context);
      const outboundPayload = legacyResult?.outboundPayload ?? legacyResult ?? {};
      const text = String(
        outboundPayload.text ??
        outboundPayload.response ??
        ''
      ).trim();

      if (!text) throw new Error('OUTBOUND_TEXT_REQUIRED');

      return Object.freeze({
        status: legacyResult?.status ?? 'ANSWER',
        state: legacyResult?.state ?? 'ANSWERING',
        conversation_id: inbound.conversation_id,
        intent: legacyResult?.intent ?? null,
        text,
        outboundPayload: { ...outboundPayload, text }
      });
    }
  });

  if (result.status === 'DUPLICATE') {
    if (typeof process.onDuplicate === 'function') {
      await process.onDuplicate({ provider, providerMessageId, conversationId, correlationId });
    }
    return Object.freeze({ status: 'DUPLICATE', created: false });
  }

  return Object.freeze({
    status: 'PROCESSED',
    created: true,
    inbound_id: result.inbound.id,
    outbox_id: result.outbound.id,
    identity: result.identity
  });
}
