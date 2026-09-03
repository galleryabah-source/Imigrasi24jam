import { orchestrateMessage } from './message-orchestrator.js';
import { createOutboundMessage } from './message-delivery.js';

function normalizeInboxMessage(row) {
  const payload = row?.payload_json && typeof row.payload_json === 'object' ? row.payload_json : {};
  return {
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    conversationId: row.conversation_id,
    sender: row.sender,
    text: String(payload.text ?? ''),
    receivedAt: row.received_at
  };
}

export function createInboxProcessor({ repository, knowledgeProvider }) {
  if (!repository || typeof repository.claimPendingInbound !== 'function' || typeof repository.markInboundProcessed !== 'function' || typeof repository.markInboundFailed !== 'function' || typeof repository.enqueueOutbound !== 'function') {
    throw new Error('INBOX_PROCESSOR_REPOSITORY_REQUIRED');
  }
  if (typeof knowledgeProvider !== 'function') throw new Error('KNOWLEDGE_PROVIDER_REQUIRED');

  return Object.freeze({
    async processOne({ now = new Date().toISOString() } = {}) {
      const row = await repository.claimPendingInbound();
      if (!row) return Object.freeze({ status: 'IDLE' });

      try {
        const message = normalizeInboxMessage(row);
        const knowledge = await knowledgeProvider({ message, now });
        const result = await orchestrateMessage({
          message,
          conversation: null,
          knowledge: knowledge?.items ?? knowledge ?? [],
          evidenceByKnowledgeId: knowledge?.evidenceByKnowledgeId ?? {},
          now
        });

        if (result.status === 'ANSWER' && String(result.text ?? '').trim()) {
          const outbound = createOutboundMessage({
            provider: message.provider,
            conversationId: message.conversationId,
            replyToMessageId: row.id,
            text: result.text,
            attachments: result.safety?.attachments ?? []
          });
          const queued = await repository.enqueueOutbound({
            conversationId: outbound.conversation_id,
            replyToMessageId: outbound.reply_to_message_id,
            provider: outbound.provider,
            payload: outbound
          });
          await repository.markInboundProcessed(row.id);
          return Object.freeze({ status: 'QUEUED', inboxId: row.id, outboxId: queued?.id ?? null });
        }

        await repository.markInboundProcessed(row.id);
        return Object.freeze({ status: result.status, inboxId: row.id, result });
      } catch (error) {
        await repository.markInboundFailed(row.id, String(error?.message ?? error));
        return Object.freeze({ status: 'FAILED', inboxId: row.id, reason: 'PROCESSING_ERROR' });
      }
    }
  });
}
