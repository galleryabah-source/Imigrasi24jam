import { createWebhookSecurityGate } from '../../src/integrations/whatsapp/webhook-security.js';
import { processWhatsAppWebhook } from '../../src/integrations/whatsapp/webhook-pipeline.js';
import { createInboxOutboxRepository } from '../../src/core/inbox-outbox-repository.js';
import { createPostgresAdapter } from '../../src/db/postgres-adapter.js';

let inboxTransaction;

function getInboxTransaction() {
  if (inboxTransaction) return inboxTransaction;
  const db = createPostgresAdapter();
  const repository = createInboxOutboxRepository(db);
  inboxTransaction = Object.freeze({
    ingest: async ({ provider, providerMessageId, conversationId, sender, payload }) => {
      const row = await repository.claimInbound({
        provider,
        providerMessageId,
        conversationId,
        sender,
        payload
      });
      return { accepted: Boolean(row), inboxId: row?.id ?? null };
    }
  });
  return inboxTransaction;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'webhook_not_configured' });

  const rawBody = await readBody(req);
  const securityGate = createWebhookSecurityGate({ secret });
  const signature = req.headers['x-signature'];
  const timestampSeconds = req.headers['x-timestamp'];

  try {
    const result = await processWhatsAppWebhook({
      rawBody,
      signature,
      timestampSeconds,
      securityGate,
      inboxTransaction: getInboxTransaction()
    });
    return res.status(result.status).json(result);
  } catch (error) {
    console.error('whatsapp_webhook_failed', error);
    return res.status(500).json({ error: 'webhook_processing_failed' });
  }
}
