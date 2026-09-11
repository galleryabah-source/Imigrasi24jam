import { createHash } from 'node:crypto';

const GENESIS_HASH = '0'.repeat(64);
const GLOBAL_AUDIT_LOCK_KEY = 84172431;

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
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
    created_at: event.created_at
  });
}

export function hashAuditMaterial(material) {
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

export function createAuditIntegrityRepository(db) {
  if (!db || typeof db.transaction !== 'function') throw new Error('AUDIT_TRANSACTION_REQUIRED');
  if (typeof db.query !== 'function') throw new Error('AUDIT_DATABASE_QUERY_REQUIRED');

  return Object.freeze({
    async append(event) {
      if (!event || !event.event_type || !event.subject_type) throw new Error('INVALID_AUDIT_EVENT');
      return db.transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock($1)', [GLOBAL_AUDIT_LOCK_KEY]);
        const previous = await tx.query('SELECT sequence_no, event_hash FROM audit_events WHERE sequence_no IS NOT NULL ORDER BY sequence_no DESC LIMIT 1');
        const previousSequence = previous.rows[0]?.sequence_no == null ? 0 : Number(previous.rows[0].sequence_no);
        if (!Number.isSafeInteger(previousSequence) || previousSequence < 0) throw new Error('AUDIT_SEQUENCE_INVALID');
        const sequenceNo = previousSequence + 1;
        const previousHash = previous.rows[0]?.event_hash || GENESIS_HASH;
        if (!/^[0-9a-f]{64}$/.test(previousHash)) throw new Error('AUDIT_PREVIOUS_HASH_INVALID');
        const material = canonicalAuditMaterial(event, sequenceNo, previousHash);
        const eventHash = hashAuditMaterial(material);
        const inserted = await tx.query(`
          INSERT INTO audit_events
            (actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, created_at, sequence_no, previous_hash, event_hash)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          RETURNING id, sequence_no, previous_hash, event_hash
        `, [event.actor_id ?? null, event.event_type, event.subject_type, event.subject_id ?? null,
          event.before_json ?? null, event.after_json ?? null, event.reason ?? null, event.created_at,
          sequenceNo, previousHash, eventHash]);
        if (inserted.rowCount !== 1) throw new Error('AUDIT_INSERT_FAILED');
        return inserted.rows[0];
      });
    }
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
