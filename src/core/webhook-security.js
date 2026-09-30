import crypto from 'node:crypto';

export function computeHmacSha256(secret, rawBody) {
  if (!secret) throw new Error('WEBHOOK_SECRET_REQUIRED');
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aa = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function validateWebhookSignature({ secret, rawBody, signature }) {
  if (!rawBody || !signature) return false;
  const normalized = signature.replace(/^sha256=/i, '');
  return timingSafeEqualHex(computeHmacSha256(secret, rawBody), normalized);
}

export function validateReplayTimestamp(timestamp, { nowMs = Date.now(), toleranceMs = 5 * 60 * 1000 } = {}) {
  const t = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp);
  if (!Number.isFinite(t)) return false;
  const timestampMs = typeof timestamp === 'number' && timestamp < 1e12 ? timestamp * 1000 : t;
  return Math.abs(nowMs - timestampMs) <= toleranceMs;
}

export function normalizeInboundWebhook({ provider, payload }) {
  const message = payload?.message ?? payload;
  const providerMessageId = message?.id;
  const sender = message?.from;
  if (!provider || !providerMessageId || !sender) throw new Error('INVALID_WEBHOOK_MESSAGE');
  return Object.freeze({
    provider,
    providerMessageId: String(providerMessageId),
    conversationId: String(message.conversation_id ?? sender),
    sender: String(sender),
    messageType: String(message.type ?? 'text'),
    text: typeof message.text === 'string' ? message.text : '',
    attachments: Array.isArray(message.attachments) ? message.attachments : [],
    receivedAt: new Date().toISOString(),
    rawMetadata: payload
  });
}
