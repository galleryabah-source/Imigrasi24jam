# PostgreSQL Concurrency Gate

This gate must pass before production WhatsApp integration.

## Required invariants

- `UNIQUE(provider, provider_message_id)` prevents duplicate inbound identity.
- Outbox claim uses `FOR UPDATE SKIP LOCKED`.
- Every active claim has a worker owner and lease expiry.
- Only the owning worker may finalize the claimed job.
- An expired lease is reclaimable.
- Provider delivery is outside the database transaction.
- A delivery retry must not rerun knowledge processing.

## Validation

Run `tests/postgres-outbox-concurrency.sql` against a real PostgreSQL database with migrations 0004 and 0005 applied. Use at least two concurrent sessions and verify that the same active row is never claimed by both workers. Then expire a lease and verify that another worker can reclaim it.

This repository currently records the test scenario and contracts; it is not evidence that a real PostgreSQL concurrency run has passed until CI or an integration environment produces that evidence.
