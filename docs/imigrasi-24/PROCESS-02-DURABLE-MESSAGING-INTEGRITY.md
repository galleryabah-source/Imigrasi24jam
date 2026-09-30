# Process 02 — Durable Messaging Integrity

## Tujuan

Menjadikan alur pesan masuk Imigrasi24jam sebagai satu rantai transaksi yang konsisten:

`Provider → Normalize → Admission → Durable Inbox → Conversation Processing → Outbox → Lease → Provider → Delivery → Audit`

Komponen tidak boleh memiliki sumber kebenaran idempotensi yang saling bertentangan.

## Canonical admission rule

1. Timestamp/replay window divalidasi sebelum admission.
2. **Durable `message_inbox` menjadi sumber kebenaran utama** untuk duplicate admission.
3. Unique identity provider + provider message ID menentukan apakah pesan baru atau duplicate.
4. Replay store adalah defense-in-depth, bukan sumber kebenaran kedua.
5. Replay store tidak boleh dikonsumsi sebelum durable inbox berhasil ditulis.
6. Jika durable write gagal, provider retry tetap boleh mencoba lagi.
7. Duplicate durable tidak diproses ulang dan tidak membuat outbox baru.

## Integritas rantai

Setelah admission, pemrosesan harus mempertahankan satu identitas pesan dan conversation yang sama sampai outbox dan delivery. Lease hanya mengatur ownership worker; lease tidak mengubah identitas pesan.

## Safety boundary

- Tidak ada perubahan production schema pada Process 02.
- Tidak ada production migration.
- Tidak ada deployment production.
- Perubahan harus lulus static/unit test dan PostgreSQL integration suite sebelum dianggap siap merge.

## Acceptance gates

- [x] Durable inbox authoritative admission
- [x] Replay freshness validation terpisah dari durable admission
- [x] Replay store tidak dikonsumsi sebelum durable insert
- [x] Duplicate tidak memicu processing
- [x] Conversation transition graph rejects illegal state changes
- [x] Outbox worker detects loss of lease ownership
- [x] Outbox uses durable inbound conversation identity
- [x] Delivery state machine rejects transitions after SENT/FAILED
- [x] Audit contract covers inbound → conversation → outbox → delivery lifecycle events
- [x] Lifecycle correlation identity is propagated through inbound processing
- [x] Deterministic core emits a unified lifecycle trace for the same correlation identity
- [x] Transactional message lifecycle contract binds admission → conversation → outbox → audit to one DB transaction
- [x] Reference audit schema accepts the lifecycle correlation contract without schema mismatch
- [ ] Production audit migration for the lifecycle correlation contract
- [x] Provider delivery receives a deterministic idempotency identity and requires provider delivery identity before state commit
- [x] Unified lifecycle integrity contract rejects competing message/conversation/outbox identities
- [x] WhatsApp delivery uses one canonical provider delivery seam
- [x] Application-level provider delivery reconciliation contract exists
- [x] Full synthetic lifecycle integrity harness covers inbound → conversation → outbox → reconciliation → audit
- [ ] External provider delivery reconciliation is verified end-to-end
- [x] Test regression untuk admission ordering
- [ ] Hosted CI runner sehat
- [ ] PostgreSQL integration suite PASS di hosted CI
- [ ] End-to-end WhatsApp provider verification

## Urutan berikutnya

Process 02 dilanjutkan dengan **transactional audit persistence dan provider delivery idempotency/reconciliation**. Keduanya harus diselesaikan sebagai bagian dari rantai yang sama, bukan sebagai modul terpisah. Saat ini database reference schema belum memiliki `correlation_id` pada `audit_events`, sehingga persistence belum boleh dinyatakan compatible hanya berdasarkan kontrak aplikasi.


## Unified lifecycle integrity gate

Process 02 now treats the message lifecycle as one identity chain, not independent module contracts:

`provider message → durable inbox → conversation → outbox → delivery idempotency → audit correlation`

The application-level integrity contract is implemented in `src/core/lifecycle-integrity.js` and regression-tested in `tests/lifecycle-integrity.test.js`.

### Contract enforced

- inbound identity must match provider + provider message ID;
- outbound identity must retain the durable inbound ID as `reply_to_message_id`;
- conversation identity must remain unchanged from inbound through delivery;
- delivery idempotency identity is deterministically derived from provider + outbox + conversation + attempt;
- audit events must use the same correlation ID;
- provider reconciliation may match only by an explicit provider delivery identity or the deterministic idempotency identity.

