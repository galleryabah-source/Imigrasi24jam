# IMIGRASI 24JAM — Master Blueprint

**Status:** Living Baseline v1.2  
**Repository:** `galleryabah-source/Imigrasi24jam`  
**Purpose:** Pedoman induk untuk merancang layanan percakapan keimigrasian 24/7 melalui WhatsApp.

## 1. Vision

IMIGRASI 24JAM adalah **Conversational Immigration Service Platform** untuk membantu masyarakat dan WNA memperoleh informasi, bantuan layanan, pengaduan, dan kanal pelaporan terkait bidang keimigrasian melalui WhatsApp 24 jam.

Platform **bukan chatbot umum**. Sistem wajib membatasi ruang percakapan pada domain keimigrasian dan layanan yang secara resmi ditetapkan dalam scope produk.

## 2. Core Principle — AI Optional by Architecture

Sistem **WAJIB tetap berfungsi untuk layanan yang sudah diketahui walaupun seluruh provider AI tidak tersedia**.

Primary path:

`WhatsApp → Gateway → Domain Guard → Intent/Search → Cache → Official Answer Database → Policy Engine → Response`

Complex/unknown immigration path:

`Immigration Query → AI Router → Provider A/B/Local AI → Validation → Response`

Non-immigration path:

`Non-Immigration Query → Scope Guard → Safe Boundary Response`

## 3. Immigration-Only Domain Guard

Imigrasi24JAM harus mempunyai **Domain Guard** di depan conversation engine. Domain Guard memastikan sistem tidak berubah menjadi general-purpose chatbot.

### Allowed domains

- Layanan keimigrasian
- Paspor dan dokumen perjalanan dalam cakupan resmi
- Visa dan informasi keimigrasian
- Izin tinggal dan layanan WNA
- Persyaratan, prosedur, tarif, lokasi, jam, kanal, dan informasi layanan resmi
- Status layanan yang tersedia melalui integrasi resmi
- Pengaduan pelayanan keimigrasian
- Laporan dugaan pelanggaran keimigrasian/WNA melalui kanal yang ditetapkan
- Permintaan bantuan/eskalasi terkait layanan keimigrasian
- Informasi kantor dan kanal resmi keimigrasian

### Out-of-domain

Pertanyaan yang tidak berhubungan dengan keimigrasian harus ditolak secara sopan dan diarahkan kembali ke layanan Imigrasi24JAM.

## 4. Answer Database First

Jawaban resmi harus dapat disimpan sebagai data terstruktur, bukan hanya prompt AI.

Minimal metadata:

- answer_id
- intent
- question_patterns
- synonyms
- answer_id
- answer_en
- service
- source
- legal_basis
- effective_from
- effective_until
- version
- status
- approved_by
- approved_at
- last_reviewed

Status lifecycle:

`DRAFT → REVIEW → APPROVED → PUBLISHED → EXPIRED → ARCHIVED`

## 5. Knowledge Ingestion & Document Intelligence

Admin/petugas harus dapat memasukkan knowledge secara manual melalui form maupun mengunggah sumber dalam format yang didukung, termasuk PDF, PPTX, DOCX, XLSX/CSV, TXT, dan format lain yang ditetapkan.

Pipeline:

`Manual Entry / Upload → Validation → Metadata → Extraction → Normalization → Deterministic Indexing → Optional AI Enrichment → Human Review → Approval → Publish`

Sistem harus menyimpan sumber asli, hash/checksum, metadata, provenance, versi, tanggal berlaku, status akses, status approval, dan audit trail.

### Document access classification

Saat upload, admin/petugas **WAJIB memilih klasifikasi akses**:

- `PUBLIC` — dapat digunakan sebagai sumber informasi publik; dapat dilampirkan ke WhatsApp hanya jika juga memenuhi aturan attachment dan status publikasi.
- `PRIVATE / INTERNAL` — hanya untuk petugas/admin; **tidak boleh dilampirkan atau dikirim melalui WhatsApp kepada masyarakat**.
- `RESTRICTED` — terbatas berdasarkan permission; **deny-by-default untuk attachment publik**.

