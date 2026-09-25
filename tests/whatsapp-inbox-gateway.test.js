import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboxGateway } from '../src/integrations/whatsapp/inbox-gateway.js';

function makeHarness({ inserted = true, replayAccepted = true } = {}) {
  const calls = [];
  return {
    calls,
    normalizer: input => ({
      provider: input.provider,
      providerMessageId: input.messageId,
      senderId: 'U1',
      timestamp: input.timestamp
    }),
    replayGuard: {
      windowSeconds: 300,
      async accept(args) {
        calls.push(['replay', args]);
        return replayAccepted;
      }
    },
    inboxRepository: {
      async insertIfNew(message) {
        calls.push(['inbox', message]);
        return { inserted };
      }
    }
  };
}

test('durable inbox is authoritative and replay store is called only after durable admission', async () => {
  const h = makeHarness();
  const gateway = createInboxGateway(h);
  const result = await gateway.accept({ provider: 'whatsapp', messageId: 'M1', timestamp: 1_000_000 });
  assert.equal(result.accepted, true);
  assert.deepEqual(h.calls.map(([type]) => type), ['inbox', 'replay']);
});

test('durable duplicate is rejected without consuming replay admission', async () => {
  const h = makeHarness({ inserted: false });
  const gateway = createInboxGateway(h);
  const result = await gateway.accept({ provider: 'whatsapp', messageId: 'M1', timestamp: 1_000_000 });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'DURABLE_DUPLICATE');
  assert.deepEqual(h.calls.map(([type]) => type), ['inbox']);
});

test('expired inbound is rejected before durable admission', async () => {
  const h = makeHarness();
  const gateway = createInboxGateway({ ...h, nowSeconds: () => 2_000_000 });
  const result = await gateway.accept({ provider: 'whatsapp', messageId: 'M1', timestamp: 1_999_000 });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'EXPIRED_OR_INVALID_TIMESTAMP');
  assert.deepEqual(h.calls, []);
});
