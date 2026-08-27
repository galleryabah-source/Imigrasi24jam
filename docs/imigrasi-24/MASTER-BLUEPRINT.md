# IMIGRASI 24 — Master Blueprint

**Status:** Brainstorming Baseline v1.0  
**Repository:** `galleryabah-source/Imigrasi24jam`  
**Purpose:** Pedoman induk untuk merancang layanan percakapan keimigrasian 24/7 melalui WhatsApp.

## 1. Vision

IMIGRASI 24 adalah platform layanan percakapan digital yang memungkinkan masyarakat dan WNA memperoleh informasi keimigrasian 24 jam melalui WhatsApp, dengan AI sebagai lapisan opsional dan bukan single point of failure.

## 2. Core Principle — AI Optional by Architecture

Sistem **WAJIB tetap berfungsi untuk layanan yang sudah diketahui walaupun seluruh provider AI tidak tersedia**.

Primary path:

`WhatsApp → Gateway → Intent/Search → Cache → Official Answer Database → Policy Engine → Response`

Complex/unknown path:

`Unknown/Complex → AI Router → Provider A/B/Local AI → Validation → Response`

## 3. Answer Database First

Jawaban resmi harus dapat disimpan sebagai data terstruktur, bukan hanya prompt AI.

Minimal metadata:

- answer_id
- intent
- question_patterns
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

## 4. Knowledge Governance

AI boleh membantu mengekstrak regulasi, membuat draft FAQ, membuat variasi pertanyaan, dan membuat embedding. AI **tidak boleh langsung menerbitkan aturan/jawaban hukum ke publik**.

Flow:

`Official Source → AI-assisted Draft → Human/Authorized Review → Approval → Publish`

## 5. Policy Engine

Aturan kritis seperti tarif, persyaratan, eligibility, masa berlaku, kewenangan kantor, dan batasan layanan harus dapat ditegakkan secara deterministik melalui policy engine.

LLM tidak boleh menjadi sumber kebenaran tunggal.

## 6. Resilience / Graceful Degradation

Fallback berlapis:

1. Response cache
2. Answer database
3. Search / rules
4. AI provider router
5. Secondary AI provider
6. Local AI (opsional)
7. Human handoff / safe fallback

Kegagalan AI tidak boleh menghasilkan kegagalan total layanan.

## 7. AI Provider Abstraction

AI harus diakses melalui abstraction layer agar provider dapat diganti tanpa mengubah conversation engine, knowledge base, database, atau business logic.

Contoh konsep:

`AI Gateway → Provider Adapter → Model`

Provider dapat berubah; contract internal tetap stabil.

## 8. Core Modules

- WhatsApp Gateway
- Conversation Engine
- Intent Engine
- Answer Database
- Knowledge Base
- Knowledge Compiler
- Policy Engine
- AI Router
- Response Safety Gate
- Human Handoff
- Complaint/Ticketing
- Office Directory
- Passport Services
- WNA Services
- Notification Engine
- Analytics
- Audit Trail
- Security/RBAC
- Administration / Knowledge Control Center

## 9. Initial Intent Domains

### Paspor

`PASSPORT_NEW`, `PASSPORT_REPLACEMENT`, `PASSPORT_EXPIRED`, `PASSPORT_LOST`, `PASSPORT_DAMAGED`, `PASSPORT_DATA_CHANGE`, `PASSPORT_CHILD`, `PASSPORT_STATUS`, `PASSPORT_REQUIREMENTS`, `PASSPORT_COST`, `PASSPORT_OFFICE`, `PASSPORT_APPOINTMENT`

### WNA

`VISA_INFORMATION`, `VISA_REQUIREMENT`, `VISA_EXTENSION`, `VISA_STATUS`, `STAY_PERMIT`, `ITAS`, `ITAP`, `REENTRY_PERMIT`, `SPONSOR`, `CHANGE_OF_STATUS`, `OVERSTAY`, `FOREIGNER_REPORT`

### Complaint

`COMPLAINT`, `SERVICE_COMPLAINT`, `OFFICER_COMPLAINT`, `SYSTEM_COMPLAINT`, `FRAUD_REPORT`, `CORRUPTION_REPORT`, `FOREIGNER_REPORT`, `EMERGENCY_REPORT`

## 10. Safety Rules

- Never invent tariffs, requirements, legal bases, or service status.
- Sensitive/complex cases require escalation according to policy.
- Individual legal/administrative decisions remain with authorized officers.
- Personal data must be minimized, protected, retained only according to approved policy, and audited.
- All consequential AI responses must be traceable to model/version, knowledge version, policy version, and source material.

## 11. Future-proofing for 5+ Years

Keep these contracts stable:

- canonical service model
- knowledge schema
- policy schema
- conversation/message model
- audit model
- integration API contracts
- AI provider abstraction

Technology components such as LLM provider, embedding model, vector store, frontend framework, and deployment platform may be replaced independently.

## 12. Strategic Positioning

The product is not merely a WhatsApp chatbot. It is a **Conversational Immigration Service Platform**:

`WhatsApp = channel`

`Conversation Engine = interaction layer`

`Knowledge Base = source of truth`

`Policy Engine = rule enforcement`

`AI = optional intelligence layer`

`Service Integrations = transaction layer`

`Analytics = service intelligence layer`

## 13. Brainstorming Rule

This document is the current baseline, not a frozen final specification. New ideas may extend or refine the architecture, provided they preserve the principles of official-source grounding, AI optionality, graceful degradation, security, auditability, and human accountability.
