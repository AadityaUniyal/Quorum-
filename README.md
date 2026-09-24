# 📊 Quorum

<div align="center">

**Enterprise Document Analytics, Multi-Agent Consensus & Real-Time Financial Verification Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Neon Postgres](https://img.shields.io/badge/Database-Neon%20Postgres-00E599?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![Tests Passing](https://img.shields.io/badge/Tests-477%20Passed-brightgreen?style=for-the-badge)](tests/)

[Overview](#overview) • [Key Features](#key-features) • [Architecture](#architecture) • [Quickstart](#quickstart) • [Environment Config](#environment-config) • [API Reference](#api-reference) • [Testing](#testing) • [Repository Structure](#repository-structure) • [Architecture Docs](docs/architecture.md)

</div>

---

<a id="overview"></a>
## 🌟 Overview

In enterprise procurement, legal operations, accounts payable, and regulatory compliance, manual document inspection is slow, expensive, and hazardous. A single transposed digit on an invoice or an unverified governing law clause in a Master Services Agreement (MSA) exposes an enterprise to severe financial penalties and contractual liabilities.

Single-pass Large Language Models (LLMs) suffer from hallucinations, arithmetical blind spots, and context drift. **Quorum** solves this through **adversarial multi-agent verification** combined with **Neon Postgres analytics**:

- **Neon Postgres Analytics Engine**: Real-time SQL spend aggregations by vendor, category volume trends, average invoice values, and match rates.
- **Dynamic Anomaly Alerting**: Zero-cost, self-contained risk engine flagging price variances (>5%), low agent consensus (<80%), and high-spend invoice anomalies.
- **1-Click CSV & JSON Export**: Export vendor spend breakdowns and search results directly into spreadsheet formats for AP/Procurement teams.
- **Autonomous Multi-Agent Circle**: Extractor, Critic, Auditor, Compliance, Reconciler, Memory, and Summary agents evaluate documents in parallel.
- **Deterministic Decimal Arithmetic**: High-precision arithmetical validation across both US (`$1,234.50`) and European (`1.234,50 €`) notation systems.
- **Enterprise 3-Way Reconciliation**: Automated matching across Purchase Orders (PO), Goods Delivery Notes (DN), and Vendor Invoices down to the line item.
- **Real-Time Streaming Lifecycle**: Server-Sent Events (SSE) stream document processing progress and token-by-token RAG answers in real time.

---

<a id="key-features"></a>
## 🚀 Value Proposition & Core Features

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
41: │                                    QUORUM HIGHLIGHTS                                    │
42: ├───────────────────────────────┬───────────────────────────────┬─────────────────────────┤
43: │ 📊 Neon Postgres Analytics    │ 🔔 Real-Time Anomaly Alerts   │ 📥 1-Click CSV Export   │
44: │ Spend, volume & vendor stats  │ Self-contained risk engine    │ Direct spreadsheet output│
45: ├───────────────────────────────┼───────────────────────────────┼─────────────────────────┤
46: │ 🤖 7-Agent Consensus Pipeline │ 📐 Graduated Math Auditor     │ 🛡️ Zero-Trust PII Vault │
47: │ Multi-angle validation circle │ <0.5% warn, <5% pen, ≥5% fail │ Luhn & Mod-97 checksums │
48: ├───────────────────────────────┼───────────────────────────────┼─────────────────────────┤
49: │ 🔗 3-Way Reconciliation       │ 👁️ Spatial Grounding Canvas   │ 🔄 Transactional Outbox │
50: │ PO ↔ Delivery Slip ↔ Invoice  │ Word-level SVG bounding boxes │ Guaranteed delivery     │
51: └───────────────────────────────┴───────────────────────────────┴─────────────────────────┘
```

1. **Multi-Agent Consensus Pipeline**:
   - **Extractor Agent**: Normalizes raw OCR into structured JSON schemas.
   - **Critic Agent**: Cross-evaluates extracted candidate fields against raw OCR text tokens to detect hallucinations.
   - **Auditor Agent**: High-precision Python `Decimal` checks enforcing $\text{Subtotal} + \text{Tax} + \text{Shipping} - \text{Discount} == \text{Total}$ and line item consistency.
   - **Compliance Agent**: Validates mandatory clauses (governing law, Net 30 payment terms, ISO/RoHS/ASTM certifications).
   - **Reconciler Agent**: Adjudicates scoring divergences exceeding $0.30$ between Critic and Auditor.
   - **Memory Agent**: Identifies statistical price and volume anomalies against historical ChromaDB baseline vectors.
   - **Summary Agent**: Synthesizes a 3-sentence executive summary highlighting key entities and flags.
   - **Reflexive Debate Engine**: Triggers multi-turn Graph-of-Thoughts debate across contested fields until consensus converges.

2. **Hybrid RAG & Cross-Encoder Retrieval**:
   - Dual-branch search combining PostgreSQL full-text search (`tsvector` / `tsquery`) and ChromaDB vector embeddings (`all-MiniLM-L6-v2` or `gemini-embedding-001`).
   - Fused via **Reciprocal Rank Fusion** ($k=60$) and refined through **Two-Stage Reranking** (token overlap normalization + cross-encoder proximity span decay).

3. **Enterprise 3-Way Cross-Document Reconciliation**:
   - Compares Purchase Orders (PO), Goods Delivery Notes (DN), and Vendor Invoices.
   - Detects discrepancies: `MATCHED`, `PRICE_VARIANCE`, `QUANTITY_MISMATCH`, `MISSING_DELIVERY`, `UNORDERED_ITEM`, and `OVERBILLED`.
   - 1-click export to **QuickBooks Online**, **Xero**, **SAP S/4HANA**, and **Universal IDP JSON v2.0**.

4. **Real-Time Streaming**:
   - Full pipeline status updates streamed via Server-Sent Events (SSE) on channel `/api/streaming/documents/{id}/stream`.
   - Streaming conversational RAG with citation entailment verification via `/api/rag/stream`.

5. **Certified WCAG 2.1 AA Accessibility**:
   - Accessible modal dialogs powered by Radix UI primitives (`@radix-ui/react-dialog`) with active keyboard focus trapping and Escape key dismissal.
   - Screen-reader compatible status announcements (`role="status"`, `aria-live="polite"`).
   - Descriptive `aria-label` tags on all interactive controls and decorative icon suppression (`aria-hidden="true"`).

---

<a id="architecture"></a>
## 🏛️ High-Level Architecture

DocIntel AI is decoupled into an asynchronous, event-driven microservices architecture:

```mermaid
graph TB
    subgraph Frontend ["Frontend Layer (Next.js 14)"]
        UI["React SPA & Tailwind CSS"]
        API_CLIENT["Typed API Client (frontend/src/lib/api.ts)"]
        SSE_CLIENT["EventSource SSE / Streaming Consumer"]
        UI --> API_CLIENT
        UI --> SSE_CLIENT
    end

    subgraph Gateway ["API & Edge Gateway"]
        FASTAPI["FastAPI Application (backend/app/main.py)"]
        MIDDLEWARE["Middleware Pipeline<br/>(TraceID, SecurityHeaders, CORS, SlowAPI)"]
        FASTAPI --- MIDDLEWARE
    end

    subgraph StorageBroker ["State, Storage & Message Brokers"]
        PG[("PostgreSQL 15<br/>(Multi-Tenant Relational DB)")]
        REDIS[("Redis 7<br/>(Cache, Locks, Semaphores, Pub/Sub)")]
        RABBIT[("RabbitMQ 3<br/>(Durable Queues & DLX)")]
        CHROMA[("ChromaDB<br/>(Persistent Vector Store)")]
        MINIO[("MinIO / S3 / Local Disk<br/>(Object Document Storage)")]
    end

    subgraph BackgroundServices ["Async & Worker Services"]
        OUTBOX["Transactional Outbox Relay Loop<br/>(backend/app/services/outbox_relay.py)"]
        WORKER["RabbitMQ Worker Daemon<br/>(backend/app/worker.py)"]
        OCR_ENGINE["OCR & Layout Engine<br/>(pdfplumber / Tesseract)"]
        AGENT_CONSENSUS["Multi-Agent Consensus Pipeline<br/>(backend/app/agents/consensus.py)"]
    end

    subgraph ExternalAI ["Inference Providers"]
        GEMINI["Google Gemini 2.0 Flash / Vertex AI"]
        GROQ["Groq Llama-3.3-70b-versatile"]
        OLLAMA["Local Ollama Llama 3.1:8b"]
    end

    %% Communications
    API_CLIENT -->|"REST HTTP / Cookies / JWT"| FASTAPI
    SSE_CLIENT -->|"SSE GET /api/streaming/.../stream"| FASTAPI
    FASTAPI -->|"Read/Write (ORM/Alembic)"| PG
    FASTAPI -->|"Cache & Rate Limiting"| REDIS
    FASTAPI -->|"Outbox Events (PENDING)"| PG
    FASTAPI -->|"Storage PUT / GET"| MINIO
    FASTAPI -->|"Hybrid Search Query"| CHROMA

    OUTBOX -->|"Poll PENDING Events"| PG
    OUTBOX -->|"Publish AMQP Persistent Messages"| RABBIT
    OUTBOX -.->|"Mark PUBLISHED"| PG

    RABBIT -->|"Consume document_processing_queue"| WORKER
    WORKER -->|"Acquire Concurrency Semaphore"| REDIS
    WORKER -->|"Download Artifact"| MINIO
    WORKER -->|"Extract Text & Tables"| OCR_ENGINE
    WORKER -->|"Execute 7-Agent Evaluation"| AGENT_CONSENSUS
    AGENT_CONSENSUS -->|"Provider Fallback Chain"| GEMINI
    AGENT_CONSENSUS -->|"High-Speed Failover"| GROQ
    AGENT_CONSENSUS -->|"Offline Fallback"| OLLAMA
    WORKER -->|"Index 600-word Chunks"| CHROMA
    WORKER -->|"Publish Stage Events (Pub/Sub)"| REDIS
    REDIS -->|"Stream SSE Updates"| FASTAPI
    WORKER -->|"Save Extracted Fields & Audit Logs"| PG
```

> For deep architectural specifications, data models, state machines, and mathematical formulas, consult the comprehensive [Documentation Architecture](docs/architecture.md).

---

<a id="quickstart"></a>
## ⚡ Quickstart Guide

### Approach A: Docker Compose (Recommended)

Launch the complete 8-service topology (PostgreSQL, Redis, RabbitMQ, MinIO, Ollama, FastAPI Backend, Worker, and Next.js Frontend) in a single command:

```bash
# 1. Clone the repository
git clone https://github.com/AadityaUniyal/Googi.git
cd Googi

# 2. Configure environment
cp .env.example .env

# 3. Launch the container stack
docker compose up --build -d
```

#### Service Endpoints & Consoles
| Service | URL | Default Credentials | Purpose |
|---|---|---|---|
| **Web Portal** | [http://localhost:3000](http://localhost:3000) | Instant Demo Login Button | Next.js Frontend UI |
| **API & Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | N/A | Interactive REST API documentation |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | `guest` / `guest` | AMQP Queue metrics & DLQ inspection |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `minioadmin` / `minioadmin` | Object document storage browser |
| **Ollama Local AI** | [http://localhost:11434](http://localhost:11434) | N/A | Self-hosted LLM inference endpoint |

To verify cluster health:
```bash
docker compose ps
curl http://localhost:8000/health/ready
```

To tear down:
```bash
docker compose down
# To purge volume data:
docker compose down -v
```

---

### Approach B: Local Development Setup

#### Prerequisites
- **Python 3.11+**
- **Node.js 20+** and **npm 10+**
- **Tesseract OCR** (`apt-get install tesseract-ocr` or `brew install tesseract`)
- Running PostgreSQL (or SQLite fallback) and Redis instance

#### 1. Backend & Worker Setup
```bash
# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env

# Apply database schema migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

In a separate terminal (with `.venv` active):
```bash
# Start background queue processing worker
python -m app.worker
```

#### 2. Frontend Setup
```bash
cd frontend

# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000). Click **"Demo Account"** on the sign-in screen for instant access to pre-configured enterprise auditor permissions.

---

<a id="environment-config"></a>
## ⚙️ Environment Configuration Matrix

The platform is configured via environment variables. See [`.env.example`](.env.example) for a complete template:

| Variable | Default (Local / Compose) | Production Recommended | Description |
|---|---|---|---|
| `ENVIRONMENT` | `development` | `production` | Deployment mode (`development`, `testing`, `production`) |
| `DEBUG` | `true` | `false` | Enables verbose stack traces and debug endpoints |
| `DATABASE_URL` | `postgresql://postgres:postgrespassword@localhost:5432/docintel` | `postgresql://user:pass@host:5432/docintel?sslmode=require` | Relational DB connection string (supports SQLite fallback) |
| `JWT_SECRET_KEY` | `dev_insecure_secret_key_min_32_chars` | `openssl rand -hex 32` | HMAC-SHA256 secret for JWT signing |
| `JWT_SECRET_KEYS_ROTATION` | `""` | Comma-separated keys | Allowed legacy keys for seamless rotation |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | `15` | Access token lifespan |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | `7` | Refresh token lifespan |
| `STORAGE_BACKEND` | `local` | `minio` or `s3` | Object storage backend (`local`, `minio`, `s3`) |
| `STORAGE_LOCAL_DIR` | `./uploads` | `/app/uploads` | Filesystem directory for local storage |
| `MINIO_ENDPOINT` | `localhost:9000` (compose: `minio:9000`) | S3 endpoint URL | MinIO/S3 API endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | IAM access key | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | IAM secret key | MinIO secret key |
| `RABBITMQ_HOST` | `localhost` (compose: `rabbitmq`) | Cluster / CloudAMQP host | RabbitMQ AMQP host |
| `RABBITMQ_PORT` | `5672` | `5672` | RabbitMQ AMQP port |
| `RABBITMQ_USER` | `guest` | Provisioned user | RabbitMQ username |
| `RABBITMQ_PASS` | `guest` | Provisioned password | RabbitMQ password |
| `REDIS_HOST` | `localhost` (compose: `redis`) | Cluster / Upstash host | Redis cache & rate limiter host |
| `REDIS_PORT` | `6379` | `6379` | Redis port |
| `REDIS_PASSWORD` | `""` | Strong auth password | Redis password |
| `LLM_PREFERRED_PROVIDER` | `gemini` | `gemini` | Primary AI provider (`gemini`, `groq`, `local`) |
| `GEMINI_API_KEY` | `""` | Google AI Studio Key | Google Gemini 2.0 Flash API key |
| `GROQ_API_KEY` | `""` | Groq Cloud Key | Ultra-fast Groq Llama-3.3 inference key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` (compose: `http://ollama:11434`) | Cluster GPU URL | Local Ollama endpoint |
| `LLM_FALLBACK_ENABLED` | `true` | `true` | Cascading provider fallback chain |
| `LLM_OFFLINE_MOCK_FALLBACK` | `true` (dev) | `false` (prod) | Deterministic mock engine if LLMs offline |
| `OUTBOX_RELAY_ENABLED` | `true` | `true` | Enables transactional outbox worker task |
| `CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | `https://your-domain.vercel.app` | Allowed CORS origins for browser clients |
| `BACKEND_URL` (Frontend) | `http://localhost:8000` (compose: `http://backend:8000`) | `https://api.yourdomain.com` | Upstream backend URL for Next.js proxy |

---

<a id="api-reference"></a>
## 📖 API & CLI Reference

Interactive OpenAPI / Swagger documentation is available at `/docs` (and ReDoc at `/redoc`).

### Key REST Endpoints

#### Authentication & Security
- `POST /api/auth/register` — Create new account with password strength enforcement.
- `POST /api/auth/login` — Authenticate and receive JWT access + refresh tokens in `HttpOnly` secure cookies.
- `POST /api/auth/refresh` — Refresh access token silently.
- `GET /api/auth/me` — Retrieve current authenticated user profile and roles.
- `POST /api/auth/2fa/setup` & `POST /api/auth/2fa/verify` — Enable TOTP 2-Factor Authentication.
- `POST /api/auth/apikeys` & `GET /api/auth/apikeys` — Generate and manage hashed API keys.

#### Document Ingestion & Pipeline
- `POST /api/documents/upload` — Upload single document (PDF, PNG, JPG, TIFF, TXT).
- `POST /api/documents/batch-upload` — Multipart batch upload with correlation `batch_id`.
- `GET /api/documents` — Paginated document list with status, category, and date filtering.
- `GET /api/documents/{id}` — Full document schema, OCR text, and field consensus scores.
- `POST /api/documents/{id}/reprocess` — Re-queue document for multi-agent evaluation.
- `GET /api/documents/{id}/spatial-layout` — Word-level bounding boxes `[x0, y0, x1, y1]`.
- `GET /api/documents/{id}/export/{format}` — Export document (`quickbooks`, `xero`, `sap`, `universal`).

#### Human-in-the-Loop Review
- `GET /api/review/queue` — Fetch documents requiring human inspection.
- `POST /api/review/{id}/lock` — Acquire exclusive 15-minute review lock with `lock_token`.
- `POST /api/review/{id}/heartbeat` — Renew active review lock TTL.
- `POST /api/review/{id}/unlock` — Release review lock.
- `POST /api/review/{id}/submit` — Commit human corrections and approve/reject document.

#### 3-Way Cross-Document Reconciliation
- `POST /api/v1/reconciliation/3way` — Reconcile PO, Delivery Note, and Vendor Invoice bundle.

#### Hybrid Search & RAG
- `GET /api/search` — Fused dense vector + sparse keyword search with facet filters.
- `POST /api/search/semantic` — Pure ChromaDB semantic vector search.
- `GET /api/search/suggest` — Instant query auto-completion.
- `POST /api/rag/ask` — Grounded Q&A with NLI citation entailment checks.
- `POST /api/rag/stream` — Token-by-token Server-Sent Events (SSE) streaming RAG.

#### System Observability & Health
- `GET /health/live` — Kubernetes liveness probe (lightweight process health).
- `GET /health/ready` (or `/health`) — Deep readiness check (verifies PostgreSQL, Redis, RabbitMQ, and ChromaDB).
- `GET /metrics` — Prometheus metrics exposition endpoint.
- `GET /api/admin/logs` — Path-traversal-hardened dynamic log streaming.
- `POST /api/v1/demo/seed` — Instant 1-click database population with 4 real-world procurement cases.

---

<a id="testing"></a>
## 🧪 Testing Instructions

The test suite covers algorithmic math consistency, multi-agent consensus, adversarial security, and transactional reliability.

### Python Backend & Integration Tests
```bash
# 1. Discover all tests across root, backend, and crawler
python -m pytest tests/ backend/tests/ --collect-only

# 2. Run backend multi-agent consensus test suite
python -m pytest backend/tests/test_agents.py -v

# 3. Run transactional outbox and worker adversarial tests
python -m pytest backend/tests/test_outbox_relay.py backend/tests/test_worker_adversarial.py -v

# 4. Run API integration test suite
python -m pytest backend/tests/test_api.py -v

# 5. Run full test suite with coverage
python -m pytest --cov=backend/app --cov-report=term-missing
```

### Frontend Tests & Accessibility Verification
```bash
cd frontend

# 1. TypeScript compilation check
npm run typecheck

# 2. ESLint code quality check
npm run lint

# 3. Automated accessibility & modal E2E verification
node scripts/test-accessibility-e2e.mjs

# 4. Execute unified test command
npm test
```

---

<a id="repository-structure"></a>
## 📂 Repository Structure

```
docintel-ai/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Python testing, Next.js build, and container checks
│       └── publish.yml            # CI deployment workflow
│
├── backend/
│   ├── alembic/                   # Database schema migrations
│   │   ├── env.py
│   │   └── versions/              # Versioned migration steps
│   ├── app/
│   │   ├── agents/                # 7 Autonomous AI Verification Agents & Debate Engine
│   │   │   ├── active_learning.py #   Reviewer correction exemplar memory
│   │   │   ├── auditor.py         #   Graduated math & multi-currency auditor
│   │   │   ├── compliance.py      #   Regulatory & governing law checks
│   │   │   ├── consensus.py       #   Weighted score aggregator & category matrix
│   │   │   ├── critic.py          #   Extraction hallucination detector
│   │   │   ├── extractor.py       #   Structured JSON field extraction
│   │   │   ├── memory.py          #   Vendor anomaly detection via ChromaDB
│   │   │   ├── reconciler.py      #   Arbitrator for agent divergences
│   │   │   ├── reflexive_debate.py#   Multi-turn Graph-of-Thoughts debate
│   │   │   └── summary.py         #   3-sentence executive summaries
│   │   ├── domain/                # Domain-Driven Architecture (aggregate, state machine)
│   │   ├── models/                # SQLAlchemy ORM models (Document, User, Outbox, Audit)
│   │   ├── routes/                # FastAPI REST router modules (19 endpoints)
│   │   ├── schemas/               # Pydantic v2 validation schemas
│   │   ├── services/              # External services (OCR, Storage, Outbox, 3-Way Matching)
│   │   ├── config.py              # Centralized Pydantic application settings
│   │   ├── database.py            # SQLAlchemy engine, GUID TypeDecorator & connection pools
│   │   ├── main.py                # FastAPI entry point, middleware & health probes
│   │   └── worker.py              # Pika RabbitMQ async queue consumer daemon
│   ├── tests/                     # Backend unit, integration & adversarial test suites
│   ├── Dockerfile                 # Multi-stage production container
│   ├── Dockerfile.worker          # Standalone background worker container
│   └── requirements.txt           # Version-pinned Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── app/                   # Next.js 14 App Router routes (search, review, documents)
│   │   ├── components/            # Reusable UI components & Radix dialog modals
│   │   ├── hooks/                 # Custom React hooks (keyboard navigation, queries)
│   │   ├── lib/                   # API client, SSE streaming & IndexedDB offline cache
│   │   └── stores/                # Zustand client state stores (auth, UI)
│   ├── scripts/                   # Automated accessibility & modal E2E test scripts
│   ├── package.json               # Next.js 14, React 19, Radix UI & Tailwind v4
│   ├── Dockerfile                 # Multi-stage standalone Next.js container
│   └── next.config.ts             # Container standalone output & API proxy rewrites
│
├── docs/
│   └── architecture.md            # Comprehensive architecture, Mermaid diagrams & specs
├── k8s/                           # Kubernetes cluster deployment manifests & HPA
├── packages/
│   └── googi-crawler/             # Standalone distributed web crawler package
├── requirements/                  # Modular Python requirement manifests (base, dev, test)
├── tests/                         # Root end-to-end (E2E) 4-tier test framework
├── docker-compose.yml             # Full 8-service local orchestration
├── pyproject.toml                 # Pytest configuration & project metadata
├── Makefile                       # Developer shortcuts (build, test, lint, run)
├── SECURITY.md                    # Vulnerability disclosure & security policy
├── CONTRIBUTING.md                # Contribution guidelines & code standards
└── LICENSE                        # MIT License
```

---

## 📄 License & Attributions

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Designed and engineered with precision by [Aaditya Uniyal](https://github.com/AadityaUniyal).
