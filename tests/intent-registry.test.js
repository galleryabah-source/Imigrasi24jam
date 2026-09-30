import test from 'node:test';
import assert from 'node:assert/strict';
import { INTENTS, classifyIntent } from '../src/core/intent-registry.js';

test('classifies passport creation deterministically', () => {
  const result = classifyIntent('syarat membuat paspor baru');
  assert.equal(result.intent, INTENTS.PASSPORT_NEW);
  assert.ok(result.confidence >= 0.9);
});

test('classifies lost passport deterministically', () => {
  assert.equal(classifyIntent('paspor saya hilang').intent, INTENTS.PASSPORT_LOST);
});

test('classifies immigration violation reports separately from complaints', () => {
  assert.equal(classifyIntent('saya ingin lapor pelanggaran wna').intent, INTENTS.IMMIGRATION_VIOLATION_REPORT);
});

test('rejects unrelated content at intent layer', () => {
  assert.equal(classifyIntent('tolong buatkan resep kue').intent, INTENTS.OUT_OF_DOMAIN);
});

test('flags overlapping immigration intents as ambiguous', () => {
  assert.equal(classifyIntent('petugas imigrasi dan kantor imigrasi').intent, INTENTS.AMBIGUOUS);
});
