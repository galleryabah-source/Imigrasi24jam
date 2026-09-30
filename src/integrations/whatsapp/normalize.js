const text = value => typeof value === 'string' ? value.trim() : '';

export function normalizeWhatsAppInbound(input) {
  if (!input || typeof input !== 'object') throw new Error('INVALID_PROVIDER_PAYLOAD');
  const provider = text(input.provider);
  const messageId = text(input.messageId);
  const senderId = text(input.senderId);
  const timestamp = Number(input.timestamp);
  const messageType = text(input.messageType) || 'text';
  if (!provider || !messageId || !senderId || !Number.isFinite(timestamp)) throw new Error('INVALID_CANONICAL_MESSAGE');
  const allowed = new Set(['text', 'image', 'document', 'audio', 'video', 'unknown']);
  if (!allowed.has(messageType)) throw new Error('UNSUPPORTED_MESSAGE_TYPE');
  const media = input.media && typeof input.media === 'object' ? {
    mediaId: text(input.media.mediaId) || null,
    mimeType: text(input.media.mimeType) || null,
    filename: text(input.media.filename) || null,
    sha256: text(input.media.sha256) || null
  } : null;
  return Object.freeze({
    provider,
    providerMessageId: messageId,
    senderId,
    timestamp,
    messageType,
    text: text(input.text) || null,
    media: media ? Object.freeze(media) : null
  });
}
