import { createHash } from 'node:crypto';

function hashKey(key) {
  return createHash('sha256').update(String(key), 'utf8').digest('hex');
}

export function createPostgresReplayStore(db) {
  if (!db || typeof db.query !== 'function') throw new Error('DATABASE_QUERY_REQUIRED');

  return Object.freeze({
    async acceptIfAbsent(key, ttlSeconds = 300) {
      const ttl = Number(ttlSeconds);
      if (!Number.isInteger(ttl) || ttl <= 0 || ttl > 86400) throw new Error('INVALID_REPLAY_TTL');
      const keyHash = hashKey(key);
      const result = await db.query(`
        INSERT INTO webhook_replay (key_hash, expires_at)
        VALUES ($1, now() + ($2 * interval '1 second'))
        ON CONFLICT (key_hash) DO UPDATE
          SET expires_at = EXCLUDED.expires_at
          WHERE webhook_replay.expires_at <= now()
        RETURNING key_hash
      `, [keyHash, ttl]);
      return result.rowCount === 1;
    },

    async purgeExpired() {
      const result = await db.query('DELETE FROM webhook_replay WHERE expires_at <= now()');
      return result.rowCount;
    }
  });
}
