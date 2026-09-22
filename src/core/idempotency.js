export function requireIdempotencyKey(value) {
  const key = String(value ?? '').trim();
  if (!key || key.length < 16 || key.length > 200) throw new Error('INVALID_IDEMPOTENCY_KEY');
  return key;
}

export async function withIdempotency(store, key, operation) {
  requireIdempotencyKey(key);
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') throw new Error('IDEMPOTENCY_STORE_REQUIRED');
  if (typeof operation !== 'function') throw new Error('IDEMPOTENCY_OPERATION_REQUIRED');
  const existing = await store.get(key);
  if (existing) return Object.freeze({ replay: true, result: existing });
  if (typeof store.executeOnce !== 'function') {
    throw new Error('ATOMIC_IDEMPOTENCY_STORE_REQUIRED');
  }
  const result = await store.executeOnce(key, operation);
  return Object.freeze({ replay: Boolean(result?.replay), result: result?.result ?? result });
}
