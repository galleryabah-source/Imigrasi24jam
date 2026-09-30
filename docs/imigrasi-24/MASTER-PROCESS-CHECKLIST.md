# IMIGRASI24JAM — Master Process Checklist

**Status:** Production Baseline Checklist — 2026-09-30  
**Canonical source:** `docs/imigrasi-24/PRODUCTION-BASELINE.md`

## Release Gates

- [x] Process 01 CI green
- [x] Canonical lifecycle hardening merged
- [x] Core Process-branch CI trigger aligned
- [x] Main divergence audited
- [ ] Production source promoted to `main`
- [ ] Production PostgreSQL identified
- [ ] Production migrations validated/applied
- [ ] Runtime/API entrypoint verified
- [ ] Production secrets configured
- [ ] Real WhatsApp E2E verified
- [ ] Production deployment/domain/webhook verified
- [ ] Final smoke test
- [ ] Operational evidence recorded

## Canonical Message Lifecycle

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

## Governance

- [ ] Service catalog
- [ ] Immigration-only domain policy
- [ ] Data classification
- [ ] Change control
- [ ] Regulation lifecycle
- [ ] Owner/authority approval
- [ ] Audit model

## Knowledge

- [ ] Services/intents/patterns
- [ ] Approved answers and legal sources
- [ ] Version/effective dates
- [ ] Review/approval/publication
- [ ] Regression questions

## Security

- [ ] Authentication/RBAC
- [ ] Object-level authorization
- [ ] Webhook signature/replay protection
- [ ] Rate limiting/input validation
- [ ] Secret isolation
- [ ] PII protection/encryption
- [ ] Audit integrity
- [ ] Document/attachment authorization
- [ ] Backup/restore test

## Observability

- [ ] Message processing metrics
- [ ] Deterministic/AI/handoff metrics
- [ ] Provider latency/failure
- [ ] Outbox retry/delivery failure
- [ ] Database/WhatsApp/worker health checks

## Application Capability Gates

- [ ] Deterministic known-service path works with AI OFF
- [ ] Knowledge provenance and approval enforced
- [ ] Internal/restricted documents denied to public attachment
- [ ] Complaint/report workflows remain under human governance
- [ ] Provider failure/retry/replay paths are idempotent

## Execution Order

```
SOURCE BASELINE
  ↓
PRODUCTION POSTGRESQL
  ↓
MIGRATIONS
  ↓
RUNTIME / SECRETS
  ↓
WHATSAPP E2E
  ↓
PRODUCTION DEPLOYMENT
  ↓
FINAL SMOKE TEST
  ↓
GO-LIVE
```

No unrelated feature work before these gates are completed.
