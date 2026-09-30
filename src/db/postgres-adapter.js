import pg from 'pg';

const { Pool } = pg;

export function createPostgresAdapter({ connectionString = process.env.DATABASE_URL, ssl = process.env.DATABASE_SSL === 'true' } = {}) {
  if (!connectionString) throw new Error('DATABASE_URL_REQUIRED');
  const pool = new Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : undefined });

  return Object.freeze({
    async query(text, params = []) {
      return pool.query(text, params);
    },
    async transaction(callback) {
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
