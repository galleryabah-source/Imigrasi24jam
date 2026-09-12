export const DEFAULT_OUTBOX_LEASE_SECONDS = 60;
export const MIN_OUTBOX_LEASE_SECONDS = 30;

function requireAuditEvent(event) {
  if (!event || typeof event !== 'object' || !event.event_type || !event.subject_type || !event.subject_id) {
    throw new Error('AUDIT_EVENT_REQUIRED');
  }
  return event;
}

async function appendAuditEvent(tx, event) {
  requireAuditEvent(event);
  const result = await tx.query(`
    INSERT INTO audit_events (actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
  `, [event.actor_id ?? null, event.event_type, event.subject_type, event.subject_id,
    event.before_json ?? null, event.after_json ?? null, event.reason ?? null, event.created_at ?? new Date().toISOString()]);
  if (result.rowCount !== 1) throw new Error('AUDIT_EVENT_PERSISTENCE_FAILED');
  return result.rows[0];
}

function attachmentIds(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.attachments)) return [];
  return payload.attachments.map((attachment) => String(attachment?.id ?? '').trim()).filter(Boolean);
}

export function createOutboxLeaseRepository(db, { workerId, leaseSeconds = DEFAULT_OUTBOX_LEASE_SECONDS } = {}) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');
  if (!workerId) throw new Error('WORKER_ID_REQUIRED');
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < MIN_OUTBOX_LEASE_SECONDS) throw new Error('INVALID_LEASE_SECONDS');
  const boundedError = (value) => String(value ?? '').slice(0, 2000);

  return Object.freeze({
    async claimPendingOutbound() {
      const result = await db.query(`
        WITH candidate AS (
          SELECT id
          FROM message_outbox
          WHERE (delivery_state IN ('PENDING','RETRY') AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
             OR (delivery_state = 'PROCESSING' AND lease_expires_at <= now())
          ORDER BY created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE message_outbox o
        SET delivery_state='PROCESSING',
            lease_owner=$1,
            lease_expires_at=now() + ($2 * interval '1 second'),
            attempt_count=o.attempt_count + 1
        FROM candidate c
        WHERE o.id=c.id
        RETURNING o.*
      `, [workerId, leaseSeconds]);
      return result.rows[0] ?? null;
    },

    async revalidateOutboundAttachments(payload) {
      const ids = attachmentIds(payload);
      if (!ids.length) return Object.freeze({ allowed: true, document_ids: [] });
      if (ids.length !== payload.attachments.length) return Object.freeze({ allowed: false, reason: 'ATTACHMENT_ID_REQUIRED', document_ids: ids });

      const result = await db.query(`
        SELECT id
        FROM documents
        WHERE id = ANY($1::uuid[])
          AND access_classification = 'PUBLIC'
          AND status = 'PUBLISHED'
          AND immigration_relevance_status = 'VERIFIED'
          AND authority_status = 'VERIFIED'
          AND content_integrity_status = 'VERIFIED'
          AND allow_whatsapp_attachment = true
          AND quarantined = false
      `, [ids]);
      const allowedIds = new Set(result.rows.map((row) => String(row.id)));
      const blocked = ids.filter((id) => !allowedIds.has(id));
      return Object.freeze({ allowed: blocked.length === 0, document_ids: ids, blocked_document_ids: blocked });
    },

    async markOutboundSent(id, providerMessageId = null, auditEvent = null) {
      if (auditEvent) {
        requireAuditEvent(auditEvent);
        if (typeof db.transaction !== 'function') throw new Error('DATABASE_TRANSACTION_REQUIRED');
        return db.transaction(async (tx) => {
          await appendAuditEvent(tx, auditEvent);
          const result = await tx.query(`UPDATE message_outbox SET delivery_state='SENT', provider_message_id=$2, sent_at=now(), lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$3 RETURNING id`, [id, providerMessageId, workerId]);
          if (result.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
          return result.rows[0];
        });
      }
      const result = await db.query(`UPDATE message_outbox SET delivery_state='SENT', provider_message_id=$2, sent_at=now(), lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$3 RETURNING id`, [id, providerMessageId, workerId]);
      if (result.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
      return result.rows[0];
    },

    async scheduleOutboundRetry(id, delaySeconds, error) {
      if (!Number.isInteger(delaySeconds) || delaySeconds < 0) throw new Error('INVALID_RETRY_DELAY');
      const result = await db.query(`UPDATE message_outbox SET delivery_state='RETRY', next_attempt_at=now() + ($2 * interval '1 second'), last_error=$3, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$4 RETURNING id`, [id, delaySeconds, boundedError(error), workerId]);
      if (result.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
      return result.rows[0];
    },

    async markOutboundFailed(id, error) {
      const result = await db.query(`UPDATE message_outbox SET delivery_state='FAILED', last_error=$2, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1 AND delivery_state='PROCESSING' AND lease_owner=$3 RETURNING id`, [id, boundedError(error), workerId]);
      if (result.rowCount !== 1) throw new Error('OUTBOX_LEASE_LOST');
      return result.rows[0];
    }
  });
}
