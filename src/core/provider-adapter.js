export function createProviderAdapter({ verify, parseInbound, sendText, sendAttachment }) {
  if (typeof verify !== 'function') throw new Error('PROVIDER_VERIFY_REQUIRED');
  if (typeof parseInbound !== 'function') throw new Error('PROVIDER_PARSE_REQUIRED');
  if (typeof sendText !== 'function') throw new Error('PROVIDER_SEND_TEXT_REQUIRED');
  if (typeof sendAttachment !== 'function') throw new Error('PROVIDER_SEND_ATTACHMENT_REQUIRED');
  return Object.freeze({ verify, parseInbound, sendText, sendAttachment });
}

export async function acceptWebhook(adapter, request) {
  const verified = await adapter.verify(request);
  if (!verified) return Object.freeze({ accepted:false, code:'WEBHOOK_VERIFICATION_FAILED' });
  const messages = await adapter.parseInbound(request);
  if (!Array.isArray(messages)) return Object.freeze({ accepted:false, code:'INVALID_PROVIDER_NORMALIZATION' });
  return Object.freeze({ accepted:true, messages });
}
