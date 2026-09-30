export function createReplayStoreContract(store) {
  if (!store || typeof store.acceptIfAbsent !== 'function') throw new Error('ATOMIC_REPLAY_STORE_REQUIRED');
  return Object.freeze({
    async acceptIfAbsent(key, ttlSeconds) {
      if (!key || !Number.isInteger(ttlSeconds) || ttlSeconds <= 0) return false;
      return (await store.acceptIfAbsent(key, ttlSeconds)) === true;
    }
  });
}
