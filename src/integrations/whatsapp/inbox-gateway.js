export function createInboxGateway({ replayGuard, normalizer, inboxRepository }) {
  if (!replayGuard || typeof replayGuard.accept !== 'function') throw new Error('REPLAY_GUARD_REQUIRED');
  if (typeof normalizer !== 'function') throw new Error('NORMALIZER_REQUIRED');
  if (!inboxRepository || typeof inboxRepository.insertIfNew !== 'function') throw new Error('INBOX_REPOSITORY_REQUIRED');

  return Object.freeze({
    async accept(request) {
      const message = normalizer(request);
      const fresh = await replayGuard.accept({
        provider: message.provider,
        messageId: message.providerMessageId,
        timestamp: message.timestamp
      });
      if (!fresh) return Object.freeze({ accepted: false, reason: 'REPLAY_OR_EXPIRED' });
      const result = await inboxRepository.insertIfNew(message);
      return Object.freeze({ accepted: result.inserted === true, duplicate: result.inserted !== true, message });
    }
  });
}
