import fs from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_REQUIRED');

const migrations = [
  '0001_initial.sql',
  '0002_regulatory_relationships.sql',
  '0003_evidence_citations.sql',
  '0004_inbox_outbox.sql',
  '0005_outbox_leases.sql',
  '0006_webhook_replay.sql',
  '0007_inbox_replay_indexes.sql',
  '0008_inbox_leases.sql',
  '0009_conversations.sql'
];

const client = new Client({ connectionString: url });
try {
  await client.connect();
  await client.query('BEGIN');
  for (const name of migrations) {
    const sql = await fs.readFile(new URL(`../database/migrations/${name}`, import.meta.url), 'utf8');
    await client.query(sql);
    console.log(`Applied ${name}`);
  }
  await client.query('COMMIT');
  console.log('All migrations applied successfully');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
