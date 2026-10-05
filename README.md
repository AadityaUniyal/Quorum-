# 🏛️ Quorum OS

<div align="center">

**The Enterprise Operating System for Autonomous Financial & Legal Document Verification**

[![Production Live](https://img.shields.io/badge/Production-Live%20on%20Vercel-0071E3?style=for-the-badge&logo=vercel&logoColor=white)](https://frontend-brown-seven-19.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20Turbopack-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Neon Postgres](https://img.shields.io/badge/Database-Neon%20Postgres-00E599?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![Groq LPU](https://img.shields.io/badge/Inference-Groq%20750%20tps-F55036?style=for-the-badge&logo=groq&logoColor=white)](https://groq.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

[Live Production App](https://frontend-brown-seven-19.vercel.app) • [Core Problem](#-the-140b-enterprise-problem) • [Pillars](#-architectural-pillars) • [7-Agent Consensus](#-7-agent-consensus-mesh) • [Deterministic Math](#-deterministic-arithmetic-core) • [Quickstart](#-quickstart-guide) • [Database Architecture](#-neon-postgresql-architecture) • [ERP Integration](#-certified-erp-ledger-dispatch)

</div>

---

## 🌟 Executive Summary

Across Global 2000 enterprises, more than **$140 Billion** is lost annually to undetected billing errors, regulatory non-compliance, invoice overcharges, and slow manual audits. 

Traditional single-model LLMs and legacy OCR engines suffer from **probabilistic arithmetic hallucinations**, context drift, and zero spatial provenance. **Quorum OS** solves this by unifying **7 autonomous specialized AI agents**, **high-speed Groq LPU + Gemini 2.0 Flash hybrid inference**, and **deterministic Python Decimal arithmetic** into an **Apple Human Interface Guidelines (HIG)**-grade operating platform.

---

## 💥 The $140B Enterprise Problem

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│       LEGACY SINGLE-MODEL LLMs       │     │              QUORUM OS               │
├──────────────────────────────────────┤     ├──────────────────────────────────────┤
│ ❌ Probabilistic math approximation  │     │ ✅ Deterministic Decimal (Δ == 0.00) │
│ ❌ Ungrounded text without proof     │ ──▶ │ ✅ 2D Spatial Coordinate Provenance  │
│ ❌ Single-engine hallucination bias  │     │ ✅ 7-Agent Adversarial Consensus     │
│ ❌ Manual copy-paste into ERPs       │     │ ✅ 1-Click SAP/NetSuite/QBO Dispatch │
│ ❌ Bloated seeded/fake data mockups  │     │ ✅ Pure Clean-Slate Per-User State   │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
```

---

## 🏛️ Architectural Pillars

```
                                  ┌───────────────────────────┐
                                  │      DOCUMENT INGEST      │
                                  │    PDF / Image / Scan     │
                                  └─────────────┬─────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │       GROQ LPU ENGINE       │                   │    GEMINI 2.0 FLASH CORE    │
        │   llama-3.3-70b-versatile   │                   │   Multimodal Spatial Vision │
        │   750 tokens / second       │                   │   Complex Table & Seal OCR  │
        │   Sub-400ms Reasoning       │                   │   Coordinate Grounding      │
        └──────────────┬──────────────┘                   └──────────────┬──────────────┘
                       │                                                 │
                       └────────────────────────┬────────────────────────┘
                                                ▼
                                 ┌─────────────────────────────┐
                                 │   7-AGENT ARBITRATION MESH  │
                                 │   Deterministic Decimal Math│
                                 │   Δ == $0.00 Verification   │
                                 └──────────────┬──────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │    APPLE OBSIDIAN UI / HIG  │                   │    NEON PG ASYNC DATA MESH  │
        │    Kinetic Scroll Keynote   │                   │    GIN Indexed JSONB        │
        │    Passkey Biometric Auth   │                   │    Transactional Outbox     │
        │    Spatial Bounding Canvas  │                   │    Certified ERP Dispatch   │
        └─────────────────────────────┘                   └─────────────────────────────┘
```

### 1. 🤖 7-Agent Consensus Mesh
- **Extractor Agent**: Normalizes raw multi-column layout geometry into structured JSON schemas.
- **Critic Agent**: Cross-examines candidate fields against raw OCR tokens to eliminate hallucinations.
- **Auditor Agent**: Executes strict Python `decimal.Decimal` calculations ($Qty \times Price + Tax - Discount = Total$).
- **Compliance Agent**: Validates governing law, liability caps, and payment terms against corporate policy matrices.
- **Memory Agent**: Queries vector embeddings in ChromaDB to catch vendor price creep and duplicate invoices.
- **Summary Agent**: Synthesizes 2-sentence executive briefs with highlighted risk factors.
- **Reconciler Core**: Arbitrates divergent agent scoring to reach definitive mathematical consensus.

### 2. 📐 Deterministic Arithmetic Core ($\Delta == 0.00$)
- Python `decimal.Decimal` with `ROUND_HALF_UP` prevents floating-point rounding errors.
- Automatic support for US (`$1,234.50`) and European (`1.234,50 €`) notation.
- 3-Way Reconciliation matching Purchase Orders (PO), Goods Receipt Notes (GRN), and Invoices with zero variance.

### 3. 👁️ 2D Spatial Coordinate Provenance
- Maps all document coordinates onto a normalized $1000 \times 1000$ geometric grid.
- Hovering any line item in the table illuminates its exact visual bounding box on the original document canvas with sub-millisecond response.

### 4. 🍎 Apple-Grade Human Interface Guidelines & Minimalism
- **Cupertino Obsidian Theme**: Pitch Black (`#000000`), Deep Titanium (`#0A0A0C`, `#121217`), and Apple Sapphire (`#2997FF`).
- **Kinetic Scroll Storytelling**: Multi-stage typography transforms on scroll (*"Precision."* $\rightarrow$ *"Zero Drift."* $\rightarrow$ *"100% Provenance."* $\rightarrow$ *"Instant Dispatch."*).
- **Passkey / Biometric Auth**: Touch ID / Face ID hardware simulation with fluid segmented pill tabs.
- **Global Keyboard Shortcuts Suite**: Instant power-user controls via `?`, `⌘K`, `J`/`K`, `A` (Approve), `R` (Reject).

---

## ⚡ Quickstart Guide

### Prerequisites
- **Node.js**: $\ge 20.10.0$
- **Python**: $\ge 3.11$
- **PostgreSQL**: Neon PostgreSQL or local instance
- **API Keys**: Groq (`gsk_...`) and Gemini (`AQ...` / `AIza...`)

### 1. Clone Repository & Setup Environment
```bash
git clone https://github.com/aaditya-uniyal/Quorum.git
cd Quorum/Quorum-

# Configure Environment Variables
cp .env.example .env
```

Set your API keys in `.env`:
```env
GROQ_API_KEY=gsk_your_groq_key_here
GEMINI_API_KEY=AQ_your_gemini_key_here
DATABASE_URL=postgresql+asyncpg://user:pass@ep-cool-neon.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 2. Launch Backend (FastAPI + Neon Async Engine)
```bash
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

pip install -r ../requirements/requirements-base.txt
python -m app.init_neon_db
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Launch Frontend (Next.js 16 + React 19)
```bash
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Neon PostgreSQL Architecture

```sql
-- High-Performance GIN Indexes for Sub-Millisecond JSON Queries
CREATE INDEX IF NOT EXISTS idx_docs_extracted_fields_gin 
ON documents USING gin ((extracted_fields::jsonb));

CREATE INDEX IF NOT EXISTS idx_docs_reconciliation_gin 
ON documents USING gin ((reconciliation_result::jsonb));

CREATE INDEX IF NOT EXISTS idx_docs_audit_trail_gin 
ON documents USING gin ((audit_trail::jsonb));

-- Composite Index for Fast Per-User Multi-Tenant Isolation
CREATE INDEX IF NOT EXISTS idx_docs_user_status_created 
ON documents (user_id, status, created_at DESC);
```

---

## 🔗 Certified ERP Ledger Dispatch

Quorum compiles verified documents directly into standard double-entry accounting records:

```json
{
  "dispatch_id": "erp_post_884210",
  "vendor_id": "VEND_APEX_GLOBAL",
  "invoice_number": "INV-9042",
  "subtotal": 44000.00,
  "tax": 4400.00,
  "total_billed": 48400.00,
  "recalculated_total": 48400.00,
  "arithmetic_delta": 0.00,
  "verification_seal": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "status": "CERTIFIED_POSTED",
  "target_erp": "SAP_S4HANA_ODATA_V4"
}
```

---

## 🧪 Testing & Verification

Run the comprehensive test suite across backend agents and deterministic mathematics:

```bash
cd backend
pytest tests/ -v
```

---

## 📜 License & Compliance

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details. Built to satisfy SOC2 Type II, ISO 27001, and HIPAA compliance specifications.
