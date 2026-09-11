/**
 * Provider-agnostic WhatsApp transport contract.
 * No provider credentials or vendor-specific business logic belong here.
 */

function requireIdempotencyKey(message) {
  const key = message?.options?.idempotency_key;
  if (typeof key !== 'string' || key.length < 1 || key.length > 200) {
    throw new Error('WHATSAPP_IDEMPOTENCY_KEY_REQUIRED');
  }
  return key;
}

export function createWhatsAppProviderContract(adapter) {
  const required = ['verifyWebhook', 'parseInbound', 'sendText', 'sendAttachment', 'parseDeliveryStatus'];
  for (const method of required) {
    if (!adapter || typeof adapter[method] !== 'function') {
      throw new Error(`WHATSAPP_ADAPTER_METHOD_REQUIRED:${method}`);
    }
  }

  return Object.freeze({
    async verifyWebhook(request) {
      return adapter.verifyWebhook(request);
    },
    async parseInbound(request) {
      return adapter.parseInbound(request);
    },
    async sendText(message) {
      requireIdempotencyKey(message);
      return adapter.sendText(message);
    },
    async sendAttachment(message) {
      requireIdempotencyKey(message);
      return adapter.sendAttachment(message);
    },
    async parseDeliveryStatus(request) {
      return adapter.parseDeliveryStatus(request);
    }
  });
}
