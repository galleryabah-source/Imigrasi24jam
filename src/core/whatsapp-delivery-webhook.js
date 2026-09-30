import { createWhatsAppDeliveryAdapter } from '../integrations/whatsapp/delivery-adapter.js';
import { reconcileProviderCallbackTransaction } from './provider-delivery-callback.js';

export async function handleWhatsAppDeliveryWebhook({
  db,
  providerAdapter,
  request,
  actorId = null
} = {}) {
  if (!db || typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
  if (!providerAdapter) throw new Error('WHATSAPP_PROVIDER_REQUIRED');

  const provider = createWhatsAppDeliveryAdapter(providerAdapter);
  const verification = await providerAdapter.verifyWebhook(request);
  if (!verification || verification.valid !== true) {
    return Object.freeze({ status:'REJECTED', reason:'WEBHOOK_VERIFICATION_FAILED' });
  }

  const result = await reconcileProviderCallbackTransaction(db, {
    provider:'wa',
    parseDeliveryStatus:(input) => provider.parseDeliveryStatus(input),
    request,
    actorId
  });

  return Object.freeze({
    status: result.status,
    reconciliation: result
  });
}
