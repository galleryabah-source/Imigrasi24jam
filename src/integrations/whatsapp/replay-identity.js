import { createHash } from 'node:crypto';

export function createWhatsAppReplayIdentity({ provider = 'whatsapp', messageId }) {
  const normalizedProvider = String(provider).trim().toLowerCase();
  const normalizedMessageId = String(messageId ?? '').trim();
  if (!normalizedMessageId) throw new Error('REPLAY_MESSAGE_ID_REQUIRED');
  const canonical = `${normalizedProvider}:${normalizedMessageId}`;
  return createHash('sha256').update(canonical).digest('hex');
}
