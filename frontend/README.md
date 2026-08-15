# DocIntel AI — Frontend

Next.js 15 application (App Router) for the DocIntel AI platform.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State**: Zustand

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | KPI overview, system health monitoring |
| `/documents` | Document management — upload, filter, grid/table views |
| `/review` | Human-in-the-loop review with split-screen editor |
| `/search` | Hybrid search, RAG chatbot, bookmarks, export |
| `/analytics` | Charts and metrics across Documents, AI, Search, Crawl |
| `/crawl` | Web crawler console and PageRank visualization |
| `/settings` | User profile and preferences |

## Development

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

## Environment

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Docker

```bash
docker build -t docintel-frontend:latest .
```
