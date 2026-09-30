# Migration Manifest

| Version | File | Type | Destructive | Status |
|---|---|---|---|---|
| 0001 | `0001_initial.sql` | additive foundation | No | TEST-ONLY / REVIEW |
| 0002–0005 | existing additive migrations | relationships/evidence/messaging/lease | No | TEST-ONLY / REVIEW |

## Required verification before production

- Apply to disposable PostgreSQL.
- Run `database/tests/schema-integrity.sql`.
- Confirm all expected tables, constraints, foreign keys, checks and indexes.
- Run application regression tests against the resulting schema.
- Capture backup/recovery evidence.
- Obtain explicit owner approval.

No migration in this manifest is authorized for production merely by being committed.
