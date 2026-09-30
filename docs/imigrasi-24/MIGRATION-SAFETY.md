# IMIGRASI24JAM — Migration Safety Policy

**Status:** Required before production database changes

## Rules

1. `database/schema.sql` is a reference schema, not an executable production migration.
2. Every production schema change must have a uniquely versioned migration.
3. Migrations must be forward-only, deterministic, reviewed, and accompanied by a rollback/recovery plan.
4. Destructive operations require explicit owner approval and a tested recovery path.
5. Data transformations must be separated from structural changes when practical.
6. No migration may silently delete historical knowledge, document provenance, approval records, or audit events.
7. Published knowledge and document versions are immutable in place; corrections create new versions.
8. A migration must be tested against a disposable PostgreSQL environment before production.
9. CI must verify migration ordering and schema consistency.
10. Production deployment must use a backup/snapshot checkpoint before applying a risky migration.

## Promotion gate

`Schema proposal → Review → Test database → Data compatibility check → Backup plan → CI PASS → Owner approval → Production migration → Post-migration verification`

## Rollback philosophy

Prefer additive migrations and compatibility windows. If a migration cannot safely be rolled back, the deployment plan must provide a verified restore/recovery procedure and explicitly record that limitation.

## Knowledge-specific protection

Never use a schema migration to overwrite regulatory history. Regulation changes belong in versioned source/document/knowledge records with effective dates and audit history.
