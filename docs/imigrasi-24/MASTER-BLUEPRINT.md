# IMIGRASI 24JAM — Master Blueprint

**Status:** Brainstorming Baseline v1.1  
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

Contoh kategori yang tidak menjadi scope:

- hiburan umum
- resep/konsultasi non-keimigrasian
- politik umum
- pendidikan umum
- coding/programming
- investasi/keuangan umum
- percakapan pribadi
- general-purpose assistant requests

### Important boundary

Sistem boleh memahami bahasa natural yang luas untuk menentukan apakah pertanyaan masih berkaitan dengan keimigrasian, tetapi **jawaban publik tetap dibatasi oleh domain dan sumber yang disetujui**.

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

## 5. Mass Knowledge Generation / Answer Factory

Target utama bukan membuat FAQ manual satu per satu, tetapi membangun mesin yang dapat memperbanyak coverage pengetahuan secara terkontrol.

Pipeline:

`Official Source → Extract → Normalize → Generate Questions → Generate Synonyms → Generate Answer Drafts → Generate Test Cases → Human Review → Approved Database`

Satu sumber resmi dapat menghasilkan banyak question patterns, intent mappings, answer variants, multilingual variants, policy references, dan regression test cases.

AI dapat digunakan ketika tersedia untuk mempercepat proses tersebut. Hasil AI **tidak otomatis menjadi kebenaran** dan harus melewati governance/approval sebelum publikasi.

## 6. Knowledge Harvesting ketika AI Tersedia

Jika provider AI tersedia, sistem dapat menjalankan **Knowledge Harvesting Mode**:

`AI Connected → Analyze Source/Question → Generate/Improve Knowledge → Validate → Review → Store → Reuse`

Tujuan utamanya adalah mengubah penggunaan AI menjadi aset database jangka panjang, sehingga nilai AI tidak hilang setelah satu response selesai.

## 7. AI-Disconnected Operation

Jika AI API terputus, habis kuota, tidak tersedia, atau sengaja dinonaktifkan:

`WhatsApp → Domain Guard → Intent/Search → Cache → Answer DB → Policy Engine → Response`

Pertanyaan kompleks yang tidak dapat dijawab secara aman harus masuk ke safe fallback/human handoff, bukan dibuat-buat oleh sistem.

## 8. Policy Engine

Aturan kritis seperti tarif, persyaratan, eligibility, masa berlaku, kewenangan kantor, dan batasan layanan harus dapat ditegakkan secara deterministik melalui policy engine.

LLM tidak boleh menjadi sumber kebenaran tunggal.

## 9. Knowledge Governance

AI boleh membantu mengekstrak regulasi, membuat draft FAQ, membuat variasi pertanyaan, membuat embedding, dan menghasilkan test cases. AI **tidak boleh langsung menerbitkan aturan/jawaban hukum ke publik**.

Flow:

`Official Source → AI-assisted Draft → Human/Authorized Review → Approval → Publish`

## 10. Resilience / Graceful Degradation

Fallback berlapis:

1. Response cache
2. Answer database
3. Search / rules
4. AI provider router
5. Secondary AI provider
6. Local AI (opsional)
7. Human handoff / safe fallback

Kegagalan AI tidak boleh menghasilkan kegagalan total layanan.

## 11. AI Provider Abstraction

AI harus diakses melalui abstraction layer agar provider dapat diganti tanpa mengubah conversation engine, knowledge base, database, atau business logic.

`AI Gateway → Provider Adapter → Model`

Provider dapat berubah; contract internal tetap stabil.

## 12. Core Modules

- WhatsApp Gateway
- Domain Guard / Immigration Scope Engine
- Conversation Engine
- Intent Engine
- Answer Database
- Question Pattern Database
- Knowledge Base
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

## 13. Initial Intent Domains

### Paspor

