export const DELIVERY_STATES = Object.freeze(['PENDING','PROCESSING','SENT','RETRY','FAILED']);

export function createInboundMessage({ provider, providerMessageId, conversationId, sender, text, receivedAt = new Date().toISOString() }) {
  if (!provider || !providerMessageId || !conversationId || !sender) throw new Error('INBOUND_MESSAGE_IDENTITY_REQUIRED');
  return Object.freeze({ provider, provider_message_id: providerMessageId, conversation_id: conversationId, sender, text: String(text ?? ''), received_at: receivedAt, status: 'RECEIVED' });
}

export function createOutboundMessage({ conversationId, replyToMessageId, text, attachments = [] }) {
  if (!conversationId || !replyToMessageId || !String(text ?? '').trim()) throw new Error('OUTBOUND_MESSAGE_REQUIRED');
  return Object.freeze({ conversation_id: conversationId, reply_to_message_id: replyToMessageId, text: String(text).trim(), attachments: Array.isArray(attachments) ? attachments : [], delivery_state: 'PENDING', attempt_count: 0 });
}

export function nextDeliveryState(current, event) {
  const transitions = {
    PENDING: { SEND: 'PROCESSING', RETRY: 'RETRY' },
    PROCESSING: { SUCCESS: 'SENT', FAILURE: 'RETRY' },
    RETRY: { SEND: 'PROCESSING', GIVE_UP: 'FAILED' }
  };
  const next = transitions[current]?.[event];
  if (!next) throw new Error('INVALID_DELIVERY_TRANSITION');
  return next;
}
