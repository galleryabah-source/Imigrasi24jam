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
- [x] Test regression untuk admission ordering
- [ ] Hosted CI runner sehat
- [ ] PostgreSQL integration suite PASS di hosted CI
- [ ] End-to-end WhatsApp provider verification

## Urutan berikutnya

Process 02 dilanjutkan dengan audit **Conversation State → Outbox Atomicity → Lease Ownership → Provider Delivery → Delivery Status → Audit**, tanpa memecahnya menjadi sistem-sistem terpisah.
