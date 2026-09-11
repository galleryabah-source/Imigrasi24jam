import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRetry, createOutboxWorker } from '../src/core/outbox-worker.js';

test('retry uses bounded exponential-style schedule', () => {
  assert.deepEqual(calculateRetry(0), { terminal:false, delay_seconds:30 });
  assert.deepEqual(calculateRetry(1), { terminal:false, delay_seconds:120 });
  assert.deepEqual(calculateRetry(4), { terminal:false, delay_seconds:3600 });
  assert.equal(calculateRetry(5).terminal, true);
});

test('successful delivery marks sent and passes a stable idempotency key', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O1', attempt_count:0, payload_json:{ text:'ok' } }; },
      async markOutboundSent(id, providerId){ calls.push(['sent',id,providerId]); },
      async scheduleOutboundRetry(){ calls.push(['retry']); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(payload, options){ calls.push(['send', payload, options]); return { provider_message_id:'P1' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'SENT', id:'O1' });
  assert.equal(calls[0][0], 'send'); assert.equal(calls[0][2].idempotency_key, 'imigrasi24jam:outbox:O1');
  assert.deepEqual(calls[1], ['sent','O1','P1']);
});

test('provider failure schedules retry without rerunning core', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O2', attempt_count:0, payload_json:{ text:'retry' } }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(id, delay){ calls.push(['retry',id,delay]); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(){ throw new Error('TIMEOUT'); } }
  });
  assert.deepEqual(await worker.processOne(), { status:'RETRY', id:'O2', delay_seconds:30 });
  assert.deepEqual(calls, [['retry','O2',30]]);
});

test('provider execution is bounded by the configured timeout', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    providerTimeoutMs: 20,
    repository: {
      async claimPendingOutbound(){ return { id:'O-TIMEOUT', attempt_count:0, payload_json:{ text:'slow' } }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(id, delay, error){ calls.push(['retry',id,delay,error]); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(){ await new Promise(() => {}); } }
  });
  const result = await worker.processOne();
  assert.deepEqual(result, { status:'RETRY', id:'O-TIMEOUT', delay_seconds:30 });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'retry'); assert.match(calls[0][3], /^PROVIDER_TIMEOUT$/);
});

test('provider acknowledgement without acceptance or provider message id is retried', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O3', attempt_count:0, payload_json:{ text:'ack' } }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(id, delay){ calls.push(['retry', id, delay]); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(){ return { accepted: false }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'RETRY', id:'O3', delay_seconds:30 });
  assert.deepEqual(calls, [['retry','O3',30]]);
});

test('persistence failure after provider success is isolated as an ACK recovery case', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O4', attempt_count:0, payload_json:{ text:'ack persistence' } }; },
      async markOutboundSent(){ throw new Error('DB_UNAVAILABLE'); },
      async scheduleOutboundRetry(id, delay, error){ calls.push(['retry',id,delay,error]); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(){ return { provider_message_id:'P4' }; } }
  });
  const result = await worker.processOne();
  assert.deepEqual(result, { status:'RETRY_ACK', id:'O4', delay_seconds:30 });
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'retry'); assert.match(calls[0][3], /^ACK_PERSISTENCE_FAILED:/);
});
