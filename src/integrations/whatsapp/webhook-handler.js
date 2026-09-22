import { canonicalizeWhatsAppMessage } from './canonical-message.js';

export async function handleWhatsAppWebhook({ rawBody, signature, timestamp, verifySignature, replayStore, inboxTransaction }) {
  if (typeof rawBody !== 'string') throw new Error('RAW_BODY_REQUIRED');
  if (typeof verifySignature !== 'function') throw new Error('SIGNATURE_VERIFIER_REQUIRED');
  if (!verifySignature(rawBody, signature, timestamp)) return Object.freeze({ status: 401, accepted: false, reason: 'INVALID_SIGNATURE' });
  const replayKey = `${timestamp}:${signature}`;
  const canonical = canonicalizeWhatsAppMessage(JSON.parse(rawBody));
  const result = await inboxTransaction.ingest({
    provider: canonical.provider,
    providerMessageId: canonical.messageId,
    conversationId: canonical.conversationId,
    sender: canonical.sender,
    payload: canonical,
    replayKey
  });
  return Object.freeze({ status: 200, accepted: result.accepted, duplicate: !result.accepted, inboxId: result.inboxId ?? null });
}
