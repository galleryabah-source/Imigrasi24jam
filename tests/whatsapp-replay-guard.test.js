import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayGuard } from '../src/integrations/whatsapp/replay-guard.js';

function atomicMemoryStore() {
  const seen = new Map();
  return {
    async acceptIfAbsent(key, ttl) {
      if (seen.has(key)) return false;
      seen.set(key, ttl);
      return true;
    }
  };
}

test('replay guard atomically accepts a fresh message once', async () => {
  const guard = createReplayGuard({ store: atomicMemoryStore() });
  const now = 1_000_000;
  assert.equal(await guard.accept({ provider: 'wa', messageId: 'M1', timestamp: now, nowSeconds: now }), true);
  assert.equal(await guard.accept({ provider: 'wa', messageId: 'M1', timestamp: now, nowSeconds: now }), false);
});

test('replay guard rejects messages outside the time window', async () => {
  const guard = createReplayGuard({ store: atomicMemoryStore(), windowSeconds: 300 });
  assert.equal(await guard.accept({ provider: 'wa', messageId: 'M2', timestamp: 1_000, nowSeconds: 1_301 }), false);
});

test('replay guard requires atomic persistence', () => {
  assert.throws(() => createReplayGuard({ store: { has: async () => false, put: async () => {} } }), /ATOMIC_REPLAY_STORE_REQUIRED/);
});
