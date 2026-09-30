export async function insertAuditEvent(db, event) {
  if (!db || typeof db.query !== 'function') throw new Error('AUDIT_DATABASE_REQUIRED');
  if (!event || !event.event_type || !event.subject_type || !event.subject_id) {
    throw new Error('AUDIT_EVENT_REQUIRED');
  }

  const result = await db.query(
    `INSERT INTO audit_events
      (id, actor_id, event_type, subject_type, subject_id, before_json, after_json, reason, correlation_id, created_at)
     VALUES
      (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
     RETURNING id, created_at`,
    [
      event.actor_id ?? null,
      event.event_type,
      event.subject_type,
      event.subject_id,
      JSON.stringify(event.before_json ?? null),
      JSON.stringify(event.after_json ?? null),
      event.reason ?? null,
      event.correlation_id ?? null,
      event.created_at
    ]
  );

  return result.rows[0] ?? null;
}
