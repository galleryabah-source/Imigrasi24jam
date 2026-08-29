export function createReplayGuard({ store, windowSeconds = 300 }) {
  if (!store || typeof store.has !== 'function' || typeof store.put !== 'function') throw new Error('REPLAY_STORE_REQUIRED');
  if (!Number.isInteger(windowSeconds) || windowSeconds <= 0) throw new Error('INVALID_REPLAY_WINDOW');

  return Object.freeze({
    async accept({ provider, messageId, timestamp, nowSeconds = Math.floor(Date.now() / 1000) }) {
      if (!provider || !messageId || !Number.isFinite(timestamp)) return false;
      if (Math.abs(nowSeconds - timestamp) > windowSeconds) return false;
      const key = `${provider}:${messageId}`;
      if (await store.has(key)) return false;
      await store.put(key, windowSeconds);
      return true;
    }
  });
}
