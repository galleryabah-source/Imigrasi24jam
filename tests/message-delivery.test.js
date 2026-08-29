import test from 'node:test';
import assert from 'node:assert/strict';
import { createInboundMessage, createOutboundMessage, nextDeliveryState } from '../src/core/message-delivery.js';

test('inbound message requires provider identity', () => {
  const m = createInboundMessage({ provider:'whatsapp', providerMessageId:'WA-1', conversationId:'C1', sender:'U1', text:'Halo' });
  assert.equal(m.status, 'RECEIVED');
});

test('outbound starts pending', () => {
  const m = createOutboundMessage({ conversationId:'C1', replyToMessageId:'WA-1', text:'Jawaban' });
  assert.equal(m.delivery_state, 'PENDING');
  assert.equal(m.attempt_count, 0);
});

test('delivery state transitions are bounded', () => {
  assert.equal(nextDeliveryState('PENDING','SEND'), 'PROCESSING');
  assert.equal(nextDeliveryState('PROCESSING','SUCCESS'), 'SENT');
  assert.equal(nextDeliveryState('PROCESSING','FAILURE'), 'RETRY');
  assert.equal(nextDeliveryState('RETRY','GIVE_UP'), 'FAILED');
  assert.throws(() => nextDeliveryState('SENT','SEND'), /INVALID_DELIVERY_TRANSITION/);
});