This is an application-level gate only. It does **not** claim external WhatsApp exactly-once delivery or production reconciliation until a real provider adapter/webhook is verified.

### Full synthetic lifecycle integrity harness

A deterministic synthetic harness now exercises the complete application identity chain in one transaction-shaped execution:

`inbound → conversation → outbox → reconciliation → audit → integrity assertion`

It verifies one correlation identity and deterministic delivery idempotency identity across the chain, verifies rollback on a synthetic audit failure, and verifies unmatched provider callbacks do not reconcile. This is a deterministic application test harness; it is not evidence of real WhatsApp delivery or hosted PostgreSQL execution.

### Canonical provider delivery seam

The outbox worker now depends on one generic `provider.send()` seam, implemented for WhatsApp by `src/integrations/whatsapp/delivery-adapter.js`. The adapter is the only bridge to the provider contract's `sendText()` / `sendAttachment()` methods and preserves the same deterministic idempotency identity into provider delivery results.

This prevents the outbox worker and WhatsApp provider contract from becoming competing delivery abstractions. Attachment delivery is intentionally limited to one attachment per outbound message until an explicit provider batch contract exists.

### Current boundary

The canonical delivery reconciliation contract now normalizes provider status into the application's delivery state and resolves delivery only through the same provider message ID or deterministic idempotency identity used by the outbound lifecycle. An unmatched provider callback remains `UNMATCHED` and is not allowed to mutate lifecycle state.

The reference schema already contains `audit_events.correlation_id`, but the production migration remains intentionally uncreated/unapplied. No production schema, migration, or deployment is part of this gate.


### Identity semantic correction

The lifecycle identity contract explicitly distinguishes the inbound provider message identity from the outbound provider delivery identity. Inbound `provider_message_id` remains the admission identity; outbound reconciliation must match the provider delivery ID associated with the outbox record or the deterministic idempotency key. This prevents an inbound message ID from being incorrectly reused as evidence for an outbound delivery callback.


### Canonical PostgreSQL reconciliation persistence

The provider reconciliation seam is now wired to the canonical `message_outbox` record through `createPostgresDeliveryIdentityResolver` and `createPostgresDeliveryPersistence`. Identity resolution joins the outbound record to its durable inbound record; persistence delegates through the canonical outbox repository and refuses terminal-state mutation. This remains an application-level PostgreSQL contract until hosted integration evidence is available.


### Atomic delivery reconciliation boundary

Delivery callback reconciliation is now modeled as an atomic workflow: resolve the canonical lifecycle identity → reconcile the delivery state → write the corresponding delivery audit event within the same database transaction. An unmatched callback exits without mutation or audit. The audit event carries the same conversation subject and lifecycle correlation identity, while outbound provider identity remains distinct from inbound provider identity.


### Canonical provider callback composition

The provider callback path is now composed as one application workflow: provider status parsing → durable identity resolution → canonical `message_outbox` reconciliation → delivery audit, all inside one database transaction. The callback entry point does not own a parallel delivery state. Unknown callbacks terminate as `UNMATCHED` before mutation or audit. This is application-level wiring; real provider webhook and hosted PostgreSQL evidence remain pending.


### Canonical verified WhatsApp webhook entry

The inbound delivery-status callback now has a single verified entry point: webhook verification → provider status parsing → durable lifecycle identity resolution → canonical outbox mutation → audit, within the existing transaction boundary. Verification failure terminates before parsing or database work. This keeps provider security, delivery state, identity, and audit inside the same application lifecycle rather than allowing a separate callback subsystem.


## Latest integrated hardening — canonical provider callback normalization

Process 02 callback handling is now kept on the same lifecycle contract rather than maintaining a second delivery-state interpretation:

- provider callback status is normalized through `normalizeProviderDeliveryStatus()`;
- `ACCEPTED` remains `PROCESSING`;
- `SENT`, `DELIVERED`, and `READ` converge to `SENT`;
- `FAILED` converges to `FAILED`;
- unknown provider status is rejected before canonical outbox mutation or audit;
- callback tests cover matched, unmatched, accepted, failed, and invalid-status paths;
- audit classification distinguishes a true `DELIVERY_SENT` terminal transition from a non-terminal `DELIVERY_STATUS_RECONCILED` event.

