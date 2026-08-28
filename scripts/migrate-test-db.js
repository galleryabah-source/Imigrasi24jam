import fs from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_REQUIRED');

const sql = await fs.readFile(new URL('../database/migrations/0001_initial.sql', import.meta.url), 'utf8');
const client = new Client({ connectionString: url });
try {
  await client.connect();
  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Migration 0001 applied successfully');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