Klasifikasi akses dan hak attachment harus disimpan sebagai atribut backend, bukan hanya checkbox frontend.

Contoh policy:

`PUBLIC + APPROVED/PUBLISHED + ALLOW_WHATSAPP_ATTACHMENT=true + RELEVANT_TO_CONTEXT → attachment permitted`

`PRIVATE/INTERNAL → attachment denied`

`RESTRICTED → attachment denied by default unless an explicitly authorized workflow permits it`

Backend **WAJIB melakukan authorization check sebelum memanggil WhatsApp send-media API**. Manipulasi request frontend tidak boleh dapat melewati kontrol tersebut.

## 6. Contextual Document Attachment Engine

Sistem dapat mengaitkan dokumen publik yang telah disetujui dengan intent, topic, service, policy, dan konteks percakapan.

Pipeline:

`User Query → Intent/Topic → Knowledge Search → Relevant Public Documents → Access/Approval Check → Attachment Policy → WhatsApp Response`

Mesin tidak boleh mengirim dokumen hanya karena nama file cocok. Dokumen harus relevan, approved/published, berstatus publik, dan lolos policy attachment.

Dokumen internal petugas tidak boleh bocor melalui chatbot.

## 7. Mass Knowledge Generation / Answer Factory

Target utama bukan membuat FAQ manual satu per satu, tetapi membangun mesin yang dapat memperbanyak coverage pengetahuan secara terkontrol.

`Official Source → Extract → Normalize → Generate Questions → Generate Synonyms → Generate Answer Drafts → Generate Test Cases → Human Review → Approved Database`

AI dapat digunakan ketika tersedia untuk mempercepat proses tersebut. Hasil AI **tidak otomatis menjadi kebenaran** dan harus melewati governance/approval sebelum publikasi.

## 8. Knowledge Harvesting ketika AI Tersedia

Jika provider AI tersedia:

`AI Connected → Analyze Source/Question → Generate/Improve Knowledge → Validate → Review → Store → Reuse`

Tujuan utamanya adalah mengubah penggunaan AI menjadi aset database jangka panjang.

## 9. AI-Disconnected Operation

Jika AI API terputus, habis kuota, tidak tersedia, atau sengaja dinonaktifkan:

`WhatsApp → Domain Guard → Intent/Search → Cache → Answer DB → Policy Engine → Response`

Pertanyaan kompleks yang tidak dapat dijawab secara aman harus masuk ke safe fallback/human handoff, bukan dibuat-buat.

## 10. Policy Engine

Aturan kritis seperti tarif, persyaratan, eligibility, masa berlaku, kewenangan kantor, batasan layanan, serta hak penggunaan dokumen publik harus dapat ditegakkan secara deterministik.

LLM tidak boleh menjadi sumber kebenaran tunggal.

## 11. Knowledge Governance

AI boleh membantu mengekstrak regulasi, membuat draft FAQ, membuat variasi pertanyaan, membuat embedding, dan menghasilkan test cases. AI **tidak boleh langsung menerbitkan aturan/jawaban hukum ke publik**.

`Official Source → AI-assisted Draft → Human/Authorized Review → Approval → Publish`

## 12. Resilience / Graceful Degradation

Fallback berlapis:

1. Response cache
2. Answer database
3. Search / rules
4. AI provider router
5. Secondary AI provider
6. Local AI (opsional)
7. Human handoff / safe fallback

Kegagalan AI tidak boleh menghasilkan kegagalan total layanan.

## 13. AI Provider Abstraction

AI harus diakses melalui abstraction layer agar provider dapat diganti tanpa mengubah conversation engine, knowledge base, database, atau business logic.

`AI Gateway → Provider Adapter → Model`

## 14. Core Modules

