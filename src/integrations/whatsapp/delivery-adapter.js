import { createWhatsAppProviderContract } from './provider-contract.js';

function normalizeDeliveryResult(result, idempotencyKey) {
  const providerMessageId = result?.provider_message_id ?? result?.message_id ?? null;
  const returnedKey = result?.idempotency_key ?? idempotencyKey ?? null;
  if (!providerMessageId && !returnedKey) throw new Error('PROVIDER_DELIVERY_IDENTITY_REQUIRED');
  return Object.freeze({
    provider_message_id: providerMessageId,
    idempotency_key: returnedKey
  });
}

/**
 * Single delivery seam between the canonical outbox worker and the
 * provider-specific WhatsApp contract. The worker never calls sendText /
 * sendAttachment directly and the provider adapter never owns outbox state.
 */
export function createWhatsAppDeliveryAdapter(adapter) {
  const contract = createWhatsAppProviderContract(adapter);

  return Object.freeze({
    async send(payload = {}) {
      const idempotencyKey = payload.idempotency_key ?? null;
      const message = { ...payload };
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      delete message.attachments;

      if (attachments.length > 0) {
        if (attachments.length !== 1) throw new Error('WHATSAPP_ATTACHMENT_CARDINALITY_UNSUPPORTED');
        return normalizeDeliveryResult(
          await contract.sendAttachment({ ...message, attachment: attachments[0] }),
          idempotencyKey
        );
      }

      return normalizeDeliveryResult(await contract.sendText(message), idempotencyKey);
    },

    async parseDeliveryStatus(request) {
      return contract.parseDeliveryStatus(request);
    }
  });
}