This keeps **Verify → Parse → Normalize → Resolve → Mutate → Audit** as one application flow. No production schema, migration, or deployment is introduced by this hardening.

### Remaining Process 02 evidence gates

1. Execute the complete unit/static suite in a healthy runner.
2. Execute PostgreSQL integration against the reference/test schema.
3. Add/verify composed WhatsApp webhook E2E coverage, including duplicate/terminal callback behavior and transaction rollback.
4. Obtain hosted CI evidence.
5. Only after the evidence gates pass, evaluate the separate production migration gate for `correlation_id` and dedicated delivery identity fields.



### Latest integrity hardening — terminal callback idempotency

Terminal provider callbacks are now explicitly idempotent at the canonical outbox boundary:

- a callback matching an already SENT or FAILED record is recognized as an existing terminal delivery;
- no second state mutation is performed;
- no duplicate delivery audit event is emitted;
- the transaction still returns the canonical lifecycle as RECONCILED;
- lifecycle audit-event validation now includes non-terminal DELIVERY_STATUS_RECONCILED.

This closes an important replay surface in the single lifecycle chain: provider retry → resolve same outbox identity → terminal no-op → no duplicate mutation/audit.

No production schema, migration, or deployment is introduced.


### Latest identity hardening — durable attempt continuity

Provider delivery idempotency resolution now derives the lifecycle attempt from the durable `message_outbox.attempt_count`, rather than assuming attempt `0`. This keeps callback reconciliation aligned with the exact outbound attempt that the worker actually claimed and sent, including retry/recovery paths.

The invariant is now:

`durable outbox attempt → deterministic idempotency key → provider callback → canonical outbox reconciliation`

No production schema, migration, or deployment is introduced.


## Latest hardening — integrated static and composed webhook gate

The canonical lifecycle is now treated as one executable chain rather than a collection of isolated modules.

Static coverage has been expanded so `npm run check` includes the complete messaging/delivery path:
`lifecycle integrity → delivery normalization → PostgreSQL identity resolution → transactional reconciliation → provider callback → WhatsApp webhook → delivery adapter`.

A composed webhook regression suite also covers the chain:
`verify → parse → normalize → resolve → mutate → audit → commit`, including canonical provider statuses, terminal callback idempotency, invalid-status rejection, lifecycle correlation/idempotency continuity, and rollback when audit persistence fails.

This remains test/application-level evidence only. It does not establish hosted CI PASS, production schema readiness, production migration readiness, or real external WhatsApp provider E2E.


### Latest integrity hardening — canonical audit persistence

Audit persistence is now routed through a single repository boundary, `src/db/audit-repository.js`. The provider callback transaction constructs the canonical audit contract and persists it through that repository rather than issuing a second, callback-specific SQL implementation.

The lifecycle therefore remains:

`Verify → Parse → Normalize → Resolve → Mutate → Canonical Audit Repository → Commit`

This reduces the risk of divergent audit persistence semantics across message lifecycle paths. It remains application-level evidence; hosted CI, PostgreSQL execution, and external WhatsApp verification are still required before merge readiness is declared.


### Latest CI infrastructure hardening

The three repository workflows used for the integrated evidence chain are now pinned to `ubuntu-24.04` rather than `ubuntu-latest`. The change is intentionally limited to runner determinism; application behavior, database schema, migrations, and production deployment boundaries are unchanged.

Previous hosted runs terminated with job-level failure and zero executed steps. Because no step/log evidence was available, those failures were not interpreted as application test failures. The runner pin is the next evidence-gathering action before any application change is inferred.

## P2 canonical lifecycle seam

The canonical inbound transaction boundary is now `src/core/canonical-message-lifecycle.js`.

Its required order is: durable inbox admission -> conversation processing -> canonical outbox enqueue -> audit persistence -> inbox processed.

The durable inbox uniqueness constraint `(provider, provider_message_id)` remains the sole duplicate admission authority. The replay store remains defense-in-depth and is not allowed to consume admission before durable persistence succeeds.

Conversation processing is supplied as a pure orchestration dependency; the canonical lifecycle owns the transaction and the durable inbox/outbox/audit boundaries. Delivery remains outside this transaction and is owned by the canonical outbox worker and provider delivery adapter.

## Canonical identity hardening

Imigrasi24jam now uses one executable identity graph:

`inbound_id → conversation_id → outbox_id → outbound_provider_message_id / idempotency_key → correlation_id`

