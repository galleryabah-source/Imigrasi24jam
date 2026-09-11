import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePublicWhatsAppAttachment } from '../src/integrations/whatsapp/quarantine-relevance-gate.js';

const baseDocument = Object.freeze({
  accessClassification: 'PUBLIC',
  status: 'PUBLISHED',
  allowWhatsAppAttachment: true,
  title: 'Persyaratan paspor baru',
  description: 'Dokumen resmi layanan paspor Imigrasi',
  topic: 'Paspor'
});

test('admits public approved immigration-relevant attachment', () => {
  assert.deepEqual(evaluatePublicWhatsAppAttachment({ document: baseDocument, context: 'persyaratan paspor' }), {
    decision: 'ADMIT',
    reason: 'PUBLIC_APPROVED_RELEVANT'
  });
});

test('quarantines private or internal documents', () => {
  const result = evaluatePublicWhatsAppAttachment({ document: { ...baseDocument, accessClassification: 'PRIVATE / INTERNAL' } });
  assert.deepEqual(result, { decision: 'QUARANTINE', reason: 'NON_PUBLIC_ACCESS' });
});

test('quarantines restricted documents by default', () => {
  const result = evaluatePublicWhatsAppAttachment({ document: { ...baseDocument, accessClassification: 'RESTRICTED' } });
  assert.deepEqual(result, { decision: 'QUARANTINE', reason: 'NON_PUBLIC_ACCESS' });
});

test('quarantines draft documents', () => {
  const result = evaluatePublicWhatsAppAttachment({ document: { ...baseDocument, status: 'DRAFT' } });
  assert.deepEqual(result, { decision: 'QUARANTINE', reason: 'NOT_APPROVED_OR_PUBLISHED' });
});

test('quarantines documents without explicit WhatsApp permission', () => {
  const result = evaluatePublicWhatsAppAttachment({ document: { ...baseDocument, allowWhatsAppAttachment: false } });
  assert.deepEqual(result, { decision: 'QUARANTINE', reason: 'WHATSAPP_ATTACHMENT_NOT_ALLOWED' });
});

test('quarantines documents unrelated to immigration context', () => {
  const result = evaluatePublicWhatsAppAttachment({
    document: { ...baseDocument, title: 'Resep memasak', description: 'Panduan makanan rumahan', topic: 'Kuliner' },
    context: 'cara memasak nasi'
  });
  assert.deepEqual(result, { decision: 'QUARANTINE', reason: 'IMMIGRATION_RELEVANCE_REQUIRED' });
});