- WhatsApp Gateway
- Domain Guard / Immigration Scope Engine
- Conversation Engine
- Intent Engine
- Answer Database
- Question Pattern Database
- Knowledge Base
- Document Ingestion Engine
- Document Access Control
- Contextual Document Attachment Engine
- Knowledge Compiler / Answer Factory
- Policy Engine
- AI Router
- Response Safety Gate
- Human Handoff
- Complaint/Ticketing
- Immigration Violation Reporting
- Office Directory
- Passport Services
- WNA Services
- Notification Engine
- Analytics
- Question Intelligence
- Audit Trail
- Security/RBAC
- Administration / Knowledge Control Center

## 15. Complaint and Violation Reporting Guardrails

Pengaduan atau laporan pelanggaran harus diperlakukan sebagai **case workflow**, bukan sekadar chatbot response.

Sistem harus:

- mengumpulkan informasi minimum yang diperlukan;
- membedakan informasi, pengaduan, dan laporan;
- memberikan nomor tiket/case ID bila workflow mendukungnya;
- tidak menyimpulkan seseorang bersalah hanya berdasarkan laporan pengguna;
- tidak mengungkap data pelapor kepada pihak yang tidak berwenang;
- melakukan escalation sesuai SOP;
- menyimpan audit trail;
- memberikan status hanya jika tersedia sumber/status resmi.

## 16. Question Intelligence

`Conversation → Classify → Aggregate → Identify Knowledge Gap → Draft Improvement → Review → Publish`

Sistem dapat mendeteksi pertanyaan populer, pertanyaan gagal, istilah baru, perubahan pola kebutuhan, kebingungan layanan, dan tren pengaduan.

## 17. Regulation Change & Impact Management

Peraturan pemerintah dan kebijakan keimigrasian diperlakukan sebagai **living knowledge**.

Perubahan harus mendukung:

`New Source → Version → Impact Analysis → Affected Policies/Answers/FAQs/Workflows → Review → Approval → Publish`

Versi lama tidak dihapus tanpa jejak; statusnya dapat menjadi `SUPERSEDED`/`EXPIRED`/`ARCHIVED` sesuai kebijakan.

Setiap perubahan penting harus memiliki change record, alasan, sumber, approver, timestamp, dan audit trail.

## 18. Change Governance

Blueprint dan roadmap adalah **living documents**, bukan spesifikasi beku. Perubahan dapat dilakukan atas persetujuan owner serta berdasarkan audit, koreksi, security finding, testing, kebutuhan operasional, atau perubahan kebijakan pemerintah.

Perubahan mengikuti prinsip:

`Proposal → Review → Owner Approval → Implement → Test → Audit → Deploy → Update Baseline`

Emergency regulatory changes dapat memakai jalur emergency change dengan validasi dan audit setelah implementasi.

## 19. Future-proofing for 5+ Years

Keep these contracts stable:

- canonical service model
- domain/scope model
- knowledge schema
- policy schema
- question/intent schema
- conversation/message model
- case/ticket model
- document/provenance model
- audit model
- integration API contracts
- AI provider abstraction

Technology components such as LLM provider, embedding model, vector store, frontend framework, storage provider, and deployment platform may be replaced independently.

## 20. Non-Negotiable Principles

1. AI provider is never a single point of failure.
2. Known questions remain serviceable with AI disabled.
3. Official sources are authoritative.
4. AI-generated knowledge requires approval before publication.
5. Business rules are versioned and deterministic where appropriate.
6. The system is restricted to the approved immigration domain.
7. Sensitive decisions remain under authorized human control.
8. Every consequential response is auditable.
9. No vendor lock-in at the application architecture level.
10. Validated AI-generated knowledge should become reusable structured data whenever appropriate.
11. Public documents may be attached only after backend access/approval/attachment checks.
12. Private/internal documents must never be exposed through the public chatbot.
13. Regulation and policy changes must be versioned, impact-analysed, reviewed, and auditable.

## 21. Brainstorming Rule

This document is the current baseline, not a frozen final specification. New ideas may extend or refine the architecture, provided they preserve official-source grounding, AI optionality, graceful degradation, security, auditability, human accountability, strict immigration-domain boundaries, controlled document publication, and owner-approved change governance.
