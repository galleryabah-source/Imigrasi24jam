import { createPostgresAdapter } from '../src/db/postgres-adapter.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.DATABASE_URL || !process.env.WEBHOOK_SECRET) {
    return res.status(503).json({ status: 'not_ready', service: 'imigrasi24jam' });
  }

  let db;
  try {
    db = createPostgresAdapter({ max: 1 });
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'ready', service: 'imigrasi24jam' });
  } catch (error) {
    console.error('readiness_check_failed', {
      name: error?.name,
      code: error?.code,
      message: error?.message
    });
    return res.status(503).json({ status: 'not_ready', service: 'imigrasi24jam' });
  } finally {
    if (db) {
      try { await db.close(); } catch { /* health endpoint must remain bounded */ }
    }
  }
}
