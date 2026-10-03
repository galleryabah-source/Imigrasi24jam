import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('database/migrations');
const expected = ['0001_initial.sql','0002_regulatory_relationships.sql','0003_evidence_citations.sql','0004_inbox_outbox.sql','0005_outbox_leases.sql','0006_hardening_four_gates.sql'];

if (!fs.existsSync(dir)) throw new Error('MIGRATION_DIRECTORY_MISSING');
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
for (const name of expected) if (!files.includes(name)) throw new Error(`MIGRATION_MISSING:${name}`);
const numbers = files.map((f) => Number(f.slice(0,4)));
for (let i = 1; i < numbers.length; i++) if (numbers[i] !== numbers[i-1] + 1) throw new Error('MIGRATION_SEQUENCE_GAP');
console.log(`Migration inventory verified: ${files.length} files`);
console.log(files.join('\n'));
