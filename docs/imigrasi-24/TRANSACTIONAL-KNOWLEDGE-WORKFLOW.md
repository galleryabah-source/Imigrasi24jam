# Transactional Knowledge Workflow v1

## Objective

Prevent partial state in knowledge ingestion and publication. Consequential database writes must execute inside a single database transaction.

## Ingestion transaction

`create source → create document → create validation → create knowledge candidate → create audit`

If any operation fails, the database transaction must roll back all writes from that workflow invocation.

## Approval/publication transaction

`approve → publish → create audit`

Approval and publication must never be treated as independent success states when the workflow contract requires both.

## Adapter contract

The application layer receives a database object exposing `transaction(callback)`. Repository-specific SQL/ORM code belongs behind the adapter; business workflow code must not depend on a specific provider API.

## Idempotency requirement

The production adapter must accept an idempotency key for externally retried operations. The same logical request must not create duplicate source/document/candidate/audit records.

## Concurrency requirement

Production implementation must use appropriate row locking or serializable/atomic constraints around approval and publication so two reviewers/workers cannot publish conflicting versions simultaneously.

## Failure rule

No partial success is reported to callers. A failed transaction returns an error and leaves the database at the pre-transaction state.

## Next implementation gate

Connect this contract to the selected PostgreSQL driver/ORM only after repository dependency and existing application architecture are audited. Then execute integration tests against disposable PostgreSQL before any production migration.
