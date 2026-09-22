function stageFailure(error) {
  return Object.freeze({
    status: 'FAILED',
    reason: 'RUNTIME_STAGE_ERROR',
    error_code: String(error?.code ?? error?.message ?? 'UNKNOWN').slice(0, 120)
  });
}

export function createApplication({ inboxProcessor, outboxWorker } = {}) {
  if (!inboxProcessor || typeof inboxProcessor.processOne !== 'function') {
    throw new Error('APPLICATION_INBOX_PROCESSOR_REQUIRED');
  }
  if (!outboxWorker || typeof outboxWorker.processOne !== 'function') {
    throw new Error('APPLICATION_OUTBOX_WORKER_REQUIRED');
  }

  return Object.freeze({
    async processInboxOne(options) {
      try {
        return await inboxProcessor.processOne(options);
      } catch (error) {
        return stageFailure(error);
      }
    },

    async processOutboxOne() {
      try {
        return await outboxWorker.processOne();
      } catch (error) {
        return stageFailure(error);
      }
    },

    async processCycle({ now } = {}) {
      const inbox = await this.processInboxOne({ now });
      const outbox = await this.processOutboxOne();
      return Object.freeze({ inbox, outbox });
    }
  });
}
