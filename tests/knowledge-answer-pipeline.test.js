import test from 'node:test';
import assert from 'node:assert/strict';
import { answerFromKnowledge } from '../src/core/knowledge-answer-pipeline.js';

const knowledge = {
  id:'K1', status:'PUBLISHED', intent:'PASSPORT', sub_intent:null,
  effective_from:'2026-01-01T00:00:00Z', effective_until:null,
  question_patterns:['cara membuat paspor'],
  direct_answer:'Permohonan paspor dilakukan melalui layanan resmi yang berlaku.',
  verified_evidence:[{ id:'E1', status:'VERIFIED' }]
};

test('knowledge pipeline answers from published effective verified knowledge', () => {
  const result = answerFromKnowledge({ text:'bagaimana cara membuat paspor', intent:'PASSPORT', candidates:[knowledge], at:'2026-08-29T00:00:00Z' });
  assert.equal(result.status,'ANSWERED');
  assert.deepEqual(result.evidenceIds,['E1']);
});

test('knowledge pipeline refuses out-of-domain question', () => {
  const result = answerFromKnowledge({ text:'resep nasi goreng', intent:'PASSPORT', candidates:[knowledge] });
  assert.equal(result.status,'OUT_OF_SCOPE');
});

test('knowledge pipeline escalates when no effective verified match exists', () => {
  const result = answerFromKnowledge({ text:'cara membuat paspor', intent:'PASSPORT', candidates:[{...knowledge, effective_until:'2026-01-01T00:00:00Z'}] });
  assert.equal(result.status,'ESCALATE');
});
