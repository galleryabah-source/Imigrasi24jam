export async function processInboundToOutbox({ adapter, request, inbox, conversation, outbox }) {
  const accepted = await adapter.acceptWebhook(request);
  if (!accepted.accepted) return Object.freeze({ accepted:false, code:accepted.code });

  const results = [];
  for (const message of accepted.messages) {
    const stored = await inbox.insertInbound(message);
    if (stored?.duplicate) {
      results.push({ providerMessageId:message.providerMessageId, duplicate:true });
      continue;
    }

    const answer = await conversation.handle(message);
    if (!answer || typeof answer.text !== 'string') throw new Error('CONVERSATION_DID_NOT_RETURN_TEXT');

    const queued = await outbox.enqueueText({
      conversationId: message.conversationId,
      recipient: message.sender,
      text: answer.text,
      sourceMessageId: stored.messageId ?? message.providerMessageId
    });
    results.push({ providerMessageId:message.providerMessageId, duplicate:false, queued });
  }
  return Object.freeze({ accepted:true, results });
}
