import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxGateway } from '../src/integrations/whatsapp/inbox-gateway.js';

function makeHarness() {
  const calls = [];
  return {
    calls,
    normalizer: input => ({
      provider: input.provider,
      providerMessageId: input.messageId,
      senderId: 'U1',
      timestamp: input.timestamp
    }),
    replayGuard: { windowSeconds: 300 }
  };
}

test('gateway validates and normalizes without owning durable inbox admission', async () => {
  const h = makeHarness();
  const gateway = createInboxGateway({ ...h, nowSeconds: () => 1_000_000 });
  const result = await gateway.accept({ provider: 'whatsapp', messageId: 'M1', timestamp: 1_000_000 });
  assert.equal(result.accepted, true);
  assert.equal(result.duplicate, false);
  assert.deepEqual(h.calls, []);
});

test('gateway does not consume replay state before canonical transaction', async () => {
  const calls = [];
  const gateway = createInboxGateway({
    normalizer: input => ({
      provider: input.provider,
      providerMessageId: input.messageId,
      senderId: 'U1',
      timestamp: input.timestamp
    }),
    replayGuard: {
      windowSeconds: 300,
      async accept() { calls.push('replay'); return true; }
    },
    nowSeconds: () => 1_000_000
  });
  const result = await gateway.accept({ provider: 'whatsapp', messageId: 'M1', timestamp: 1_000_000 });
  assert.equal(result.accepted, true);
  assert.deepEqual(calls, []);
});

test('expired inbound is rejected before canonical admission', async () => {
  const h = makeHarness();
  const gateway = createInboxGateway({ ...h, nowSeconds: () => 2_000_000 });
  const result = await gateway.accept({ provider: 'whatsapp', messageId: 'M1', timestamp: 1_999_000 });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'EXPIRED_OR_INVALID_TIMESTAMP');
  assert.deepEqual(h.calls, []);
});
