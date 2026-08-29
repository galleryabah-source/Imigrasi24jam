import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateMessage } from '../src/core/message-orchestrator.js';

const knowledge = [{ id:'K1', intent:'PASSPORT', status:'PUBLISHED', effective_from:'2026-01-01', sub_intent:null, question_patterns:['syarat paspor'], direct_answer:'Informasi persyaratan paspor.' }];
const evidence = { K1:[{ id:'E1', status:'VERIFIED', document_id:'D1', document_version_id:'DV1', source_id:'S1' }] };

test('orchestrator answers from local knowledge with AI unavailable', async () => {
  const result = await orchestrateMessage({ message:{ conversationId:'C1', from:'U1', text:'Apa syarat paspor?' }, knowledge, evidenceByKnowledgeId:evidence, now:'2026-08-29T00:00:00Z' });
  assert.equal(result.status, 'ANSWER');
  assert.equal(result.safety.provider_used, false);
});

test('out-of-scope message never reaches retrieval', async () => {
  const result = await orchestrateMessage({ message:{ conversationId:'C2', from:'U2', text:'Jelaskan resep makanan.' }, knowledge, evidenceByKnowledgeId:evidence });
  assert.equal(result.status, 'OUT_OF_SCOPE');
});

test('low-confidence immigration wording asks for clarification', async () => {
  const result = await orchestrateMessage({ message:{ conversationId:'C3', from:'U3', text:'Saya mau urus.' }, knowledge, evidenceByKnowledgeId:evidence });
  assert.equal(result.status, 'CLARIFICATION');
});

test('missing evidence cannot become public answer', async () => {
  const result = await orchestrateMessage({ message:{ conversationId:'C4', from:'U4', text:'syarat paspor' }, knowledge, evidenceByKnowledgeId:{}, now:'2026-08-29T00:00:00Z' });
  assert.notEqual(result.status, 'ANSWER');
});
