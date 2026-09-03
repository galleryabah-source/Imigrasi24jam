import pg from 'pg';

const { Pool } = pg;

function buildSslConfig({ ssl, rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false', ca = process.env.DATABASE_SSL_CA } = {}) {
  if (!ssl) return undefined;
  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

export function createPostgresAdapter({
  connectionString = process.env.DATABASE_URL,
  ssl = process.env.DATABASE_SSL === 'true',
  sslRejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  sslCa = process.env.DATABASE_SSL_CA,
  max = Number(process.env.DATABASE_POOL_MAX ?? 10)
} = {}) {
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('INVALID_DATABASE_POOL_MAX');

  const pool = new Pool({
    connectionString,
    max,
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
