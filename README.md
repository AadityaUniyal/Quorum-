# DocIntel AI

**Distributed AI Document Intelligence Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)

An enterprise-grade, event-driven platform that automates the full document lifecycle — ingestion, OCR extraction, AI classification, multi-agent validation, human-in-the-loop review, and semantic search with RAG. Built for **manufacturing**, **finance**, and **legal/compliance** verticals where document accuracy is critical.

---

## Table of Contents

- [The Problem](#the-problem)
- [How It Works](#how-it-works)
- [Architecture Overview](#architecture-overview)
- [Multi-Agent Consensus System](#multi-agent-consensus-system)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [License](#license)

---

## The Problem

Enterprises process thousands of unstructured documents daily:

| Vertical | Document Types |
|----------|---------------|
| **Manufacturing & Logistics** | RFQs, Bills of Materials, Purchase Orders, Bills of Lading, Delivery Notes |
| **Finance** | Invoices, Credit Notes, Loan Applications, KYC Identity Cards |
| **Legal & Compliance** | MSA/NDAs, Risk Clauses, Conformity Certificates (ISO, ASTM, RoHS) |

Manual processing results in human error, delayed decisions, compliance issues, and high labor costs. A single misread number on an invoice or a missed compliance clause in a contract can cascade into significant financial and legal risk.

**DocIntel AI eliminates this.** It automates the entire lifecycle with AI-powered extraction and a multi-agent verification system that catches errors a single model would miss.

---

## How It Works

### End-to-End Pipeline

```
┌──────────────┐    ┌─────────────┐    ┌────────────────┐    ┌───────────────────┐
│   Document   │───▶│     OCR     │───▶│ Classification │───▶│   Multi-Agent     │
│    Upload    │    │ (Tesseract) │    │  (Gemini AI)   │    │   Consensus (6)   │
└──────────────┘    └─────────────┘    └────────────────┘    └────────┬──────────┘
                                                                      │
                                                          ┌───────────┴───────────┐
                                                          │                       │
                                                   Score ≥ 85%              Score < 85%
                                                          │                       │
                                                          ▼                       ▼
                                                  ┌──────────────┐    ┌───────────────────┐
                                                  │  PROCESSED   │    │  AWAITING_REVIEW   │
                                                  │ (Auto-Approved)│   │ (Human Review)     │
                                                  └──────┬───────┘    └─────────┬─────────┘
                                                          │                       │
                                                          └───────────┬───────────┘
                                                                      │
                                                          ┌───────────▼───────────┐
                                                          │   ChromaDB Indexing   │
                                                          │  (Vector Embeddings)  │
                                                          └───────────┬───────────┘
                                                                      │
                                                          ┌───────────▼───────────┐
                                                          │ Semantic Search & RAG │
                                                          └───────────────────────┘
```

### Step-by-Step Workflow

1. **Ingestion** — A document (PDF, scanned image) is uploaded via the web UI or email ingestion. The file is stored on disk, metadata is persisted to PostgreSQL, and a `document.uploaded` event is published to RabbitMQ. Status: `INGESTED`.

2. **OCR Extraction** — A background worker consumes the event and runs Tesseract OCR to extract layout-aware text blocks, preserving the spatial structure of the document. Status: `PROCESSING`.

3. **AI Classification** — Google Gemini (or the local heuristic fallback engine) analyzes the OCR text and classifies the document type: Invoice, RFQ, Contract, Compliance Certificate, Purchase Order, etc.

4. **Multi-Agent Consensus** — Six specialized AI agents independently validate the extracted data (see [Multi-Agent Consensus System](#multi-agent-consensus-system) below). Each agent scores the extraction from a different perspective. A document-type-aware weighted consensus engine aggregates their scores.

5. **Routing Decision** — If the consensus score is ≥85%, the document is auto-approved (`PROCESSED`). If below 85% or if any agent flags a critical issue (e.g., math mismatch on an invoice), the document is routed to the human review queue (`AWAITING_REVIEW`).

6. **Human-in-the-Loop Review** — Reviewers see a split-screen view: raw OCR text on the left, editable structured fields on the right. Fields are color-coded in real-time (red = failed, yellow = warning, green = passed). Redis-backed concurrency locking prevents two reviewers from editing the same document simultaneously.

7. **Vector Indexing** — Once approved, the document's text is chunked and embedded into ChromaDB for semantic search and RAG-powered question answering.

8. **Audit Trail** — Every event (upload, classification, agent scores, review decisions) is immutably logged to the audit trail.

---

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────────┐         ┌──────────────┐
│   Next.js 15    │────────▶│   FastAPI Backend     │────────▶│  PostgreSQL  │
│   Frontend UI   │◀────────│   (REST API)          │◀────────│  (Neon DB)   │
│   Port 3000     │         │   Port 8000           │         └──────────────┘
└─────────────────┘         └──────┬───┬────┬───────┘
                                   │   │    │
                    ┌──────────────┘   │    └──────────────┐
                    ▼                  ▼                   ▼
              ┌──────────┐      ┌──────────┐        ┌──────────┐
              │ RabbitMQ │      │  Redis   │        │ ChromaDB │
              │  Broker  │      │  Cache   │        │ Vectors  │
              └────┬─────┘      └──────────┘        └──────────┘
                   │
                   ▼
              ┌──────────────────────────────────────────┐
              │           Background Worker              │
              │                                          │
              │  OCR ──▶ Classify ──▶ 6 Agents ──▶ Index │
              └──────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Technology | Role |
|-----------|-----------|------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS | Web portal — document management, review, search, analytics |
| **Backend API** | FastAPI, SQLAlchemy, Pydantic | REST API server — authentication, document CRUD, search, webhooks |
| **Worker** | Python, RabbitMQ consumer | Async document processing — OCR, classification, agent consensus, indexing |
| **Database** | PostgreSQL (Neon) | Primary data store — users, documents, audit logs, bookmarks |
| **Cache** | Redis | Rate limiting, session/review locks, LLM response caching, token blacklists |
| **Message Queue** | RabbitMQ | Event-driven decoupling between API and worker |
| **Vector Store** | ChromaDB | Document embeddings for semantic search and RAG |
| **AI Engine** | Google Gemini API | Classification, extraction, query expansion, RAG responses |
| **Fallback Engine** | TF-IDF, regex, heuristics | Runs when no Gemini API key is configured — everything works offline |

> **Offline-First**: If no Gemini API key is provided, the platform automatically switches to a high-fidelity local heuristic engine (TF-IDF + regex extractors). Every feature works out of the box.

---

## Multi-Agent Consensus System

Traditional extraction systems trust a single AI model's output, leading to hallucinated numbers, format omissions, and undetected compliance gaps. DocIntel AI solves this with a **6-agent verification circle** where each agent independently evaluates the extraction from a different angle:

### The Agents

| Agent | File | What It Does |
|-------|------|-------------|
| **Extractor** | `agents/extractor.py` | Extracts structured key-value pairs from OCR text based on document type (e.g., vendor name, subtotal, part numbers, quantities) |
| **Critic** | `agents/critic.py` | Cross-compares the structured JSON back to the raw OCR text, flagging missing data, digit transpositions, or hallucinated values |
| **Auditor** | `agents/auditor.py` | Runs deterministic mathematical audits using **graduated scoring** — for invoices, verifies `Subtotal + Tax + Shipping == Total` with tolerance thresholds (<0.5% = warning at 0.95, <5% = penalty at 0.50, >5% = score 0.0) |
| **Compliance** | `agents/compliance.py` | Checks for regulatory requirements — Delaware governing law in contracts, RoHS/ISO declarations in conformance certificates, required signature fields |
| **Memory** | `agents/memory.py` | Queries ChromaDB for historical documents from the same vendor/entity and flags anomalies — abnormal price spikes, unusual quantities, deviation from historical patterns |
| **Reconciler** | `agents/reconciler.py` | Activates when Critic and Auditor scores diverge by >0.3 and resolves the conflict by re-analyzing the disputed fields |

A **Summary Agent** (`agents/summary.py`) then generates a 3-sentence executive summary of the document.

### Consensus Scoring

The consensus engine uses **document-type-aware weights** to aggregate agent scores:

| Document Type | Critic Weight | Auditor Weight | Compliance Weight | Why |
|--------------|:---:|:---:|:---:|-----|
| **Invoice** | 0.3 | 0.5 | 0.2 | Math accuracy is critical |
| **Contract** | 0.3 | 0.1 | 0.6 | Compliance clauses matter most |
| **Compliance Cert** | 0.2 | 0.1 | 0.7 | Regulatory checks are paramount |
| **RFQ** | 0.5 | 0.3 | 0.2 | Data accuracy matters most |
| **Purchase Order** | 0.4 | 0.4 | 0.2 | Balanced — both math and accuracy |

If the weighted score is ≥85%, the document is auto-approved. Below that threshold, or if any agent flags a critical defect, it routes to the human review queue.

---

## Key Features

### Human-in-the-Loop Review Portal

When the consensus engine flags a document, it enters the review queue. Reviewers interact with a split-screen layout:

- **Left Panel** — Raw extracted OCR text with preserved layout
- **Right Panel** — Editable field form with real-time color-coded validation (red = failed, yellow = warning, green = passed)
- **Concurrency Locking** — Redis-based atomic `SET NX EX` locks with heartbeat renewal prevent two reviewers from editing the same document

### Cognitive Vector Search & RAG

Two search modes working together:

- **Structured SQL Filters** — Filter by document category, processing status, confidence scores, date ranges
- **Semantic Vector Search** — ChromaDB-powered natural language queries (e.g., "Find stainless steel components" or "Invoices over $10,000")
- **RAG Chatbot** — Ask questions constrained to specific documents: "What contracts expire next month?" or "Who signed the MSA?" — Gemini returns precise, contextual answers with source attribution
- **Query Expansion** — LLM generates paraphrases of search queries to improve recall across vocabulary mismatches

### Authentication & Security

- **httpOnly Secure Cookies** — JWT tokens stored in httpOnly cookies (not localStorage) to prevent XSS theft
- **Refresh Token Rotation** — Short-lived access tokens (15 min) + long-lived refresh tokens (7 days) with automatic rotation
- **Rate Limiting** — Redis-backed per-endpoint rate limits on authentication routes
- **Password Strength** — Enforced during registration with configurable policies
- **RBAC** — Role-based access control middleware on all protected routes
- **API Key Auth** — SHA-256 hashed API keys for programmatic access (scripts, integrations)
- **Token Blacklisting** — Redis-backed blacklist for invalidated tokens on logout

### KPI Analytics Dashboard

- Overall processed document volume, processing speeds, and human intervention rates
- Recharts area graphs showing weekly ingestion trends
- Recharts pie charts showing category distribution
- Four tabs: Documents, AI Agents, Search, Crawl metrics
- **System Node Monitor** — Live ping metrics for PostgreSQL, RabbitMQ, and ChromaDB

### Webhook Studio & Integrations

- **Outbound Webhooks** — Register endpoint URLs to receive JSON payloads on document lifecycle transitions (e.g., when a document moves to `PROCESSED`)
- **Email Ingestion** — Scans IMAP mailboxes for unseen messages, downloads PDF attachments, and queues them automatically
- **Dynamic Table Extraction** — Uses `pdfplumber` to extract tables as structured Markdown arrays with cell alignment preservation

### Search Bookmarks & Export

- Save frequently used searches as bookmarks for one-click re-execution
- Export search results to **CSV** or **PDF** formats

### Web Crawler (`googi-crawler`)

A standalone, pip-installable Python package in `packages/googi-crawler/`:

- **PageRank Scoring** — Computes authority scores across crawled pages
- **Sitemap.xml Parsing** — Discovers and crawls pages from XML sitemaps
- **Distributed Crawling** — Distributes crawl tasks via RabbitMQ for horizontal scaling
- Installable separately: `pip install googi-crawler`

### LLM Reliability

- **Retry with Exponential Backoff** — Automatic retries on LLM timeouts (configurable, default 3 attempts)
- **Fallback Chain** — Primary (Gemini) → Secondary (configurable) → Tertiary (local Ollama) → Local heuristic engine
- **Response Caching** — Redis-cached LLM responses (1-hour TTL) keyed by OCR text hash to avoid redundant API calls

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS, Recharts, Framer Motion, Lucide React, Zustand |
| **Backend** | FastAPI, SQLAlchemy, Pydantic, PyJWT, bcrypt, tenacity |
| **Database** | PostgreSQL (Neon, with connection pooling) |
| **Cache & Locks** | Redis (rate limiting, session locks, LLM response cache, token blacklists) |
| **Message Queue** | RabbitMQ (event-driven async processing) |
| **Vector DB** | ChromaDB (embedding generation, semantic search) |
| **AI** | Google Gemini API + local heuristic fallback (TF-IDF, regex) |
| **OCR** | Tesseract OCR (pytesseract) + mock layout generators |
| **Crawler** | `googi-crawler` (PageRank, sitemap parsing, distributed crawling via RabbitMQ) |
| **Observability** | OpenTelemetry tracing, Sentry error tracking (optional) |
| **Infrastructure** | Docker, Docker Compose, Kubernetes (k8s/ manifests), Alembic migrations |
| **CI/CD** | GitHub Actions (lint, test, Docker build, package publishing) |

---

## Project Structure

```
docintel-ai/
├── .github/workflows/           # CI/CD pipelines (lint, test, build, publish)
├── backend/
│   ├── app/
│   │   ├── agents/              # Multi-agent consensus system
│   │   │   ├── extractor.py     #   Structured data extraction
│   │   │   ├── critic.py        #   Extraction accuracy verification
│   │   │   ├── auditor.py       #   Mathematical consistency checks
│   │   │   ├── compliance.py    #   Regulatory compliance validation
│   │   │   ├── memory.py        #   Historical anomaly detection
│   │   │   ├── reconciler.py    #   Inter-agent conflict resolution
│   │   │   ├── summary.py       #   Executive summary generation
│   │   │   └── consensus.py     #   Weighted score aggregation
│   │   ├── core/                # Security utilities (token blacklisting)
│   │   ├── models/              # SQLAlchemy ORM models (User, Document, AuditLog)
│   │   ├── routes/              # API endpoints
│   │   │   ├── auth.py          #   Authentication, RBAC, API keys
│   │   │   ├── documents.py     #   Document CRUD, upload, reprocess
│   │   │   ├── review.py        #   HITL review queue, lock/unlock
│   │   │   ├── search.py        #   Hybrid search, query expansion
│   │   │   ├── analytics.py     #   KPI metrics, system health
│   │   │   ├── crawl.py         #   Crawler control, PageRank
│   │   │   ├── rag.py           #   RAG chatbot, context Q&A
│   │   │   ├── bookmarks.py     #   Saved search management
│   │   │   ├── webhooks.py      #   Webhook registration
│   │   │   └── streaming.py     #   Server-Sent Events
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # External integrations
│   │   │   ├── llm.py           #   Gemini API + retry + fallback chain
│   │   │   ├── ocr.py           #   Tesseract OCR wrapper
│   │   │   ├── queue.py         #   RabbitMQ publisher/consumer
│   │   │   ├── vector_store.py  #   ChromaDB operations
│   │   │   ├── cache.py         #   Redis cache operations
│   │   │   ├── crawler.py       #   Web crawling integration
│   │   │   ├── export.py        #   CSV/PDF export generation
│   │   │   ├── storage.py       #   File storage management
│   │   │   ├── webhook.py       #   Outbound webhook dispatch
│   │   │   ├── email_ingest.py  #   IMAP email ingestion
│   │   │   └── local_engine.py  #   Heuristic fallback (TF-IDF, regex)
│   │   ├── main.py              # FastAPI entry point, middleware, CORS
│   │   ├── worker.py            # RabbitMQ consumer (OCR → classify → agents → index)
│   │   ├── config.py            # Centralized settings (Pydantic BaseSettings)
│   │   ├── database.py          # SQLAlchemy session management
│   │   └── limiter.py           # Redis-backed rate limiting
│   ├── tests/                   # pytest test suite
│   ├── Dockerfile               # Multi-stage production build
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages
│   │   │   ├── dashboard/       #   KPI overview, system health
│   │   │   ├── documents/       #   Upload, filter, grid/table views
│   │   │   ├── review/          #   Split-screen HITL review
│   │   │   ├── search/          #   Hybrid search, RAG chat, export
│   │   │   ├── analytics/       #   Charts (Documents, AI, Search, Crawl)
│   │   │   ├── crawl/           #   Crawler console, PageRank
│   │   │   └── settings/        #   User profile, preferences
│   │   ├── components/          # Reusable UI components (auth, layout, ui)
│   │   ├── lib/                 # API client wrapper
│   │   └── stores/              # Zustand state management
│   ├── Dockerfile               # Production build
│   └── package.json
├── packages/
│   └── googi-crawler/           # Standalone pip-installable crawler package
│       ├── googi_crawler/
│       │   ├── crawler.py       #   Core crawling + sitemap parsing
│       │   └── pagerank.py      #   PageRank computation
│       ├── tests/
│       ├── pyproject.toml
│       └── README.md
├── k8s/                         # Kubernetes deployment manifests
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── redis-deployment.yaml
│   ├── rabbitmq-deployment.yaml
│   ├── chroma-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml
│   ├── hpa-backend.yaml         # Auto-scaling (CPU ≥60%, 1–8 replicas)
│   ├── configmap.yaml
│   ├── secret.yaml
│   └── namespace.yaml
├── alembic/                     # Database migration scripts
├── tests/                       # Integration & stress tests
├── docker-compose.yml           # Local dev infrastructure (Redis + RabbitMQ)
├── Makefile                     # Dev automation (dev, test, lint, build, migrate)
├── start_platform.sh            # Unix launcher (one-command startup)
├── start_platform.ps1           # Windows launcher
├── .env.example                 # Environment variable reference
├── alembic.ini                  # Alembic configuration
├── CONTRIBUTING.md              # Contributor guide
├── SECURITY.md                  # Security policy
├── SYSTEM_ARCHITECTURE.md       # Detailed architecture reference
└── LICENSE                      # MIT License
```

---

## Getting Started

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Python | 3.11+ | Backend API & workers |
| Node.js | 20+ | Frontend application |
| Docker Desktop | Latest | Infrastructure services (Redis, RabbitMQ) |

### Quick Start (One Command)

**Unix (macOS / Linux):**

```bash
chmod +x start_platform.sh && ./start_platform.sh
```

**Windows (PowerShell):**

```powershell
./start_platform.ps1
```

**Makefile:**

```bash
make dev       # Start all services (Docker + backend + worker + frontend)
make test      # Run the full test suite with coverage
make lint      # Run linters (ruff + ESLint)
make build     # Build production Docker images
make stop      # Stop all services
make clean     # Stop services and remove generated artifacts
make migrate   # Run database migrations (Alembic)
```

### Manual Setup

<details>
<summary><strong>Step-by-step instructions</strong></summary>

<br>

**1. Start infrastructure services:**

```bash
docker-compose up -d    # Starts Redis + RabbitMQ
```

**2. Set up the backend:**

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Linux/macOS
# venv\Scripts\activate     # Windows
pip install -r requirements.txt
```

**3. Configure environment variables:**

```bash
cp .env.example .env
# Edit .env and fill in the required values
```

> **Note**: If no `GEMINI_API_KEY` is provided, the platform automatically uses the local heuristic engine. Everything works out of the box without any API key.

**4. Run database migrations:**

```bash
python -m alembic upgrade head
```

**5. Start the API server:**

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**6. Start the background worker** (new terminal):

```bash
cd backend
python -m app.worker
```

**7. Start the frontend** (new terminal):

```bash
cd frontend
npm install
npm run dev
```

**8. Open the application:**

| Service | URL |
|---------|-----|
| Web Portal | [http://localhost:3000](http://localhost:3000) |
| API Docs (Swagger) | [http://localhost:8000/docs](http://localhost:8000/docs) |
| RabbitMQ Management | [http://localhost:15672](http://localhost:15672) |

</details>

### Environment Variables

<details>
<summary><strong>Full reference (<code>.env.example</code>)</strong></summary>

<br>

| Variable | Description | Required | Default |
|----------|------------|:---:|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | — |
| `JWT_SECRET_KEY` | Secret for JWT signing | Yes | — |
| `GEMINI_API_KEY` | Google Gemini API key | No | Falls back to local engine |
| `LLM_MODEL` | Gemini model name | No | `gemini-1.5-pro` |
| `LLM_OFFLINE_MOCK_FALLBACK` | Enable local heuristic fallback | No | `true` |
| `LLM_FALLBACK_ENABLED` | Enable multi-provider fallback chain | No | `true` |
| `LLM_SECONDARY_PROVIDER` | Secondary LLM provider | No | — |
| `LLM_TERTIARY_OLLAMA_URL` | Local Ollama endpoint | No | `http://localhost:11434` |
| `RABBITMQ_HOST` | RabbitMQ hostname | No | `localhost` |
| `RABBITMQ_PORT` | RabbitMQ port | No | `5672` |
| `RABBITMQ_USER` | RabbitMQ username | No | `guest` |
| `RABBITMQ_PASS` | RabbitMQ password | No | `guest` |
| `REDIS_HOST` | Redis hostname | No | `localhost` |
| `REDIS_PORT` | Redis port | No | `6379` |
| `REDIS_PASSWORD` | Redis password | No | — |
| `CORS_ORIGINS` | Allowed CORS origins | No | `http://localhost:3000` |
| `COOKIE_SECURE` | Set Secure flag on cookies | No | `false` |
| `COOKIE_SAMESITE` | SameSite cookie policy | No | `lax` |
| `SENTRY_DSN` | Sentry error tracking DSN | No | — |
| `OTLP_ENDPOINT` | OpenTelemetry collector | No | — |
| `DEBUG` | Enable debug mode | No | `true` |

</details>

---

## API Reference

The backend exposes a comprehensive REST API documented via Swagger UI at `/docs`.

| Route Group | Prefix | Endpoints |
|------------|--------|-----------|
| **Authentication** | `/api/auth` | Register, login, logout, refresh tokens, profile management, API key CRUD, team management |
| **Documents** | `/api/documents` | Upload, list, detail, reprocess, batch operations, status filtering |
| **Review** | `/api/review` | Review queue, document lock/unlock (Redis), approve/reject with field edits |
| **Search** | `/api/search` | Hybrid search (SQL + vector), query expansion, faceted filtering |
| **RAG** | `/api/rag` | Context-constrained Q&A, document-scoped chatbot |
| **Bookmarks** | `/api/bookmarks` | Save/delete/list search bookmarks |
| **Analytics** | `/api/analytics` | Processing KPIs, agent latency, system health, node monitoring |
| **Crawl** | `/api/crawl` | Start/stop crawler, PageRank scores, sitemap management |
| **Webhooks** | `/api/webhooks` | Register/manage outbound webhook endpoints |
| **Streaming** | `/api/streaming` | Server-Sent Events for real-time processing updates |

---

## Deployment

### Docker

```bash
# Build production images
docker build -t docintel-backend:latest ./backend
docker build -t docintel-frontend:latest ./frontend

# Or use the Makefile
make build
```

### Kubernetes

Production-ready Kubernetes manifests are provided in `k8s/`:

- Namespace isolation
- ConfigMaps and Secrets for environment management
- Deployments for backend, frontend, worker, Redis, RabbitMQ, ChromaDB
- ClusterIP services and Ingress
- Horizontal Pod Autoscaler for worker (CPU ≥60%, scales 1–8 replicas)

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
```

### CI/CD

GitHub Actions workflows in `.github/workflows/`:

- **ci.yml** — Runs pytest, ruff, and ESLint on every PR
- **docker.yml** — Builds and pushes Docker images to GHCR on main branch merges
- **publish.yml** — Publishes `googi-crawler` package on version tags

---

## Documentation

| Document | Description |
|----------|------------|
| [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) | Detailed architecture reference — component diagram, data flows, service tables, security model |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, code style, branch naming, PR process |
| [SECURITY.md](SECURITY.md) | Security policy, vulnerability reporting, security features |
| [packages/googi-crawler/README.md](packages/googi-crawler/README.md) | Standalone crawler package documentation |

---

## License

MIT License — Copyright (c) 2026 [Aaditya Uniyal](https://github.com/AadityaUniyal)

See [LICENSE](LICENSE) for full text.
