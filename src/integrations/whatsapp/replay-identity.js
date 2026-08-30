import { createHash } from 'node:crypto';

export function createWhatsAppReplayIdentity({ provider = 'whatsapp', messageId, timestamp }) {
  const normalizedProvider = String(provider).trim().toLowerCase();
  const normalizedMessageId = String(messageId ?? '').trim();
  const normalizedTimestamp = String(timestamp ?? '').trim();
  if (!normalizedMessageId) throw new Error('REPLAY_MESSAGE_ID_REQUIRED');
  if (!normalizedTimestamp) throw new Error('REPLAY_TIMESTAMP_REQUIRED');
  const canonical = `${normalizedProvider}:${normalizedMessageId}:${normalizedTimestamp}`;
  return createHash('sha256').update(canonical).digest('hex');
}
