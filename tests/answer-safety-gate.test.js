import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnswerSafety } from '../src/core/answer-safety-gate.js';

test('verified sourced answer can pass safety gate', () => {
  const result = evaluateAnswerSafety({ intent: 'PASSPORT_NEW', answer: 'Informasi layanan paspor.', sources: [{ id: 'S1', status: 'VERIFIED' }], confidence: 0.9, providerAvailable: false, knowledge:{status:'PUBLISHED'} });
  assert.equal(result.decision, 'ANSWER');
  assert.equal(result.provider_used, false);
});

test('unverified source cannot pass safety gate even with high confidence', () => {
  const result = evaluateAnswerSafety({ intent: 'PASSPORT_NEW', answer: 'Informasi layanan paspor.', sources: [{ id: 'S1', status: 'REVIEW' }], confidence: 0.99, providerAvailable: false, knowledge:{status:'PUBLISHED'} });
  assert.equal(result.decision, 'SAFE_FALLBACK');
  assert.ok(result.reasons.includes('NO_VERIFIED_SOURCE'));
});

test('AI availability does not bypass safety rules', () => {
  const result = evaluateAnswerSafety({ intent: 'PASSPORT_NEW', answer: 'Informasi.', sources: [], confidence: 0.99, providerAvailable: true });
  assert.equal(result.decision, 'SAFE_FALLBACK');
  assert.equal(result.requires_human_review, true);
});

test('out-of-scope intent is blocked', () => {
  const result = evaluateAnswerSafety({ intent: 'OUT_OF_SCOPE_GENERAL', answer: 'Jawaban.', sources: [{ id: 'S1', status: 'VERIFIED' }], confidence: 0.99 });
  assert.equal(result.decision, 'SAFE_FALLBACK');
});

test('private and invalid attachments are never allowed for WhatsApp', () => {
  const result = evaluateAnswerSafety({ intent:'PASSPORT_NEW', answer:'Informasi.', sources:[{id:'S1',status:'VERIFIED'}], confidence:0.9, knowledge:{status:'PUBLISHED'}, attachments:[
    {id:'OK',status:'PUBLISHED',visibility:'PUBLIC',allowWhatsAppAttachment:true,valid:true,immigrationRelevant:true},
    {id:'PRIVATE',status:'PUBLISHED',visibility:'PRIVATE',allowWhatsAppAttachment:true,valid:true,immigrationRelevant:true},
    {id:'BAD',status:'PUBLISHED',visibility:'PUBLIC',allowWhatsAppAttachment:true,valid:false,immigrationRelevant:true}
  ]});
  assert.deepEqual(result.attachments.map(a=>a.id), ['OK']);
  assert.deepEqual(result.blocked_attachment_ids.sort(), ['BAD','PRIVATE']);
});

test('unpublished knowledge cannot pass', () => {
  const result = evaluateAnswerSafety({ intent:'PASSPORT_NEW', answer:'Informasi.', sources:[{id:'S1',status:'VERIFIED'}], confidence:0.9, knowledge:{status:'DRAFT'} });
  assert.equal(result.decision, 'SAFE_FALLBACK');
});
