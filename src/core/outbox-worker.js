export const RETRY_DELAYS_SECONDS = Object.freeze([30, 120, 600, 1800, 3600]);

export function calculateRetry(attemptCount) {
  const n = Number(attemptCount);
  if (!Number.isInteger(n) || n < 0) throw new Error('INVALID_ATTEMPT_COUNT');
  if (n >= RETRY_DELAYS_SECONDS.length) return Object.freeze({ terminal: true, delay_seconds: null });
  return Object.freeze({ terminal: false, delay_seconds: RETRY_DELAYS_SECONDS[n] });
}

export function createOutboxWorker({ repository, provider }) {
  if (!repository || typeof repository.claimPendingOutbound !== 'function' || typeof repository.markOutboundSent !== 'function' || typeof repository.scheduleOutboundRetry !== 'function') throw new Error('OUTBOX_REPOSITORY_REQUIRED');
  if (!provider || typeof provider.send !== 'function') throw new Error('PROVIDER_ADAPTER_REQUIRED');

  return Object.freeze({
    async processOne() {
      const job = await repository.claimPendingOutbound();
      if (!job) return Object.freeze({ status: 'IDLE' });
      try {
        const result = await provider.send(job.payload_json);
        const committed = await repository.markOutboundSent(job.id, result?.provider_message_id ?? null);
        if (committed === false) return Object.freeze({ status: 'LEASE_LOST', id: job.id });
        return Object.freeze({ status: 'SENT', id: job.id });
      } catch (error) {
        const retry = calculateRetry(job.attempt_count);
        if (retry.terminal) {
          const committed = await repository.markOutboundFailed(job.id, String(error?.message ?? error));
          if (committed === false) return Object.freeze({ status: 'LEASE_LOST', id: job.id });
          return Object.freeze({ status: 'FAILED', id: job.id });
        }
        const committed = await repository.scheduleOutboundRetry(job.id, retry.delay_seconds, String(error?.message ?? error));
        if (committed === false) return Object.freeze({ status: 'LEASE_LOST', id: job.id });
        return Object.freeze({ status: 'RETRY', id: job.id, delay_seconds: retry.delay_seconds });
      }
    }
  });
}
