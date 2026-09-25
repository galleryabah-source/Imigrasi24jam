export async function claimAndProcessInbound(db, { provider, providerMessageId, conversationId, sender, payload, correlationId = providerMessageId }, process) {
  if (!db || typeof db.transaction !== 'function') throw new Error('TRANSACTION_REQUIRED');
  if (typeof process !== 'function') throw new Error('PROCESSOR_REQUIRED');

  return db.transaction(async (tx) => {
    const inserted = await tx.query(`
      INSERT INTO message_inbox (provider, provider_message_id, conversation_id, sender, payload_json, processing_status)
      VALUES ($1,$2,$3,$4,$5,'PROCESSING')
      ON CONFLICT (provider, provider_message_id) DO NOTHING
      RETURNING id, conversation_id, provider_message_id
    `, [provider, providerMessageId, conversationId, sender, payload ?? {}]);

    if (!inserted.rows.length) {
      if (typeof process.onDuplicate === 'function') await process.onDuplicate({ provider, providerMessageId, conversationId, correlationId });
      return Object.freeze({ status: 'DUPLICATE', created: false });
    }

    const inbound = inserted.rows[0];
    const outboundPayload = await process(inbound, { correlationId });
    const outbound = await tx.query(`
      INSERT INTO message_outbox (conversation_id, reply_to_message_id, provider, payload_json)
      VALUES ($1,$2,$3,$4)
      RETURNING id, delivery_state
    `, [inbound.conversation_id, inbound.id, provider, outboundPayload ?? {}]);

    await tx.query(`UPDATE message_inbox SET processing_status='PROCESSED', processed_at=now() WHERE id=$1`, [inbound.id]);
    return Object.freeze({ status: 'PROCESSED', created: true, inbound_id: inbound.id, outbox_id: outbound.rows[0].id });
  });
}
