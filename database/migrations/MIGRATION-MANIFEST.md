# Migration Manifest

| Version | File | Type | Destructive | Status |
|---|---|---|---|---|
| 0001 | `0001_initial.sql` | additive foundation | No | TEST-ONLY / REVIEW |
| 0002 | `0002_regulatory_relationships.sql` | additive | No | TEST-ONLY / REVIEW |
| 0003 | `0003_evidence_citations.sql` | additive | No | TEST-ONLY / REVIEW |
| 0004 | `0004_inbox_outbox.sql` | additive durable messaging | No | TEST-ONLY / REVIEW |
| 0005 | `0005_outbox_leases.sql` | additive reliability | No | TEST-ONLY / REVIEW |
| 0006 | `0006_webhook_replay.sql` | additive replay protection | No | TEST-ONLY / REVIEW |
| 0007 | `0007_inbox_replay_indexes.sql` | additive indexes | No | TEST-ONLY / REVIEW |
| 0008 | `0008_inbox_leases.sql` | additive reliability | No | TEST-ONLY / REVIEW |
| 0009 | `0009_conversations.sql` | additive durable conversation state | No | TEST-ONLY / REVIEW |

## Required verification before production

- Apply to disposable PostgreSQL.
- Run `database/tests/schema-integrity.sql`.
- Confirm all expected tables, constraints, foreign keys, checks and indexes.
- Run application regression tests against the resulting schema.
- Verify optimistic concurrency conflict behavior for conversations.
- Capture backup/recovery evidence.
- Obtain explicit owner approval.

No migration in this manifest is authorized for production merely by being committed.
