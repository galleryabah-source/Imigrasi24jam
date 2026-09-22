const TYPES = Object.freeze(['text', 'image', 'document', 'audio', 'video', 'unknown']);

export function canonicalizeWhatsAppMessage(input) {
  if (!input || typeof input !== 'object') throw new Error('WHATSAPP_MESSAGE_REQUIRED');
  const provider = String(input.provider ?? 'whatsapp').trim().toLowerCase();
  const messageId = String(input.messageId ?? input.id ?? '').trim();
  const conversationId = String(input.conversationId ?? input.from ?? '').trim();
  const sender = String(input.sender ?? input.from ?? '').trim();
  const type = String(input.type ?? 'unknown').trim().toLowerCase();
  if (!messageId || !conversationId || !sender) throw new Error('CANONICAL_MESSAGE_FIELDS_REQUIRED');
  return Object.freeze({
    provider,
    messageId,
    conversationId,
    sender,
    type: TYPES.includes(type) ? type : 'unknown',
    text: typeof input.text === 'string' ? input.text.trim() : '',
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    raw: input.raw ?? input
  });
}
