import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeComposition } from '../src/core/runtime-composition.js';

test('runtime composition requires the durable database and WhatsApp provider', () => {
  assert.throws(() => createRuntimeComposition(), /RUNTIME_DATABASE_REQUIRED/);
  assert.throws(() => createRuntimeComposition({ db: { query() {}, transaction() {} } }), /RUNTIME_WHATSAPP_PROVIDER_REQUIRED/);
});

test('runtime composition defaults to the PostgreSQL knowledge provider', () => {
  const db = { query() {}, transaction() {} };
  const whatsappProvider = { sendText: async () => ({ provider_message_id: 'p1' }), sendAttachment: async () => ({ provider_message_id: 'p2' }) };
  const runtime = createRuntimeComposition({ db, whatsappProvider, workerId: 'worker-1' });

  assert.equal(typeof runtime.knowledgeProvider, 'function');
  assert.equal(typeof runtime.inboxRepository.claimPendingInbound, 'function');
  assert.equal(typeof runtime.conversationRepository.getOrCreate, 'function');
  assert.equal(typeof runtime.outboxRepository.claimPendingOutbound, 'function');
  assert.equal(typeof runtime.inboxProcessor.processOne, 'function');
  assert.equal(typeof runtime.outboxWorker.processOne, 'function');
  assert.equal(typeof runtime.application.processCycle, 'function');
});

test('runtime composition permits an explicit test knowledge provider override', () => {
  const db = { query() {}, transaction() {} };
  const knowledgeProvider = async () => [];
  const whatsappProvider = { sendText: async () => ({ provider_message_id: 'p1' }), sendAttachment: async () => ({ provider_message_id: 'p2' }) };
  const runtime = createRuntimeComposition({ db, knowledgeProvider, whatsappProvider, workerId: 'worker-1' });

  assert.equal(runtime.knowledgeProvider, knowledgeProvider);
});
