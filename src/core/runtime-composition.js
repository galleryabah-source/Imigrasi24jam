import { createInboxOutboxRepository } from './inbox-outbox-repository.js';
import { createConversationRepository } from './conversation-repository.js';
import { createInboxProcessor } from './inbox-processor.js';
import { createOutboxWorker } from './outbox-worker.js';
import { createApplication } from './application-service.js';

function requireFunction(value, code) {
  if (typeof value !== 'function') throw new Error(code);
}

export function createRuntimeComposition({ db, knowledgeProvider, whatsappProvider, workerId, inboxLeaseSeconds = 60, outboundTimeoutMs = 15000 } = {}) {
  if (!db || typeof db.query !== 'function' || typeof db.transaction !== 'function') throw new Error('RUNTIME_DATABASE_REQUIRED');
  requireFunction(knowledgeProvider, 'RUNTIME_KNOWLEDGE_PROVIDER_REQUIRED');
  if (!whatsappProvider || typeof whatsappProvider.sendText !== 'function' || typeof whatsappProvider.sendAttachment !== 'function') {
    throw new Error('RUNTIME_WHATSAPP_PROVIDER_REQUIRED');
  }

  const repository = createInboxOutboxRepository(db);
  const conversationRepository = createConversationRepository(db);
  const inboxProcessor = createInboxProcessor({
    repository,
    conversationRepository,
    knowledgeProvider,
    workerId,
    leaseSeconds: inboxLeaseSeconds
  });

  const outboxProvider = Object.freeze({
    async send(payload, { idempotency_key: idempotencyKey } = {}) {
      if (!payload || typeof payload !== 'object') throw new Error('OUTBOX_PAYLOAD_INVALID');
      const options = Object.freeze({ idempotency_key: idempotencyKey });
      const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
      if (attachments.length) return whatsappProvider.sendAttachment({ ...payload, options });
      return whatsappProvider.sendText({ ...payload, options });
    }
  });

  const outboxWorker = createOutboxWorker({ repository, provider: {
    async send(payload, options) {
      return withTimeout(outboxProvider.send(payload, options), outboundTimeoutMs);
    }
  }});

  return Object.freeze({
    db,
    repository,
    conversationRepository,
    inboxProcessor,
    outboxWorker,
    application: createApplication({ inboxProcessor, outboxWorker })
  });
}

async function withTimeout(promise, timeoutMs) {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('INVALID_OUTBOUND_TIMEOUT_MS');
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('OUTBOUND_PROVIDER_TIMEOUT')), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