`PASSPORT_NEW`, `PASSPORT_REPLACEMENT`, `PASSPORT_EXPIRED`, `PASSPORT_LOST`, `PASSPORT_DAMAGED`, `PASSPORT_DATA_CHANGE`, `PASSPORT_CHILD`, `PASSPORT_STATUS`, `PASSPORT_REQUIREMENTS`, `PASSPORT_COST`, `PASSPORT_OFFICE`, `PASSPORT_APPOINTMENT`

### WNA

`VISA_INFORMATION`, `VISA_REQUIREMENT`, `VISA_EXTENSION`, `VISA_STATUS`, `STAY_PERMIT`, `ITAS`, `ITAP`, `REENTRY_PERMIT`, `SPONSOR`, `CHANGE_OF_STATUS`, `OVERSTAY`, `FOREIGNER_REPORT`

### Complaint / Reporting

`COMPLAINT`, `SERVICE_COMPLAINT`, `OFFICER_COMPLAINT`, `SYSTEM_COMPLAINT`, `FRAUD_REPORT`, `CORRUPTION_REPORT`, `FOREIGNER_REPORT`, `IMMIGRATION_VIOLATION_REPORT`, `EMERGENCY_IMMIGRATION_REPORT`

## 14. Complaint and Violation Reporting Guardrails

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

## 15. Safety Rules

- Never invent tariffs, requirements, legal bases, or service status.
- Never present AI speculation as official immigration policy.
- Non-immigration requests receive a safe scope-boundary response.
- Sensitive/complex cases require escalation according to policy.
- Individual legal/administrative decisions remain with authorized officers.
- Personal data must be minimized, protected, retained only according to approved policy, and audited.
- All consequential AI responses must be traceable to model/version, knowledge version, policy version, and source material.

## 16. Question Intelligence

Setiap pertanyaan dapat menjadi sumber peningkatan layanan tanpa menjadikan percakapan pengguna sebagai training bebas.

Pipeline:

`Conversation → Classify → Aggregate → Identify Knowledge Gap → Draft Improvement → Review → Publish`

Sistem dapat mendeteksi:

- pertanyaan paling sering;
- pertanyaan yang gagal dijawab;
- istilah masyarakat yang belum dikenal;
- perubahan pola kebutuhan;
- potensi kebingungan pada suatu layanan;
- tren pengaduan.

## 17. Future-proofing for 5+ Years

Keep these contracts stable:

- canonical service model
- domain/scope model
- knowledge schema
- policy schema
- question/intent schema
- conversation/message model
- case/ticket model
- audit model
- integration API contracts
- AI provider abstraction

Technology components such as LLM provider, embedding model, vector store, frontend framework, and deployment platform may be replaced independently.

## 18. Strategic Positioning

The product is not merely a WhatsApp chatbot. It is a **Conversational Immigration Service Platform**:

`WhatsApp = channel`

`Domain Guard = immigration boundary`

`Conversation Engine = interaction layer`

`Knowledge Base = source of truth`

`Answer Database = reusable service knowledge`

`Policy Engine = rule enforcement`

`AI = optional intelligence layer`

`Service Integrations = transaction layer`

`Case/Ticketing = operational layer`

`Analytics = service intelligence layer`

## 19. Non-Negotiable Principles

1. AI provider is never a single point of failure.
2. Known questions remain serviceable with AI disabled.
3. Official sources are authoritative.
4. AI-generated knowledge requires approval before publication.
5. Business rules are versioned and deterministic where appropriate.
6. The system is restricted to the approved immigration domain.
7. Sensitive decisions remain under authorized human control.
8. Every consequential response is auditable.
9. No vendor lock-in at the application architecture level.
10. Knowledge generated through AI should become reusable structured data whenever it is validated and approved.

## 20. Brainstorming Rule

This document is the current baseline, not a frozen final specification. New ideas may extend or refine the architecture, provided they preserve official-source grounding, AI optionality, graceful degradation, security, auditability, human accountability, and strict immigration-domain boundaries.
