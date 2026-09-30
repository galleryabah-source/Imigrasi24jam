import { isReplayTimestampFresh } from './replay-guard.js';

export function createInboxGateway({ replayGuard, normalizer, nowSeconds = () => Math.floor(Date.now() / 1000) }) {
  if (!replayGuard) throw new Error('REPLAY_GUARD_REQUIRED');
  if (typeof normalizer !== 'function') throw new Error('NORMALIZER_REQUIRED');

  return Object.freeze({
    async accept(request) {
      const message = normalizer(request);
      if (!isReplayTimestampFresh({ timestamp: message.timestamp, nowSeconds: nowSeconds(), windowSeconds: replayGuard.windowSeconds ?? 300 })) {
        return Object.freeze({ accepted: false, reason: 'EXPIRED_OR_INVALID_TIMESTAMP', message });
      }

      // This gateway is validation-only. Durable Inbox admission belongs exclusively
      // to runCanonicalInboundLifecycle(); do not consume replay state here because
      // a downstream transaction failure must remain retryable.
      return Object.freeze({ accepted: true, duplicate: false, message });
    }
  });
}
