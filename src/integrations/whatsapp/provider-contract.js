/**
 * Provider-agnostic WhatsApp transport contract.
 * No provider credentials or vendor-specific business logic belong here.
 */

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
      return adapter.sendText(message);
    },
    async sendAttachment(message) {
      return adapter.sendAttachment(message);
    },
    async parseDeliveryStatus(request) {
      return adapter.parseDeliveryStatus(request);
    }
  });
}
