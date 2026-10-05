# Project: Quorum Enterprise Document & Financial Intelligence Elevation

## Architecture
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, Lucide Icons, Recharts, Zustand, TanStack React Query.
- **Backend**: Python FastAPI, SQLAlchemy 2, Neon PostgreSQL, ChromaDB, RabbitMQ, Redis.
- **Design System**: Apple Human Interface Guidelines Obsidian Titanium base (`#000000`, `#0A0A0C`, `#121217`, `#18181F`), frosted mica glass (`backdrop-blur-2xl bg-white/[0.04]`), hairline borders (`border-white/[0.08]`), Apple typography (SF Pro / Inter font stack), spring physics (`framer-motion`), tactile micro-interactions.
- **Data Integrity**: Clean slate for new users (zero mock/seeded records), 100% frontend synchronization with Neon Postgres and FastAPI REST/SSE endpoints.

## Code Layout
- `frontend/src/app/` — Next.js 16 App Router pages (11 core routes: `/`, `/dashboard`, `/documents`, `/review`, `/analytics`, `/search`, `/crawl`, `/benchmarks`, `/pricing`, `/settings`, `/admin`).
- `frontend/src/components/ui/` — Apple HIG foundation primitives (`Button`, `Card`, `Dialog`, `Drawer`, `Slider`, `Tabs`, `Accordion`, `DropdownMenu`, `Tooltip`, `Badge`, `Skeleton`).
- `frontend/src/components/layout/` — `AppLayout`, `Header`, `Sidebar`, `MobileNav`, `CommandPalette`.
- `frontend/src/lib/` — `api.ts` (typed REST client matching backend FastAPI routes), `types.ts`, `utils.ts`.
- `frontend/src/stores/` — Zustand state stores (`auth.ts`, `ui.ts`).
- `backend/app/models/` — SQLAlchemy database models (`document.py`, `audit.py`, `user.py`).
- `backend/app/routes/` — FastAPI endpoint routers (`documents.py`, `analytics.py`, `search.py`, `crawl.py`, `benchmarks.py`, `admin.py`, `auth.py`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Obsidian Titanium Palette & Tokens | #000000, #0A0A0C, #121217, #18181F, frosted mica glass (`bg-white/[0.04]`), hairline borders (`border-white/[0.08]`) | M1 | R1 |
| 2 | Foundation UI Primitives | Apple-grade Button, Card, Dialog, Drawer, Slider, Tabs, Accordion, DropdownMenu | M1 | R1 |
| 3 | Spring Physics & Motion Transitions | Framer Motion spring curves on routes, dialogs, drawers, tabs (`layoutId`), accordions | M1 | R1 |
| 4 | Global Command Palette & Navigation | Mount `CommandPalette` in `AppLayout` connected to `useUIStore`; expand `MobileNav` to all 11 routes | M1 | R1, R2 |
| 5 | Quorum OS Branding Unification | Eradicate legacy "DocIntel" branding across all copy, tooltips, dialogs, charts | M1 | R1, AC |
| 6 | Backend Model Alignment | Add `vendor_name` and `total_amount` to `Document` SQLAlchemy model in `document.py` | M2 | R3 |
| 7 | Next.js Config Sanitization | Remove invalid `eslint` key, remove `ignoreBuildErrors: true`, add `/admin/:path*` rewrite proxy | M2 | R1, R3 |
| 8 | Typed API Client Synchronization | Implement all 15+ missing typed methods in `api.ts`, eliminate silent fallback mock generator | M2 | R3 |
| 9 | Clean-Slate Auth & Onboarding | Remove auto-provisioned mock founder session from `auth.ts`, clean empty state onboarding | M2 | R3 |
| 10 | Strict Type Safety & Compile Health | Resolve 45+ TypeScript compilation errors across pages/components; strict `tsc --noEmit` pass | M2 | AC |
| 11 | Landing Page Keynote Elevation (`/`) | Hero keynote, interactive bounding box document studio, 5-stage bento cards, ROI calculator, comparison table, frosted auth modal | M3 | R2 |
| 12 | Dashboard Elevation (`/dashboard`) | KPI cards, spatial spend charts, quick upload dropzone, recent pipelines feed from `auditLogs`, clean-slate trends | M3 | R2 |
| 13 | Document Management Elevation (`/documents`) | Grid/table views, filter tags, batch actions, search filters, working upload drawer, frosted delete modal, pagination | M3 | R2 |
| 14 | Document Audit & Review Elevation (`/review`) | 1000x1000 spatial viewer with crosshairs, bounding box inspection, consensus verdicts, fix `uploader_name` crash | M3 | R2 |
| 15 | Analytics & Spend Intelligence Elevation (`/analytics`) | Time-series charts, vendor anomaly breakdown, tax & reconciliation variance tracking card (`recVariances`) | M3 | R2 |
| 16 | Unified Search & Vector Query Elevation (`/search`) | Semantic query input, filter chips, snippet highlights, responsive RAG copilot panel | M3 | R2 |
| 17 | Crawler & Ingestion Elevation (`/crawl`) | Job monitors, rate limiter gauges, batch queue tables, working stop-crawl mutation, CSV export handlers | M4 | R2 |
| 18 | Benchmarks & Accuracy Elevation (`/benchmarks`) | Fix Recharts BarChart key mismatches (`Quorum OS 7-Agent Consensus`), latency metrics, test run history | M4 | R2 |
| 19 | Subscription & Pricing Elevation (`/pricing`) | Tier comparison cards, plan feature breakdown, frosted glass checkout & confirmation modal, back-to-dashboard navigation | M4 | R2 |
| 20 | System Settings Elevation (`/settings`) | API keys, Biometric Passkey configuration (WebAuthn), ERP integrations (SAP S/4HANA, NetSuite, QuickBooks), theme toggles | M4 | R2 |
| 21 | Admin Console Elevation (`/admin`) | Organization management, role permissions matrix, structured tenant audit logs, connected backend proxy | M4 | R2 |
| 22 | Comprehensive E2E Testing Suite | Dual-track opaque-box test suite (Tiers 1-4) verifying all 21 features with zero mocks | E2E Track | Dual Track |
| 23 | Build & Deployment Verification | Strict `npm run build` with zero errors, zero typecheck errors, Vercel readiness | M5 | AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Design & implement opaque-box test suite across all 4 tiers, publish `TEST_READY.md` | Survey | IN_PROGRESS |
| M1 | Design System, UI Primitives & Global Layout | HIG Obsidian Titanium tokens, UI primitives, Framer Motion, CommandPalette, MobileNav, Branding | Survey | IN_PROGRESS |
| M2 | Backend Model Sync, API Client & Type Safety | `Document` model columns, `api.ts` typed methods & mock engine removal, auth cleanup, strict typecheck | Survey | IN_PROGRESS |
| M3 | Core Routes Elevation (Routes 1–6) | `/`, `/dashboard`, `/documents`, `/review`, `/analytics`, `/search` visual, interaction, and clean-slate polish | M1, M2 | PLANNED |
| M4 | Enterprise Routes Elevation (Routes 7–11) | `/crawl`, `/benchmarks`, `/pricing`, `/settings`, `/admin` visual, functional, and spec features | M1, M2 | PLANNED |
| M5 | Final Verification & 100% E2E Pass | Pass 100% of E2E test suite, strict `npm run build`, responsive validation across 375px to 4K | M3, M4, E2E | PLANNED |

## Interface Contracts
### Frontend `api.ts` ↔ Backend FastAPI Routes
- `api.getCrawlStats()`: `GET /api/crawl/stats` -> `{ total_crawled: number, active_jobs: number, queue_depth: number, avg_speed: number }`
- `api.startCrawl(url: string, maxPages?: number)`: `POST /api/crawl/start` -> `{ job_id: string, status: string }`
- `api.stopCrawl(jobId?: string)`: `POST /api/crawl/stop` -> `{ status: string }`
- `api.getReconciliationVariances()`: `GET /api/analytics/reconciliation-variances` -> `{ variances: Array<{ invoice_id: string, vendor: string, variance_amount: number, variance_type: string, status: string }> }`
- `api.getDynamicAlerts()`: `GET /api/analytics/alerts` -> `{ alerts: Array<{ id: string, title: string, severity: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', created_at: string, message: string }> }`
- `api.getAgentStats()`: `GET /api/analytics/agent-performance` -> `{ agents: Array<{ name: string, precision: number, recall: number, consensus_contribution: number }> }`
- `api.getSearchStats()`: `GET /api/search/stats` -> `{ total_queries: number, avg_latency_ms: number, cache_hit_rate: number }`
- `api.submitReview(id: string, payload: { status: string, notes?: string, approved_corrections?: any })`: `POST /api/documents/:id/review` -> `DocumentResponse`
- `api.getBookmarks()`: `GET /api/bookmarks` -> `Array<{ id: string, title: string, query: string, created_at: string }>`
- `api.getNotifications()`: `GET /api/notifications` -> `Array<{ id: string, title: string, message: string, read: boolean, timestamp: string }>`
- `api.markNotificationRead(id: string)`: `POST /api/notifications/:id/read` -> `{ success: boolean }`

### UI Store ↔ Components
- `useUIStore.getState().commandPaletteOpen`: boolean controlling visibility of `CommandPalette` modal.
- `useUIStore.getState().setCommandPaletteOpen(open: boolean)`: updates visibility.
