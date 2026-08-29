import test from 'node:test';
import assert from 'node:assert/strict';
import { processInboundToOutbox } from '../src/core/conversation-inbox-pipeline.js';

test('inbound pipeline persists, handles, and queues one answer', async () => {
  const calls = [];
  const adapter = { acceptWebhook: async () => ({ accepted:true, messages:[{ provider:'mock', providerMessageId:'M1', conversationId:'C1', sender:'628', messageType:'text', text:'paspor' }] }) };
  const inbox = { insertInbound: async (m) => { calls.push(['inbox',m.providerMessageId]); return { duplicate:false, messageId:'DB1' }; } };
  const conversation = { handle: async (m) => { calls.push(['conversation',m.providerMessageId]); return { text:'Informasi layanan keimigrasian.' }; } };
  const outbox = { enqueueText: async (p) => { calls.push(['outbox',p.sourceMessageId]); return { id:'O1' }; } };
  const result = await processInboundToOutbox({ adapter, request:{}, inbox, conversation, outbox });
  assert.equal(result.accepted,true);
  assert.deepEqual(calls.map(x=>x[0]), ['inbox','conversation','outbox']);
  assert.equal(result.results[0].queued.id,'O1');
});

test('duplicate inbound does not invoke conversation or outbox', async () => {
  let handled = false;
  let queued = false;
  const adapter = { acceptWebhook: async () => ({ accepted:true, messages:[{ providerMessageId:'M1', conversationId:'C1', sender:'628' }] }) };
  const inbox = { insertInbound: async () => ({ duplicate:true, messageId:'DB1' }) };
  const conversation = { handle: async () => { handled=true; return {text:'x'}; } };
  const outbox = { enqueueText: async () => { queued=true; return {id:'O1'}; } };
  const result = await processInboundToOutbox({ adapter, request:{}, inbox, conversation, outbox });
  assert.equal(result.results[0].duplicate,true);
  assert.equal(handled,false);
  assert.equal(queued,false);
});
