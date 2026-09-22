import { canonicalizeWhatsAppMessage } from './canonical-message.js';
import { createWhatsAppReplayIdentity } from './replay-identity.js';

export async function processWhatsAppWebhook({ rawBody, signature, timestampSeconds, securityGate, inboxTransaction }) {
  if (typeof rawBody !== 'string') return Object.freeze({ status: 400, accepted: false, reason: 'RAW_BODY_REQUIRED' });
  if (!securityGate?.verify) throw new Error('SECURITY_GATE_REQUIRED');
  if (!inboxTransaction?.ingest) throw new Error('INBOX_TRANSACTION_REQUIRED');
  if (!securityGate.verify({ rawBody, signature, timestampSeconds })) return Object.freeze({ status: 401, accepted: false, reason: 'WEBHOOK_SECURITY_REJECTED' });

  let parsed;
  try { parsed = JSON.parse(rawBody); } catch { return Object.freeze({ status: 400, accepted: false, reason: 'INVALID_JSON' }); }

  const message = canonicalizeWhatsAppMessage(parsed);
  const replayKey = createWhatsAppReplayIdentity({ provider: message.provider, messageId: message.messageId, timestamp: timestampSeconds });
  const result = await inboxTransaction.ingest({
    provider: message.provider,
    providerMessageId: message.messageId,
    conversationId: message.conversationId,
    sender: message.sender,
    payload: message,
    replayKey
  });

  return Object.freeze({ status: 200, accepted: result.accepted, duplicate: !result.accepted, inboxId: result.inboxId ?? null });
}
