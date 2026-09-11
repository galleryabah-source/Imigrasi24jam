import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);
export const GLOBAL_AUDIT_LOCK_KEY = 84172431;

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

export function canonicalAuditMaterial(event, sequenceNo, previousHash) {
  return canonicalize({
    sequence_no: sequenceNo,
    previous_hash: previousHash,
    actor_id: event.actor_id ?? null,
    event_type: event.event_type,
    subject_type: event.subject_type,
    subject_id: event.subject_id ?? null,
    before_json: event.before_json ?? null,
    after_json: event.after_json ?? null,
    reason: event.reason ?? null,
    created_at: event.created_at instanceof Date ? event.created_at.toISOString() : event.created_at
  });
}

export function hashAuditMaterial(material) {
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

function requireAuditEvent(event) {
  if (!event || typeof event !== 'object' || !event.event_type || !event.subject_type || !event.subject_id) throw new Error('AUDIT_EVENT_REQUIRED');
  return event;
}

export async function appendAuditEventInTransaction(tx, event) {
  requireAuditEvent(event);
  await tx.query('SELECT pg_advisory_xact_lock($1)', [GLOBAL_AUDIT_LOCK_KEY]);
  const previous = await tx.query('SELECT sequence_no, event_hash FROM audit_events WHERE sequence_no IS NOT NULL ORDER BY sequence_no DESC LIMIT 1');
  const previousSequence = previous.rows[0]?.sequence_no == null ? 0 : Number(previous.rows[0].sequence_no);
  if (!Number.isSafeInteger(previousSequence) || previousSequence < 0) throw new Error('AUDIT_SEQUENCE_INVALID');
  const sequenceNo = previousSequence + 1;
  const previousHash = previous.rows[0]?.event_hash || GENESIS_HASH;
  if (!/^[0-9a-f]{64}$/.test(previousHash)) throw new Error('AUDIT_PREVIOUS_HASH_INVALID');
  const createdAt = event.created_at instanceof Date ? event.created_at.toISOString() : (event.created_at ?? new Date().toISOString());
  const normalized = { ...event, created_at: createdAt };
  const eventHash = hashAuditMaterial(canonicalAuditMaterial(normalized, sequenceNo, previousHash));
  const result = await tx.query(`
    INSERT INTO audit_events
      (actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, created_at, sequence_no, previous_hash, event_hash)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING id, sequence_no, previous_hash, event_hash
  `, [normalized.actor_id ?? null, normalized.event_type, normalized.subject_type, normalized.subject_id,
    normalized.before_json ?? null, normalized.after_json ?? null, normalized.reason ?? null, normalized.created_at,
    sequenceNo, previousHash, eventHash]);
  if (result.rowCount !== 1) throw new Error('AUDIT_EVENT_PERSISTENCE_FAILED');
  return result.rows[0];
}

export function createAuditIntegrityRepository(db) {
  if (!db || typeof db.transaction !== 'function') throw new Error('AUDIT_TRANSACTION_REQUIRED');
  if (typeof db.query !== 'function') throw new Error('AUDIT_DATABASE_QUERY_REQUIRED');
  return Object.freeze({
    async append(event) { return db.transaction((tx) => appendAuditEventInTransaction(tx, event)); }
  });
}

export async function verifyAuditChain(db) {
  if (!db || typeof db.query !== 'function') throw new Error('AUDIT_DATABASE_QUERY_REQUIRED');
  const result = await db.query('SELECT id, sequence_no, previous_hash, event_hash, actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, created_at FROM audit_events WHERE sequence_no IS NOT NULL ORDER BY sequence_no ASC');
  let expectedSequence = 1;
  let previousHash = GENESIS_HASH;
  for (const row of result.rows) {
    if (Number(row.sequence_no) !== expectedSequence) return Object.freeze({ intact: false, reason: 'SEQUENCE_GAP', at: row.id });
    if (row.previous_hash !== previousHash) return Object.freeze({ intact: false, reason: 'PREVIOUS_HASH_MISMATCH', at: row.id });
    const expectedHash = hashAuditMaterial(canonicalAuditMaterial(row, expectedSequence, previousHash));
    if (row.event_hash !== expectedHash) return Object.freeze({ intact: false, reason: 'EVENT_HASH_MISMATCH', at: row.id });
    previousHash = row.event_hash;
    expectedSequence += 1;
  }
  return Object.freeze({ intact: true, events: result.rows.length });
}
