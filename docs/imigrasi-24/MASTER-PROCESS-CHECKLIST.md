# IMIGRASI24JAM — Master Process & System Checklist

**Status:** Operational Guidance Baseline v1.0  
**Repository:** `galleryabah-source/Imigrasi24jam`  
**Purpose:** Panduan utama proses pengembangan Imigrasi24jam setelah architectural review.

## 1. Positioning

Imigrasi24jam adalah platform layanan keimigrasian 24 jam berbasis percakapan, bukan chatbot umum.

Prinsip utama:

- Database-first.
- AI-optional.
- Official-source grounded.
- Immigration-only domain.
- Human governance.
- Auditable.
- Provider-independent.
- Graceful degradation.

AI tidak boleh menjadi single point of failure.

## 2. Canonical Service Pipeline

Seluruh pengembangan harus diarahkan ke satu alur produksi kanonik:

`CHANNEL → INGRESS → SECURITY → INBOX → CONVERSATION → DOMAIN GUARD → NORMALIZATION → INTENT → KNOWLEDGE RETRIEVAL → POLICY → RESPONSE SAFETY → RESPONSE → OUTBOX → PROVIDER → DELIVERY → AUDIT → ANALYTICS`

Untuk pertanyaan yang tidak dapat dijawab secara deterministik:

`DETERMINISTIC PATH → INSUFFICIENT → AI ROUTER → VALIDATION → RESPONSE`

Jika AI tidak tersedia:

`CACHE → ANSWER DATABASE → POLICY → SAFE RESPONSE / HUMAN HANDOFF`

Tidak boleh ada ketergantungan AI untuk known-service questions.

## 3. Master Development Checklist

### 01 — Governance

- [ ] Service catalog
- [ ] Domain policy
- [ ] Data classification
- [ ] Change management
- [ ] Regulation lifecycle
- [ ] Owner/authority approval model

### 02 — Knowledge

- [ ] Services
- [ ] Intents
- [ ] Question patterns
- [ ] Synonyms
- [ ] Answers
- [ ] Sources
- [ ] Legal basis
- [ ] Policies
- [ ] Versions
- [ ] Review
- [ ] Approval
- [ ] Publication
- [ ] Regression questions

### 03 — Conversation Engine

- [ ] Domain Guard
- [ ] Normalization
- [ ] Intent classification
- [ ] Exact/cache retrieval
- [ ] Pattern retrieval
- [ ] Keyword/full-text search
- [ ] Semantic retrieval where enabled
- [ ] Policy evaluation
- [ ] Response safety gate
- [ ] Human handoff
- [ ] Safe fallback

### 04 — WhatsApp

- [ ] Provider abstraction
- [ ] Webhook contract
- [ ] Signature validation
- [ ] Replay protection
- [ ] Payload validation
- [ ] Rate limiting
- [ ] Idempotency
- [ ] Inbox
- [ ] Conversation processing
- [ ] Outbox
- [ ] Retry
- [ ] Delivery status
- [ ] Delivery audit

### 05 — Document Intelligence

- [ ] Upload
- [ ] Hash/checksum
- [ ] Metadata
- [ ] PUBLIC / PRIVATE-INTERNAL / RESTRICTED classification
- [ ] Extraction
- [ ] Normalization
- [ ] Chunking/indexing
- [ ] Provenance
- [ ] Review
- [ ] Approval
- [ ] Publication
- [ ] Contextual attachment
- [ ] Backend attachment authorization
- [ ] Attachment audit

### 06 — Case Management

Complaints, reports, and assistance must be case workflows rather than ordinary chatbot responses.

- [ ] Complaint intake
- [ ] Violation-report intake
- [ ] Human assistance
- [ ] Case ID
- [ ] Classification
- [ ] Assignment
- [ ] Status lifecycle
- [ ] Attachments
- [ ] Case events
- [ ] Escalation
- [ ] Resolution
- [ ] Closure
- [ ] Case audit

Sensitive reports must not be treated as proof of guilt or legal findings.

### 07 — Admin / Control Center

Target control center:

- [ ] Dashboard
- [ ] Conversations
- [ ] Cases
- [ ] Complaints
- [ ] Reports
- [ ] Knowledge CMS
- [ ] Documents
- [ ] Policies
- [ ] Regulation/change management
- [ ] WhatsApp monitoring
- [ ] AI configuration
- [ ] Offices
- [ ] Services
- [ ] Analytics
- [ ] Audit
- [ ] Users
- [ ] Roles
- [ ] Permissions
- [ ] System health

### 08 — AI Layer

- [ ] AI Gateway
- [ ] Provider adapters
- [ ] Model registry
- [ ] Provider health
- [ ] Failover policy
- [ ] Prompt/version registry
- [ ] AI request audit
- [ ] Usage/cost tracking
- [ ] Output validation
- [ ] AI regression dataset
- [ ] AI OFF mode
- [ ] AI-generated knowledge provenance

AI-generated knowledge must pass validation and authorized approval before publication.

### 09 — Security

- [ ] Authentication
- [ ] RBAC
- [ ] Object-level authorization
- [ ] Webhook security
- [ ] Replay protection
- [ ] Rate limiting
- [ ] Input validation
- [ ] Output sanitization
- [ ] Prompt-injection resistance
- [ ] Domain Guard bypass resistance
- [ ] Secret isolation
- [ ] PII protection
- [ ] Encryption
- [ ] Audit integrity
- [ ] Document access control
- [ ] Attachment authorization
- [ ] Retention policy
- [ ] Backup
- [ ] Restore test

