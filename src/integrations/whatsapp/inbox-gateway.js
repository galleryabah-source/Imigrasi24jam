import { isReplayTimestampFresh } from './replay-guard.js';

export function createInboxGateway({ replayGuard, normalizer, inboxRepository, nowSeconds = () => Math.floor(Date.now() / 1000) }) {
  if (!replayGuard || typeof replayGuard.accept !== 'function') throw new Error('REPLAY_GUARD_REQUIRED');
  if (typeof normalizer !== 'function') throw new Error('NORMALIZER_REQUIRED');
  if (!inboxRepository || typeof inboxRepository.insertIfNew !== 'function') throw new Error('INBOX_REPOSITORY_REQUIRED');

  return Object.freeze({
    async accept(request) {
      const message = normalizer(request);
      if (!isReplayTimestampFresh({ timestamp: message.timestamp, nowSeconds: nowSeconds(), windowSeconds: replayGuard.windowSeconds ?? 300 })) {
        return Object.freeze({ accepted: false, reason: 'EXPIRED_OR_INVALID_TIMESTAMP', message });
      }

      // Durable inbox uniqueness is the canonical admission decision.
      // The replay store is defense-in-depth and must never consume a message
      // before the durable write succeeds; otherwise a failed DB write could
      // permanently reject a legitimate provider retry.
      const result = await inboxRepository.insertIfNew(message);
      if (result.inserted !== true) {
        return Object.freeze({ accepted: false, duplicate: true, reason: 'DURABLE_DUPLICATE', message });
      }

      await replayGuard.accept({
        provider: message.provider,
        messageId: message.providerMessageId,
        timestamp: message.timestamp,
        nowSeconds: nowSeconds()
      });

      return Object.freeze({ accepted: true, duplicate: false, message });
    }
  });
}
