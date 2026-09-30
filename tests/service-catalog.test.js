import test from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_CATALOG, getServiceByCode, getServiceForIntent, assertKnownImmigrationService } from '../src/core/service-catalog.js';

test('service catalog is immutable and immigration scoped', () => {
  assert.ok(SERVICE_CATALOG.length > 0);
  assert.ok(SERVICE_CATALOG.every((service) => service.domain === 'IMMIGRATION'));
  assert.ok(SERVICE_CATALOG.every((service) => service.authority === 'OFFICIAL_IMMIGRATION_SOURCE'));
});

test('passport intent resolves to passport service', () => {
  assert.equal(getServiceForIntent('PASSPORT_NEW').code, 'PASSPORT');
});

test('sensitive workflows require human review', () => {
  assert.equal(getServiceByCode('IMMIGRATION_VIOLATION_REPORT').requiresHumanReview, true);
  assert.equal(getServiceByCode('IMMIGRATION_COMPLAINT').requiresHumanReview, true);
});

test('unknown service is rejected', () => {
  assert.throws(() => assertKnownImmigrationService('GENERAL_CHAT'), /UNKNOWN_IMMIGRATION_SERVICE/);
});
