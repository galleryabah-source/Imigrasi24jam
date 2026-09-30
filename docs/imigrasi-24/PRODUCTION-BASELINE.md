# Imigrasi24jam — Production Baseline

**Baseline:** 2026-09-30  
**Source of truth:** `process-1-governance-core-2026-09-25` + validated canonical lifecycle hardening  
**Purpose:** single production-source contract before PostgreSQL/runtime/secrets promotion.

## 1. Production-source decision

This branch is the **single production baseline** for the application source.

The legacy `main` branch divergence is not promoted wholesale. The 12 legacy code/test commits identified in the 2026-09-30 divergence audit are superseded and must not be restored as parallel implementations.

Production source must contain one canonical message lifecycle.

## 2. Canonical lifecycle

```
Provider
  → Verify
  → Normalize
  → Canonical Admission
  → Durable Inbox
  → Canonical Conversation Processing
  → Canonical Outbox
  → Lease / Worker
  → Canonical Provider Adapter
  → Delivery Callback
  → Canonical Reconciliation
  → Canonical Audit
```

Canonical identity chain:

```
inbound_id
  → conversation_id
  → outbox_id
  → outbound_provider_message_id / idempotency_key
  → correlation_id
```

No production module may bypass this lifecycle for inbound or outbound messaging.

## 3. Non-negotiable governance

- Immigration-only public domain.
- Official-source grounding.
- AI is optional, never the single point of failure.
- Known services remain operational with AI disabled.
- Human approval is required for authoritative knowledge publication.
- Provider implementations remain replaceable behind canonical contracts.
- Consequential processing is auditable.
- Backend authorization is authoritative.
- Sensitive/internal documents are never exposed through public messaging.
- Changes require tests, evidence, and baseline update.

## 4. Durable messaging invariants

- Inbox admission is idempotent.
- Conversation identity is durable.
- Outbox records are durable before provider delivery.
- Worker processing uses leases/claims.
- Provider delivery identity is reconciled against durable outbox identity.
- Delivery callbacks cannot create a competing message lifecycle.
- Audit records preserve the canonical correlation chain.
- Retry/replay paths must remain idempotent.

## 5. Knowledge / answer governance

Primary path:

`Normalize → Intent/Search → Approved Knowledge → Policy → Safety → Response`

AI-assisted path:

`Unknown/Complex → AI Router → Validation → Safe Response / Human Handoff`

AI-generated knowledge is draft material until authorized review and publication.

Knowledge must preserve source, version, effective dates, approval state, and audit history.

## 6. Document governance

Every document used for public answering must have:

- provenance/source;
- classification;
- version;
- effective dates;
- approval/publication state;
- authorization policy.

`PRIVATE / INTERNAL` and `RESTRICTED` material is deny-by-default for public attachment.

Backend authorization must execute before any provider media-send operation.

## 7. Release gates

A production promotion requires:

1. Source baseline locked.
2. All Process 01 CI gates green.
3. Production PostgreSQL identified and migration plan validated.
4. Runtime/API entrypoint identified.
5. Production secrets configured without repository exposure.
6. Real WhatsApp E2E verified.
7. Production deployment/domain/webhook verified.
8. Final smoke test and operational evidence recorded.

No feature expansion occurs before these gates are complete.

## 8. Current state

- Canonical Process 01 baseline: validated.
- PR #7 canonicalization: merged.
- PR #9 CI trigger hardening: merged.
- Main divergence audit: completed.
- Process 01 CI: green on the audit baseline.
- Production database: not yet promoted.
- Production runtime/secrets: not yet promoted.
- Real WhatsApp E2E: not yet proven.
- Production deployment/domain/webhook: not yet proven.
- Final smoke test: not yet executed.

## 9. Next execution stage

After this source baseline is accepted:

`Production PostgreSQL → migrations → runtime configuration → secrets → integration verification`

Only after those checks pass should the system proceed to real WhatsApp E2E and production deployment.

## 10. Change rule

Any future change that affects the canonical lifecycle must:

`Proposal → Implementation → Unit/Integration/Regression Tests → Security/Failure-path Evidence → CI → Baseline Update`

A new alternative lifecycle is not permitted without an explicit architecture decision replacing the current canonical contract.
