import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRetry, createOutboxWorker } from '../src/core/outbox-worker.js';

test('retry uses bounded exponential-style schedule', () => {
  assert.deepEqual(calculateRetry(0), { terminal:false, delay_seconds:30 });
  assert.deepEqual(calculateRetry(1), { terminal:false, delay_seconds:120 });
  assert.deepEqual(calculateRetry(4), { terminal:false, delay_seconds:3600 });
  assert.equal(calculateRetry(5).terminal, true);
});

test('outbox worker rejects a lease that is not longer than provider timeout', () => {
  const repository = {
    async claimPendingOutbound(){ throw new Error('claim must not run'); },
    async markOutboundSent(){}, async scheduleOutboundRetry(){}, async markOutboundFailed(){}
  };
  assert.throws(() => createOutboxWorker({ repository, provider:{ async send(){} }, providerTimeoutMs:30000, leaseSeconds:30 }), /OUTBOX_LEASE_MUST_EXCEED_PROVIDER_TIMEOUT/);
  assert.throws(() => createOutboxWorker({ repository, provider:{ async send(){} }, providerTimeoutMs:30000, leaseSeconds:29 }), /INVALID_OUTBOX_LEASE_SECONDS/);
});

test('successful delivery marks sent and passes a stable idempotency key and abort signal', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O1', attempt_count:0, conversation_id:'C1', reply_to_message_id:'I1', payload_json:{ text:'ok' } }; },
      async markOutboundSent(id, providerId, auditEvent){ calls.push(['sent',id,providerId,auditEvent]); },
      async scheduleOutboundRetry(){ calls.push(['retry']); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(payload, options){ calls.push(['send', payload, options]); return { provider_message_id:'P1' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'SENT', id:'O1' });
  assert.equal(calls[0][0], 'send'); assert.equal(calls[0][2].idempotency_key, 'imigrasi24jam:outbox:O1');
  assert.equal(calls[0][2].signal instanceof AbortSignal, true);
  assert.equal(calls[0][2].signal.aborted, false);
  assert.equal(calls[1][0], 'sent'); assert.equal(calls[1][1], 'O1'); assert.equal(calls[1][2], 'P1');
  assert.equal(calls[1][3].event_type, 'ANSWER_SERVED'); assert.equal(calls[1][3].subject_type, 'MESSAGE_OUTBOX'); assert.equal(calls[1][3].subject_id, 'O1');
  assert.deepEqual(calls[1][3].after_json, { delivery_state:'SENT', provider_message_id:'P1', conversation_id:'C1', reply_to_message_id:'I1' });
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

test('provider timeout aborts the provider signal', async () => {
  const calls = [];
  let observedSignal;
  const worker = createOutboxWorker({
    providerTimeoutMs: 20,
    repository: {
      async claimPendingOutbound(){ return { id:'O-TIMEOUT', attempt_count:0, payload_json:{ text:'slow' } }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(id, delay, error){ calls.push(['retry',id,delay,error]); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(payload, options){
      observedSignal = options.signal;
      await new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('ABORTED_BY_WORKER')), { once:true });
      });
    } }
  });
  const result = await worker.processOne();
  assert.deepEqual(result, { status:'RETRY', id:'O-TIMEOUT', delay_seconds:30 });
  assert.equal(observedSignal.aborted, true);
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'retry'); assert.match(calls[0][3], /^PROVIDER_TIMEOUT$/);
});

test('provider execution is bounded by the configured timeout', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    providerTimeoutMs: 20,
    repository: {
      async claimPendingOutbound(){ return { id:'O-TIMEOUT-2', attempt_count:0, payload_json:{ text:'slow' } }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(id, delay, error){ calls.push(['retry',id,delay,error]); }, async markOutboundFailed(){ calls.push(['failed']); }
    },
    provider: { async send(){ await new Promise(() => {}); } }
  });
  const result = await worker.processOne();
  assert.deepEqual(result, { status:'RETRY', id:'O-TIMEOUT-2', delay_seconds:30 });
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

test('attachment is revalidated immediately before provider send', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O5', attempt_count:0, payload_json:{ text:'answer', attachments:[{ id:'D1', status:'PUBLISHED', visibility:'PUBLIC' }] } }; },
      async revalidateOutboundAttachments(payload){ calls.push(['revalidate', payload.attachments]); return { allowed:true, document_ids:['D1'] }; },
      async markOutboundSent(id){ calls.push(['sent', id]); }, async scheduleOutboundRetry(id, delay, error){ calls.push(['retry',id,delay,error]); }, async markOutboundFailed(id, error){ calls.push(['failed',id,error]); }
    },
    provider: { async send(){ calls.push(['send']); return { provider_message_id:'P5' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'SENT', id:'O5' });
  assert.deepEqual(calls.map((entry) => entry[0]), ['revalidate', 'send', 'sent']);
});

test('attachment publication policy failure is terminal and never retried', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O6', attempt_count:0, payload_json:{ text:'answer', attachments:[{ id:'D2' }] } }; },
      async revalidateOutboundAttachments(){ calls.push(['revalidate']); return { allowed:false, blocked_document_ids:['D2'] }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(){ calls.push(['retry']); }, async markOutboundFailed(id, error){ calls.push(['failed',id,error]); }
    },
    provider: { async send(){ calls.push(['send']); return { provider_message_id:'SHOULD-NOT-SEND' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'FAILED_POLICY', id:'O6' });
  assert.deepEqual(calls.map((entry) => entry[0]), ['revalidate', 'failed']);
  assert.match(calls[1][2], /^OUTBOUND_ATTACHMENT_BLOCKED:/);
});

test('attachment send is terminally blocked if repository cannot revalidate it', async () => {
  const calls = [];
  const worker = createOutboxWorker({
    repository: {
      async claimPendingOutbound(){ return { id:'O7', attempt_count:0, payload_json:{ text:'answer', attachments:[{ id:'D3' }] } }; },
      async markOutboundSent(){ calls.push(['sent']); }, async scheduleOutboundRetry(){ calls.push(['retry']); }, async markOutboundFailed(id, error){ calls.push(['failed',id,error]); }
    },
    provider: { async send(){ calls.push(['send']); return { provider_message_id:'SHOULD-NOT-SEND' }; } }
  });
  assert.deepEqual(await worker.processOne(), { status:'FAILED_POLICY', id:'O7' });
  assert.deepEqual(calls.map((entry) => entry[0]), ['failed']);
  assert.match(calls[0][2], /^OUTBOX_ATTACHMENT_REVALIDATION_REQUIRED$/);
});
