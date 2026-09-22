import pg from 'pg';

const { Pool } = pg;

function buildSslConfig({ ssl, rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false', ca = process.env.DATABASE_SSL_CA } = {}) {
  if (!ssl) return undefined;
  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

function positiveInteger(value, fallback, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) return fallback;
  return parsed;
}

export function createPostgresAdapter({
  connectionString = process.env.DATABASE_URL,
  ssl = process.env.DATABASE_SSL === 'true',
  sslRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  sslCa = process.env.DATABASE_SSL_CA,
  max = Number(process.env.DATABASE_POOL_MAX ?? 10),
  connectionTimeoutMillis = positiveInteger(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 5000, 120000),
  idleTimeoutMillis = positiveInteger(process.env.DATABASE_IDLE_TIMEOUT_MS, 30000, 600000)
} = {}) {
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('INVALID_DATABASE_POOL_MAX');
  if (!Number.isInteger(connectionTimeoutMillis) || connectionTimeoutMillis <= 0) throw new Error('INVALID_DATABASE_CONNECTION_TIMEOUT');
  if (!Number.isInteger(idleTimeoutMillis) || idleTimeoutMillis <= 0) throw new Error('INVALID_DATABASE_IDLE_TIMEOUT');

  const pool = new Pool({
    connectionString,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    ssl: buildSslConfig({ ssl, rejectUnauthorized: sslRejectUnauthorized, ca: sslCa })
  });

  return Object.freeze({
    async query(text, params = []) {
      return pool.query(text, params);
    },
    async transaction(callback) {
      if (typeof callback !== 'function') throw new Error('TRANSACTION_CALLBACK_REQUIRED');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = Object.freeze({ query: (text, params = []) => client.query(text, params) });
        const result = await callback(tx);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  });
}
