import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeComposition } from '../src/core/runtime-composition.js';

test('runtime composition requires all durable machine dependencies', () => {
  assert.throws(() => createRuntimeComposition(), /RUNTIME_DATABASE_REQUIRED/);
  assert.throws(() => createRuntimeComposition({ db: { query() {}, transaction() {} } }), /RUNTIME_KNOWLEDGE_PROVIDER_REQUIRED/);
  assert.throws(() => createRuntimeComposition({ db: { query() {}, transaction() {} }, knowledgeProvider: async () => [], workerId: 'w1' }), /RUNTIME_WHATSAPP_PROVIDER_REQUIRED/);
});

test('runtime composition wires one durable inbox, conversation and outbox machine', () => {
  const db = { query() {}, transaction() {} };
  const whatsappProvider = { sendText: async () => ({ provider_message_id: 'p1' }), sendAttachment: async () => ({ provider_message_id: 'p2' }) };
  const runtime = createRuntimeComposition({ db, knowledgeProvider: async () => [], whatsappProvider, workerId: 'worker-1' });

  assert.equal(typeof runtime.inboxRepository.claimPendingInbound, 'function');
  assert.equal(typeof runtime.conversationRepository.getOrCreate, 'function');
  assert.equal(typeof runtime.outboxRepository.claimPendingOutbound, 'function');
  assert.equal(typeof runtime.inboxProcessor.processOne, 'function');
  assert.equal(typeof runtime.outboxWorker.processOne, 'function');
  assert.equal(typeof runtime.application.processCycle, 'function');
});
