import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { createInboxOutboxRepository } from '../src/core/inbox-outbox-repository.js';

const { Client } = pg;
const url = process.env.DATABASE_URL;

function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function connect() {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

test('real PostgreSQL webhook admission is atomic across inbox and replay', { skip: !url }, async () => {
  const cleanup = await connect();
  const replayKey = 'atomic-webhook-replay-key';
  const replayHash = hash(replayKey);
  const providerMessageIds = Array.from({ length: 10 }, (_, index) => `atomic-message-${index}`);
  try {
    await cleanup.query('DELETE FROM message_inbox WHERE provider = $1 AND provider_message_id = ANY($2)', ['whatsapp', providerMessageIds]);
    await cleanup.query('DELETE FROM webhook_replay WHERE key_hash = $1', [replayHash]);
  } finally {
    await cleanup.end();
  }

  const clients = await Promise.all(providerMessageIds.map(() => connect()));
  try {
    const results = await Promise.all(clients.map((client, index) => createInboxOutboxRepository(client).claimInboundWithReplay({
      provider: 'whatsapp',
      providerMessageId: providerMessageIds[index],
      conversationId: 'conversation-atomic-test',
      sender: 'sender-atomic-test',
      payload: { messageId: providerMessageIds[index] },
      replayKey,
      ttlSeconds: 300
    })));

    assert.equal(results.filter((result) => result.accepted).length, 1);
    assert.equal(results.filter((result) => !result.accepted).length, 9);

    const winner = results.find((result) => result.accepted);
    const state = await clients[0].query('SELECT count(*)::int AS count FROM message_inbox WHERE provider = $1 AND provider_message_id = ANY($2)', ['whatsapp', providerMessageIds]);
    const replay = await clients[0].query('SELECT count(*)::int AS count FROM webhook_replay WHERE key_hash = $1', [replayHash]);
    assert.equal(state.rows[0].count, 1);
    assert.equal(replay.rows[0].count, 1);
    assert.equal(winner?.inboxId ? 1 : 0, 1);
  } finally {
    await Promise.all(clients.map((client) => client.end()));
  }
});

test('real PostgreSQL duplicate webhook is rejected by inbox identity without consuming another replay row', { skip: !url }, async () => {
  const client = await connect();
  const providerMessageId = 'duplicate-webhook-message';
  const replayKey = 'duplicate-webhook-replay-key';
  const replayHash = hash(replayKey);
  try {
    await client.query('DELETE FROM message_inbox WHERE provider = $1 AND provider_message_id = $2', ['whatsapp', providerMessageId]);
    await client.query('DELETE FROM webhook_replay WHERE key_hash = $1', [replayHash]);
    const repository = createInboxOutboxRepository(client);

    const first = await repository.claimInboundWithReplay({
      provider: 'whatsapp', providerMessageId, conversationId: 'conversation-duplicate-test',
      sender: 'sender-duplicate-test', payload: { messageId: providerMessageId }, replayKey, ttlSeconds: 300
    });
    const second = await repository.claimInboundWithReplay({
      provider: 'whatsapp', providerMessageId, conversationId: 'conversation-duplicate-test',
      sender: 'sender-duplicate-test', payload: { messageId: providerMessageId }, replayKey, ttlSeconds: 300
    });

    assert.equal(first.accepted, true);
    assert.equal(second.accepted, false);
    assert.equal(second.reason, 'DUPLICATE_INBOX');
    const inbox = await client.query('SELECT count(*)::int AS count FROM message_inbox WHERE provider = $1 AND provider_message_id = $2', ['whatsapp', providerMessageId]);
    const replay = await client.query('SELECT count(*)::int AS count FROM webhook_replay WHERE key_hash = $1', [replayHash]);
    assert.equal(inbox.rows[0].count, 1);
    assert.equal(replay.rows[0].count, 1);
  } finally {
    await client.query('DELETE FROM message_inbox WHERE provider = $1 AND provider_message_id = $2', ['whatsapp', providerMessageId]);
    await client.query('DELETE FROM webhook_replay WHERE key_hash = $1', [replayHash]);
    await client.end();
  }
});
