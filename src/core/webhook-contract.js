const MESSAGE_TYPES = new Set(['text','image','document','audio','video','location','interactive','unknown']);

export function validateWebhookRequest({ rawBody, signature, timestamp, secret, nowMs = Date.now(), toleranceSeconds = 300 }) {
  if (typeof rawBody !== 'string' || !rawBody.length) return { ok:false, code:'EMPTY_BODY' };
  if (typeof signature !== 'string' || !signature.length) return { ok:false, code:'MISSING_SIGNATURE' };
  if (!Number.isFinite(Number(timestamp))) return { ok:false, code:'INVALID_TIMESTAMP' };
  if (!secret) return { ok:false, code:'VERIFICATION_NOT_CONFIGURED' };
  const age = Math.abs(nowMs - Number(timestamp) * 1000);
  if (age > toleranceSeconds * 1000) return { ok:false, code:'REPLAY_WINDOW_EXCEEDED' };
  return { ok:true, rawBody, signature, timestamp:Number(timestamp) };
}

export function normalizeInboundMessage(input = {}) {
  const provider = String(input.provider ?? '').trim();
  const providerMessageId = String(input.providerMessageId ?? '').trim();
  const conversationId = String(input.conversationId ?? '').trim();
  const sender = String(input.sender ?? '').trim();
  const messageType = MESSAGE_TYPES.has(input.messageType) ? input.messageType : 'unknown';
  if (!provider || !providerMessageId || !conversationId || !sender) throw new Error('INVALID_CANONICAL_MESSAGE_IDENTITY');
  return Object.freeze({ provider, providerMessageId, conversationId, sender, messageType, text: typeof input.text === 'string' ? input.text : null, attachments: Array.isArray(input.attachments) ? input.attachments : [], receivedAt: input.receivedAt ?? new Date().toISOString(), rawMetadata: input.rawMetadata ?? null });
}