### 10 — Observability

Metrics should include at least:

- messages_received
- messages_processed
- messages_failed
- deterministic_answers
- ai_answers
- human_handoff
- unknown_questions
- domain_rejected
- complaints_created
- reports_created
- response_latency
- provider_latency
- provider_failure
- outbox_retry
- delivery_failure

Health checks:

- WhatsApp
- Database
- Knowledge
- Search
- AI provider
- Outbox/worker
- Storage

### 11 — Testing / Release

- [ ] Unit tests
- [ ] Integration tests
- [ ] Security regression
- [ ] E2E tests
- [ ] AI-OFF test
- [ ] Provider failure test
- [ ] Duplicate/replay test
- [ ] Stale/expired knowledge test
- [ ] Mixed-domain test
- [ ] Prompt-injection test
- [ ] Backup test
- [ ] Restore test
- [ ] Production smoke test
- [ ] Evidence recorded

## 4. Canonical Business Processes

### Information

`USER → DOMAIN → INTENT → KNOWLEDGE → POLICY → ANSWER → AUDIT`

### Complaint

`USER → CLASSIFY → CASE → DATA → VALIDATE → ROUTE → OFFICER → STATUS → RESOLUTION → AUDIT`

### Violation report

`REPORT → MINIMUM DATA → CLASSIFY → CASE → CONFIDENTIAL ROUTING → AUTHORIZED REVIEW → ESCALATION → AUDIT`

The system must not independently conclude that a person is guilty based solely on a user report.

### Knowledge lifecycle

`SOURCE → DOCUMENT → VERSION → EXTRACT → NORMALIZE → KNOWLEDGE → REVIEW → APPROVAL → PUBLISH`

### Regulation change

`NEW/CHANGED REGULATION → VERSION → IMPACT ANALYSIS → AFFECTED ANSWERS/POLICIES/WORKFLOWS/TESTS → REVIEW → APPROVAL → PUBLISH → REGRESSION TEST`

## 5. Recommended Execution Order

Do not expand features randomly. Continue in this order:

### F0 — Governance & Domain
- [ ] Service catalog
- [ ] Domain Guard
- [ ] Policy model
- [ ] RBAC model
- [ ] Audit model
- [ ] Data classification

### F1 — Knowledge Foundation
- [ ] Service
- [ ] Intent
- [ ] Question pattern
- [ ] Answer
- [ ] Source
- [ ] Legal basis
- [ ] Version
- [ ] Approval
- [ ] Publication

### F2 — Deterministic Answer Engine
- [ ] Normalize
- [ ] Intent
- [ ] Search
- [ ] Policy
- [ ] Answer
- [ ] AI-OFF operational proof

### F3 — WhatsApp Production Pipeline
- [ ] Webhook
- [ ] Security
- [ ] Inbox
- [ ] Conversation
- [ ] Answer
- [ ] Outbox
- [ ] Provider
- [ ] Audit

### F4 — Case Management
- [ ] Complaint
- [ ] Violation report
- [ ] Human handoff
- [ ] Assignment
- [ ] Status
- [ ] Resolution
- [ ] Audit

### F5 — Document Intelligence
- [ ] Upload
- [ ] Extraction
- [ ] Classification
- [ ] Provenance
- [ ] Knowledge extraction
- [ ] Approval
- [ ] Publication
- [ ] Attachment policy

### F6 — Control Center
- [ ] Admin dashboard
- [ ] Knowledge CMS
- [ ] Case center
- [ ] WhatsApp monitor
- [ ] AI settings
- [ ] Audit
- [ ] System health

### F7 — AI Layer
- [ ] AI Gateway
- [ ] RAG/retrieval
- [ ] Validation
- [ ] Provider failover
- [ ] AI governance

### F8 — Authorized Transactional Integration
- [ ] Official service/status APIs
- [ ] Appointment/status where authorized
- [ ] Ticket tracking
- [ ] Notifications
- [ ] Expanded WNA workflows

## 6. Current Repository Assessment

The repository already contains architecture and implementation foundations for:

- provider-agnostic WhatsApp contracts;
- webhook contract and security tests;
- mock WhatsApp provider;
- inbox gateway;
- conversation pipeline;
- outbound pipeline;
- deterministic knowledge-answer pipeline;
- database-first architecture;
- domain guard design;
- governance;
- controlled document visibility/attachment policy.

The remaining work should focus on converting these foundations into one cohesive, operational production system and filling the knowledge, case-management, control-center, security, observability, and release-evidence gaps.

## 7. Release Gate

A feature is not COMPLETE merely because code exists.

Definition of Done:

`IMPLEMENT → UNIT TEST → INTEGRATION TEST → REGRESSION → SECURITY → FAILURE PATH → AUDIT EVIDENCE → DEPLOY TEST → SMOKE TEST → PRODUCTION`

Every production change must preserve:

1. AI independence for known services.
2. Immigration-only scope.
3. Official-source authority.
4. Human approval for authoritative knowledge.
5. Deterministic/versioned policies.
6. Auditability.
7. Backend authorization.
8. Provider independence.
9. Graceful degradation.
10. Reversibility and evidence.

## 8. Immediate Next Direction

After this baseline is committed, future work should begin by auditing the repository against this checklist and marking every item:

`PASS / PARTIAL / NOT IMPLEMENTED / BLOCKED`

Do not add unrelated features until the relevant checklist gap is identified and its acceptance criteria are defined.

---

**Baseline recorded:** 2026-09-25  
**Document:** `docs/imigrasi-24/MASTER-PROCESS-CHECKLIST.md`
