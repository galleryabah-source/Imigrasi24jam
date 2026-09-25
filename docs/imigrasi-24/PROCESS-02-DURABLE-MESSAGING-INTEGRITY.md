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
