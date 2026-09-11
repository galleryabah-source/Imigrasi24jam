import { createInboxOutboxRepository } from './inbox-outbox-repository.js';
import { createOutboxLeaseRepository } from './outbox-lease-repository.js';
import { createConversationRepository } from './conversation-repository.js';
import { createInboxProcessor } from './inbox-processor.js';
import { createOutboxWorker } from './outbox-worker.js';
import { createApplication } from './application-service.js';
import { createPostgresKnowledgeProvider } from './postgres-knowledge-provider.js';

function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
}

export function createRuntimeComposition({ db, knowledgeProvider = null, whatsappProvider, workerId, inboxLeaseSeconds = 60, outboxLeaseSeconds = 60, outboundTimeoutMs = 15000 } = {}) {
  if (!db || typeof db.query !== 'function' || typeof db.transaction !== 'function') throw new Error('RUNTIME_DATABASE_REQUIRED');
  const resolvedKnowledgeProvider = knowledgeProvider ?? createPostgresKnowledgeProvider(db, { publicOnly: true });
  requireFunction(resolvedKnowledgeProvider, 'RUNTIME_KNOWLEDGE_PROVIDER_REQUIRED');
  if (!whatsappProvider || typeof whatsappProvider.sendText !== 'function' || typeof whatsappProvider.sendAttachment !== 'function') {
    throw new Error('RUNTIME_WHATSAPP_PROVIDER_REQUIRED');
  }
  if (!workerId || typeof workerId !== 'string') throw new Error('RUNTIME_WORKER_ID_REQUIRED');

  const inboxRepository = createInboxOutboxRepository(db);
  const conversationRepository = createConversationRepository(db);
  const outboxRepository = createOutboxLeaseRepository(db, { workerId, leaseSeconds: outboxLeaseSeconds });
  const inboxProcessor = createInboxProcessor({ repository: inboxRepository, conversationRepository, knowledgeProvider: resolvedKnowledgeProvider, workerId, leaseSeconds: inboxLeaseSeconds });
  const outboxWorker = createOutboxWorker({
    repository: outboxRepository,
    provider: {
      async send(payload, { idempotency_key: idempotencyKey } = {}) {
        if (!payload || typeof payload !== 'object') throw new Error('OUTBOX_PAYLOAD_INVALID');
        const options = Object.freeze({ idempotency_key: idempotencyKey });
        const operation = Array.isArray(payload.attachments) && payload.attachments.length
          ? whatsappProvider.sendAttachment({ ...payload, options })
          : whatsappProvider.sendText({ ...payload, options });
        return withTimeout(operation, outboundTimeoutMs);
      }
    }
  });

  return Object.freeze({ db, knowledgeProvider: resolvedKnowledgeProvider, inboxRepository, outboxRepository, conversationRepository, inboxProcessor, outboxWorker, application: createApplication({ inboxProcessor, outboxWorker }) });
}

async function withTimeout(promise, timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('INVALID_OUTBOUND_TIMEOUT_MS');
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OUTBOUND_PROVIDER_TIMEOUT')), timeoutMs); })]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