Rules:

- `inbound_id` is the durable UUID anchor from `message_inbox`.
- inbound `provider_message_id` is admission identity only; it is never treated as outbound delivery identity.
- `conversation_id` must remain identical from Inbox through Conversation and Outbox.
- `outbox_id` is the durable outbound identity and must reference `inbound_id` through `reply_to_message_id`.
- `outbound_provider_message_id` is created by the provider delivery seam and remains distinct from the inbound provider ID.
- delivery `idempotency_key` is deterministically derived from provider + outbox + conversation + durable attempt.
- `correlation_id` remains stable across the lifecycle and audit.
- `audit_events.subject_id` uses `inbound_id` as the UUID anchor because the current schema stores `conversation_id` as text; conversation/outbox/provider identities remain explicit audit detail.

The executable contract is enforced by `src/core/lifecycle-integrity.js`, while `src/core/canonical-message-lifecycle.js` establishes the identity during the durable Inbox → Conversation → Outbox transaction.

## Legacy worker migration

`src/core/inbox-worker.js` is now compatibility-only. Its persistence SQL has been removed. It adapts legacy processing callbacks into `runCanonicalInboundLifecycle()` and therefore cannot create a competing Inbox or Outbox path.

Regression tests explicitly assert that the legacy worker contains no direct Inbox/Outbox INSERT implementation and that duplicate admission stops before processing, Outbox, and audit.

## Audit identity correction

Delivery reconciliation audit now uses the durable `inbound_id` UUID as `audit_events.subject_id`. The text `conversation_id`, `outbox_id`, outbound provider identity, deterministic idempotency key, and correlation ID remain in the audit event detail. This removes the previous UUID/text semantic mismatch without introducing a production migration.

## Remaining evidence gates

1. Execute complete static/unit suite in a healthy runner.
2. Execute PostgreSQL integration against the reference/test schema.
3. Verify composed WhatsApp webhook E2E, including duplicate/terminal callback behavior and rollback.
4. Obtain hosted CI evidence.
5. Only after those evidence gates pass, evaluate any future production migration for a dedicated conversation UUID or additional delivery identity fields.


### P2 gap closure — admission and correlation ownership

The WhatsApp inbox gateway is validation-only: it normalizes the provider request and validates replay timestamp freshness, but it does not insert into `message_inbox` and does not consume replay state. Durable Inbox admission is owned exclusively by `runCanonicalInboundLifecycle()`, which performs `insertIfNew()` inside the canonical transaction.

Lifecycle correlation is deterministic and reconstructable from `provider + inbound provider message ID`. The canonical inbound lifecycle derives it after durable admission and passes that value to conversation processing, while PostgreSQL delivery reconciliation derives the same value from the durable inbound row. A caller-supplied correlation value can no longer create a second identity.

Required regression invariants:
- gateway performs no durable Inbox admission;
- canonical lifecycle is the only Inbox admission owner;
- conversation correlation equals canonical correlation;
- delivery correlation equals canonical correlation;
- audit correlation equals canonical correlation.


## Final residual-path audit

The final production-source audit on the P2 branch checked the complete `src/` tree for competing Inbox, Conversation, Outbox, and lifecycle-audit seams.

Evidence:
- direct `message_inbox` persistence exists only in `src/core/inbox-outbox-repository.js`;
- direct `message_outbox` persistence exists only in `src/core/inbox-outbox-repository.js`;
- `src/core/inbox-worker.js` is compatibility-only and delegates to `runCanonicalInboundLifecycle()`;
- `src/integrations/whatsapp/inbox-gateway.js` is validation-only and does not admit durable Inbox rows;
- delivery reconciliation reads the durable Outbox/Inbox identity and remains outside the inbound transaction;
- `insertAuditEvent()` is used by the canonical inbound lifecycle and the separate delivery-reconciliation transaction, with the latter extending the same lifecycle identity rather than creating a second inbound path;
- the obsolete generic `runTransactionalMessageLifecycle()` helper was removed because it exposed a second possible Inbox → Conversation → Outbox → Audit transaction boundary despite having no production caller;
- its obsolete tests were removed; canonical lifecycle coverage remains in `tests/canonical-message-lifecycle.test.js`.

Conclusion: no competing production Inbox → Conversation → Outbox lifecycle caller or generic lifecycle seam remains in the P2 source tree. The remaining work is evidence/review gating, not architecture expansion.
