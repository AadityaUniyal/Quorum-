# System Architecture

> Technical architecture reference for DocIntel AI.

## Overview

DocIntel AI is an event-driven, microservice-oriented platform built on an asynchronous pipeline architecture. Documents flow through a series of stages — ingestion, OCR, classification, multi-agent validation, and indexing — coordinated via RabbitMQ message passing.

## Component Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Next.js UI  │────▶│  FastAPI Backend  │────▶│  PostgreSQL  │
│  (Port 3000) │◀────│   (Port 8000)    │◀────│   (Neon DB)  │
└─────────────┘     └──────┬───────────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ RabbitMQ │ │  Redis   │ │ ChromaDB │
        │  Broker  │ │  Cache   │ │ Vectors  │
        └────┬─────┘ └──────────┘ └──────────┘
             │
             ▼
        ┌──────────┐
        │  Worker  │ ── OCR ── Classify ── Agents ── Index
        │ Consumer │
        └──────────┘
```

## Data Flow

### Document Processing Pipeline

1. **Ingestion** — Client uploads document via REST API. File is stored on disk, metadata persisted to PostgreSQL. Status: `INGESTED`.
2. **Event Publishing** — A `document.uploaded` event is published to RabbitMQ.
3. **Worker Consumption** — Background worker picks up the event. Status: `PROCESSING`.
4. **OCR Extraction** — Tesseract OCR extracts layout-aware text blocks from the document.
5. **Classification** — Gemini AI (or local heuristic fallback) classifies the document type (Invoice, RFQ, Contract, Compliance, etc.).
6. **Multi-Agent Consensus** — Six specialized agents validate the extraction:
   - **Extractor** — Structured key-value pair extraction
   - **Critic** — Cross-validates extracted JSON against raw OCR text
   - **Auditor** — Deterministic mathematical verification (graduated scoring)
   - **Compliance** — Regulatory checklist validation
   - **Memory** — Historical drift detection via ChromaDB similarity
   - **Reconciler** — Resolves inter-agent conflicts when scores diverge >0.3
   - **Summary** — Generates executive document summary
7. **Consensus Scoring** — Document-type-aware weighted scoring. Score ≥85% → `PROCESSED`. Score <85% or flagged → `AWAITING_REVIEW`.
8. **Vector Indexing** — Text chunks and embeddings stored in ChromaDB.
9. **Audit Trail** — Every event is immutably logged.

### Authentication Flow

1. User submits credentials → backend verifies with bcrypt
2. Access token (15min, JWT) + refresh token (7d) issued
3. Tokens delivered via httpOnly secure cookies
4. Expired access tokens refreshed silently via refresh endpoint
5. Logout blacklists tokens in Redis
6. Rate limiting (Redis) protects auth endpoints

## Service Architecture

### Backend (`backend/app/`)

| Module | Purpose |
|--------|---------|
| `main.py` | FastAPI app, CORS, middleware, route registration |
| `worker.py` | RabbitMQ consumer — OCR, classification, agents, indexing |
| `config.py` | Centralized settings via Pydantic BaseSettings |
| `database.py` | SQLAlchemy session management |
| `limiter.py` | Redis-backed rate limiting |
| `core/security.py` | Token creation, blacklisting, validation |

### Agents (`backend/app/agents/`)

| Agent | Responsibility |
|-------|---------------|
| `extractor.py` | Structured data extraction from OCR text |
| `critic.py` | Extraction accuracy verification |
| `auditor.py` | Mathematical consistency checks |
| `compliance.py` | Regulatory compliance validation |
| `memory.py` | Historical anomaly detection |
| `reconciler.py` | Inter-agent conflict resolution |
| `summary.py` | Executive summary generation |
| `consensus.py` | Weighted score aggregation and routing |

### Services (`backend/app/services/`)

| Service | Responsibility |
|---------|---------------|
| `llm.py` | Gemini API client with retry, fallback chain, Redis caching |
| `ocr.py` | Tesseract OCR with layout extraction |
| `queue.py` | RabbitMQ publisher/consumer |
| `vector_store.py` | ChromaDB embedding and search |
| `cache.py` | Redis cache operations |
| `crawler.py` | Web crawling integration |
| `export.py` | CSV/PDF export generation |
| `storage.py` | File storage management |
| `webhook.py` | Outbound webhook dispatch |
| `email_ingest.py` | IMAP email attachment ingestion |
| `local_engine.py` | Heuristic fallback (TF-IDF, regex) |

### Routes (`backend/app/routes/`)

| Route | Endpoints |
|-------|-----------|
| `auth.py` | Login, register, refresh, logout, profile, API keys, RBAC |
| `documents.py` | Upload, list, detail, reprocess, batch operations |
| `review.py` | HITL review queue, lock/unlock, approve/reject |
| `search.py` | Hybrid search, query expansion, facets, bookmarks, export |
| `analytics.py` | KPI metrics, processing stats, system health |
| `crawl.py` | Crawler control, PageRank, sitemap |
| `rag.py` | RAG chatbot, context-constrained Q&A |
| `webhooks.py` | Webhook registration and management |
| `bookmarks.py` | Saved search management |
| `streaming.py` | Server-Sent Events for live updates |

### Frontend (`frontend/src/`)

| Page | Function |
|------|----------|
| `dashboard/` | KPI overview, system health, quick actions |
| `documents/` | Document list, upload, grid/table views, filters |
| `review/` | Split-screen HITL review with real-time validation |
| `search/` | Hybrid search, RAG chat, bookmarks, export |
| `analytics/` | Charts and metrics (Documents, AI Agents, Search, Crawl tabs) |
| `crawl/` | Crawler console, PageRank visualization |
| `settings/` | User profile and preferences |

## Infrastructure

### Local Development

- **Redis** — Session locks, rate limiting, LLM response cache
- **RabbitMQ** — Async event queue between API and worker
- **PostgreSQL** — Primary data store (hosted on Neon)
- **ChromaDB** — Vector embeddings for semantic search

### Production (Kubernetes)

Manifests in `k8s/` provide:
- Namespace isolation
- ConfigMaps and Secrets
- Deployments: backend, frontend, worker, Redis, RabbitMQ, ChromaDB
- Services and Ingress
- HPA for worker auto-scaling (CPU ≥60%, 1–8 replicas)

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Authentication | JWT access + refresh tokens via httpOnly cookies |
| Authorization | Role-based access control (RBAC) middleware |
| Rate Limiting | Redis-backed per-endpoint limits |
| Password Security | bcrypt hashing + strength enforcement |
| Token Management | Redis blacklist on logout/rotation |
| API Keys | SHA-256 hashed keys for programmatic access |
| Concurrency | Redis distributed locks for review sessions |
