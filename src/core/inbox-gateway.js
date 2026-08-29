export async function ingestCanonicalMessage({ repository, message, provider }) {
  if (!repository || typeof repository.insertInbound !== 'function') throw new Error('INBOX_REPOSITORY_REQUIRED');
  if (!provider || typeof provider.acceptWebhook !== 'function') throw new Error('PROVIDER_ADAPTER_REQUIRED');
  const result = await repository.insertInbound(message);
  return Object.freeze({
    accepted: true,
    duplicate: Boolean(result?.duplicate),
    messageId: result?.messageId ?? message.providerMessageId
  });
}
