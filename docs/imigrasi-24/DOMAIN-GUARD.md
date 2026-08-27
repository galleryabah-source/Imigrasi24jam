# IMIGRASI 24JAM — Immigration-Only Domain Guard

**Status:** Design Baseline v1.0

## Objective
Memastikan kanal percakapan publik Imigrasi24jam tetap fokus pada bidang keimigrasian dan tidak berubah menjadi general-purpose chatbot.

## Allowed domains

### 1. Layanan Paspor
- paspor baru;
- penggantian paspor;
- paspor habis masa berlaku;
- paspor hilang/rusak;
- perubahan data;
- paspor anak;
- persyaratan;
- tarif;
- kantor layanan;
- appointment/status jika tersedia secara resmi.

### 2. Layanan WNA
- informasi visa;
- persyaratan visa;
- izin tinggal;
- ITAS;
- ITAP;
- re-entry;
- sponsor;
- perubahan/status izin tinggal;
- overstay;
- kewajiban pelaporan;
- informasi layanan keimigrasian untuk WNA.

### 3. Pengaduan & Laporan
- pengaduan layanan keimigrasian;
- keluhan pelayanan;
- laporan dugaan pelanggaran keimigrasian;
- laporan terkait keberadaan/kegiatan WNA yang diduga melanggar ketentuan;
- fraud/corruption report yang relevan dengan layanan keimigrasian;
- permintaan bantuan dan eskalasi layanan.

### 4. Informasi Operasional
- alamat/kontak kantor;
- jam layanan;
- layanan yang tersedia pada kantor tertentu;
- gangguan layanan resmi;
- petunjuk kanal layanan resmi.

## Domain classification

Setiap inbound message diproses melalui Domain Guard sebelum AI generatif digunakan.

Output minimum:

```text
domain = IMMIGRATION | OUT_OF_DOMAIN | AMBIGUOUS
intent = <registered intent or UNKNOWN>
confidence = <score>
```

## Out-of-domain behavior

Untuk pertanyaan di luar domain, sistem tidak menjawab sebagai general assistant. Sistem memberikan respons batasan yang singkat dan mengarahkan pengguna kembali ke layanan keimigrasian.

Contoh intent yang harus ditolak sebagai domain umum:
- resep makanan;
- berita umum;
- coding/programming umum;
- hubungan pribadi;
- hiburan;
- konsultasi umum non-imigrasi;
- permintaan pembuatan konten yang tidak terkait layanan imigrasi.

## Mixed-domain messages

Jika satu pesan mencampur topik imigrasi dan non-imigrasi, sistem hanya memproses bagian yang relevan dengan domain keimigrasian dan mengabaikan bagian non-imigrasi dengan boundary response yang aman.

## Sensitive report rule

Laporan tentang WNA atau dugaan pelanggaran tidak boleh diperlakukan sebagai penetapan kesalahan. Sistem hanya:

1. mengumpulkan informasi yang diperlukan menurut SOP;
2. membuat case/ticket bila sesuai;
3. meneruskan ke kanal/unit yang berwenang;
4. menjaga kerahasiaan dan akses sesuai policy;
5. tidak membuat kesimpulan hukum sendiri.

## AI boundary

Domain Guard harus dapat bekerja tanpa provider AI untuk pertanyaan yang dapat diklasifikasikan melalui rules, keywords, search, atau classifier lokal. AI boleh digunakan sebagai fallback untuk pesan ambigu, tetapi hasilnya tetap melewati domain policy.

## Test requirements

Regression test wajib mencakup:
- valid immigration questions;
- non-immigration questions;
- mixed questions;
- adversarial prompts yang mencoba mengubah bot menjadi general assistant;
- prompt injection yang mencoba melewati domain restriction;
- sensitive WNA reports;
- multilingual immigration questions.
