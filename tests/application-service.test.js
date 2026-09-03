import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../src/core/application-service.js';

test('application service composes inbox and outbox processing into one cycle', async () => {
  const calls = [];
  const app = createApplication({
    inboxProcessor: {
      async processOne(options) {
        calls.push(['inbox', options]);
        return { status: 'QUEUED', inboxId: 'i1', outboxId: 'o1' };
      }
    },
    outboxWorker: {
      async processOne() {
        calls.push(['outbox']);
        return { status: 'SENT', id: 'o1' };
      }
    }
  });

  const result = await app.processCycle({ now: '2026-09-03T00:00:00.000Z' });

  assert.deepEqual(result, {
    inbox: { status: 'QUEUED', inboxId: 'i1', outboxId: 'o1' },
    outbox: { status: 'SENT', id: 'o1' }
  });
  assert.equal(calls[0][0], 'inbox');
  assert.equal(calls[0][1].now, '2026-09-03T00:00:00.000Z');
  assert.equal(calls[1][0], 'outbox');
});

test('application service refuses partial runtime composition', () => {
  assert.throws(() => createApplication({ outboxWorker: { processOne() {} } }), /APPLICATION_INBOX_PROCESSOR_REQUIRED/);
  assert.throws(() => createApplication({ inboxProcessor: { processOne() {} } }), /APPLICATION_OUTBOX_WORKER_REQUIRED/);
});

test('application service exposes independently testable stages', async () => {
  const app = createApplication({
    inboxProcessor: { async processOne() { return { status: 'IDLE' }; } },
    outboxWorker: { async processOne() { return { status: 'IDLE' }; } }
  });

  assert.deepEqual(await app.processInboxOne(), { status: 'IDLE' });
  assert.deepEqual(await app.processOutboxOne(), { status: 'IDLE' });
});
