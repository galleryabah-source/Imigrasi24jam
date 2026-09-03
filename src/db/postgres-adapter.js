import pg from 'pg';

const { Pool } = pg;

function buildSslConfig() {
  if (process.env.DATABASE_SSL !== 'true') return undefined;
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ca = process.env.DATABASE_SSL_CA;
  return ca ? { rejectUnauthorized, ca } : { rejectUnauthorized };
}

export function createPostgresAdapter({ connectionString = process.env.DATABASE_URL, ssl = process.env.DATABASE_SSL === 'true', max = Number(process.env.DATABASE_POOL_MAX ?? 10) } = {}) {
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
  if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error('INVALID_DATABASE_POOL_MAX');

  const pool = new Pool({
    connectionString,
    max,
    ssl: ssl ? buildSslConfig() : undefined
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
