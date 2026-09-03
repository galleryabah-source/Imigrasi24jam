export function createApplication({ inboxProcessor, outboxWorker } = {}) {
  if (!inboxProcessor || typeof inboxProcessor.processOne !== 'function') {
    throw new Error('APPLICATION_INBOX_PROCESSOR_REQUIRED');
  }
  if (!outboxWorker || typeof outboxWorker.processOne !== 'function') {
    throw new Error('APPLICATION_OUTBOX_WORKER_REQUIRED');
  }

  return Object.freeze({
    async processInboxOne(options) {
      return inboxProcessor.processOne(options);
    },

    async processOutboxOne() {
      return outboxWorker.processOne();
    },

    async processCycle({ now } = {}) {
      const inbox = await inboxProcessor.processOne({ now });
      const outbox = await outboxWorker.processOne();
      return Object.freeze({ inbox, outbox });
    }
  });
}
