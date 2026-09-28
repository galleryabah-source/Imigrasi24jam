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

## Canonical identity contract

Imigrasi24jam menggunakan satu identity graph untuk seluruh lifecycle:

`inbound_id → conversation_id → outbox_id → outbound provider delivery identity → audit correlation`

Dengan aturan:

- **`inbound_id`** adalah UUID durable dari `message_inbox` dan anchor internal utama.
- **`provider_message_id`** hanya mengidentifikasi pesan inbound untuk admission; tidak boleh dipakai sebagai bukti delivery outbound.
- **`conversation_id`** tetap menjadi identitas percakapan lintas Inbox/Conversation/Outbox pada schema saat ini.
- **`outbox_id`** adalah UUID durable outbound dan selalu mereferensikan `inbound_id` melalui `reply_to_message_id`.
- **`outbound_provider_message_id`** adalah identity provider untuk delivery outbound; nilainya berbeda secara semantik dari inbound provider message ID dan baru tersedia setelah provider send.
- **`idempotency_key`** delivery diturunkan deterministik dari `provider + outbox_id + conversation_id + attempt`.
- **`correlation_id`** adalah identity trace lifecycle yang sama dari inbound sampai audit; callback tidak boleh membuat correlation baru untuk lifecycle yang sudah ada.
- **`audit_events.subject_id`** memakai `inbound_id` sebagai UUID anchor; `conversation_id`, `outbox_id`, dan provider identities tetap disimpan sebagai immutable audit detail.
- Lease/worker ownership tidak mengubah identity graph.

Aturan integritas yang sekarang executable:

1. Inbox admission menghasilkan durable `inbound_id`.
2. Conversation wajib mengembalikan `conversation_id` yang sama dengan Inbox; mismatch ditolak.
3. Outbox wajib memakai `inbound_id` sebagai `reply_to_message_id` dan conversation identity yang sama.
4. Delivery resolver membangun identity dari durable Outbox + joined Inbox, termasuk durable attempt.
5. Provider callback hanya boleh reconcile menggunakan outbound provider identity atau deterministic idempotency key.
6. Audit memakai correlation yang sama dan UUID inbound anchor.
7. Worker lama hanya menjadi compatibility adapter; tidak boleh memiliki SQL persistence sendiri.

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

Process 02 dilanjutkan dengan **canonical identity hardening dan migrasi worker lama ke seam canonical**. Tahap ini tidak membuat jalur Inbox kedua: `src/core/inbox-worker.js` sekarang hanya compatibility adapter ke `runCanonicalInboundLifecycle()`.

### Identity graph executable

`inbound_id → conversation_id → outbox_id → outbound_provider_message_id / idempotency_key → correlation_id`

Implementasi berada pada `src/core/lifecycle-integrity.js` dan `src/core/canonical-message-lifecycle.js`. Delivery reconciliation merekonstruksi graph dari durable `message_outbox` + `message_inbox`, sehingga retry tidak kehilangan identitas.

### Audit subject anchor

Karena `audit_events.subject_id` bertipe UUID sementara `conversation_id` bertipe text, audit tidak lagi mencoba menulis conversation text ke `subject_id`. Semua lifecycle audit menggunakan `inbound_id` sebagai UUID anchor dan menyimpan `conversation_id`/ `outbox_id`/ provider identity di `after_json`.

### Worker migration

`claimAndProcessInbound()` tetap tersedia untuk compatibility, tetapi seluruh persistence telah dihapus dari worker. Ia hanya memetakan callback legacy ke bentuk `processConversation` lalu memanggil canonical lifecycle. Dengan demikian tidak ada jalur kedua untuk Inbox atau Outbox.

## Remaining evidence gates

1. Execute complete static/unit suite in a healthy runner.
2. Execute PostgreSQL integration against reference/test schema.
3. Verify composed WhatsApp webhook E2E, including duplicate/terminal callback behavior and rollback.
4. Obtain hosted CI evidence.
5. Only after evidence gates pass, evaluate separate production migration needs for any future dedicated conversation UUID or delivery identity fields.
