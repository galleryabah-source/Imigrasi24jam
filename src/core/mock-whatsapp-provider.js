import crypto from 'node:crypto';
import { computeHmacSha256, validateReplayTimestamp } from './webhook-security.js';
import { normalizeInboundMessage } from './webhook-contract.js';
import { createProviderAdapter } from './provider-adapter.js';

export function createMockWhatsAppProvider({ secret, clock = () => Date.now() }) {
  if (!secret) throw new Error('MOCK_PROVIDER_SECRET_REQUIRED');
  return createProviderAdapter({
    verify: async ({ rawBody, signature, timestamp }) => {
      if (!validateReplayTimestamp(Number(timestamp), { nowMs: clock() })) return false;
      return computeHmacSha256(secret, rawBody) === String(signature).replace(/^sha256=/i, '');
    },
    parseInbound: async ({ payload }) => {
      const source = payload?.messages ?? [];
      return source.map((m) => normalizeInboundMessage({
        provider: 'mock-whatsapp',
        providerMessageId: m.id,
        conversationId: m.conversation_id ?? m.from,
        sender: m.from,
        messageType: m.type ?? 'text',
        text: m.text,
        attachments: m.attachments,
        receivedAt: m.received_at,
        rawMetadata: payload
      }));
    },
    sendText: async ({ to, text }) => ({ ok: true, provider: 'mock-whatsapp', to, text, messageId: crypto.randomUUID() }),
    sendAttachment: async ({ to, attachment }) => ({ ok: true, provider: 'mock-whatsapp', to, attachment, messageId: crypto.randomUUID() })
  });
}
