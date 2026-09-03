import { orchestrateMessage } from './message-orchestrator.js';
import { createOutboundMessage } from './message-delivery.js';

const DEFAULT_LEASE_SECONDS = 60;
const DEFAULT_WORKER_ID = process.env.INBOX_WORKER_ID || `inbox-worker-${process.pid}`;

function normalizeInboxMessage(row) {
  if (!row?.id || !row.provider || !row.provider_message_id || !row.conversation_id || !row.sender) {
    throw new Error('INBOX_MESSAGE_IDENTITY_INVALID');
  }
  const payload = row.payload_json && typeof row.payload_json === 'object' ? row.payload_json : {};
  return {
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    conversationId: row.conversation_id,
    sender: row.sender,
    text: String(payload.text ?? ''),
    receivedAt: row.received_at
  };
}

export function createInboxProcessor({ repository, knowledgeProvider, workerId = DEFAULT_WORKER_ID, leaseSeconds = DEFAULT_LEASE_SECONDS } = {}) {
  if (!repository ||
      typeof repository.claimPendingInbound !== 'function' ||
      typeof repository.markInboundProcessed !== 'function' ||
      typeof repository.markInboundFailed !== 'function' ||
      typeof repository.completeInboundWithOutbound !== 'function') {
    throw new Error('INBOX_PROCESSOR_REPOSITORY_REQUIRED');
  }
  if (typeof knowledgeProvider !== 'function') throw new Error('KNOWLEDGE_PROVIDER_REQUIRED');
  if (!workerId || typeof workerId !== 'string') throw new Error('INBOX_WORKER_ID_REQUIRED');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds <= 0) throw new Error('INVALID_INBOX_LEASE_SECONDS');

  return Object.freeze({
    async processOne({ now = new Date().toISOString() } = {}) {
      const row = await repository.claimPendingInbound({ workerId, leaseSeconds });
      if (!row) return Object.freeze({ status: 'IDLE' });

      try {
        const message = normalizeInboxMessage(row);
        const knowledge = await knowledgeProvider({ message, now });
        const candidates = Array.isArray(knowledge) ? knowledge : (knowledge?.items ?? []);
        const evidenceByKnowledgeId = knowledge && !Array.isArray(knowledge) && knowledge.evidenceByKnowledgeId
          ? knowledge.evidenceByKnowledgeId
          : {};
        if (!Array.isArray(candidates)) throw new Error('KNOWLEDGE_ITEMS_INVALID');

        const result = await orchestrateMessage({
          message,
          conversation: null,
          knowledge: candidates,
          evidenceByKnowledgeId,
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
          const queued = await repository.completeInboundWithOutbound({
            inboxId: row.id,
            conversationId: outbound.conversation_id,
            replyToMessageId: outbound.reply_to_message_id,
            provider: outbound.provider,
            payload: outbound,
            workerId
          });
          return Object.freeze({ status: 'QUEUED', inboxId: row.id, outboxId: queued?.id ?? null });
        }

        await repository.markInboundProcessed(row.id, workerId);
        return Object.freeze({ status: result.status, inboxId: row.id, result });
      } catch (error) {
        try {
          await repository.markInboundFailed(row.id, String(error?.message ?? error), workerId);
        } catch {
          // Preserve the original processor outcome so a recovery worker can inspect the record.
        }
        return Object.freeze({ status: 'FAILED', inboxId: row.id, reason: 'PROCESSING_ERROR' });
      }
    }
  });
}
