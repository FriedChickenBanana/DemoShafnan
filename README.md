# TruthLens — Misinformation Filter

Real-time misinformation detection Chrome extension with AI fact-checking, reverse image search, region capture, and Bangla language support.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ with [pgvector](https://github.com/pgvector/pgvector) extension
- Redis (local or [Upstash](https://upstash.com))
- Chrome 120+ (Manifest V3)
- API keys (see Environment Variables below)

---

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env        # fill in all values
psql $DATABASE_URL < db/schema.sql
npm run dev                 # starts on PORT 3000
```

Verify: `curl http://localhost:3000/health` → `{"status":"ok"}`

---

## Extension Setup

1. Build the popup: `cd extension/popup && npm install && npm run build`
2. Open Chrome → `chrome://extensions` → Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` directory
4. The TruthLens icon appears in the toolbar

### Popup Dev (hot reload)

```bash
cd extension/popup
npm install
npm run dev     # Vite dev server at http://localhost:5173
```

Note: `chrome.*` APIs only work inside the loaded extension, not in the Vite dev server.

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default 3000) |
| `NODE_ENV` | `development` or `production` |
| `SHARED_SECRET` | HMAC-SHA256 signing secret (must match extension build) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `ANTHROPIC_API_KEY` | Claude API key (claude-sonnet-4-6 + claude-opus-4-6) |
| `GOOGLE_FACT_CHECK_API_KEY` | [Google Fact Check Tools API](https://developers.google.com/fact-check/tools/api) |
| `CLAIMBUSTER_API_KEY` | [ClaimBuster](https://idir.uta.edu/claimbuster/) check-worthiness scoring |
| `SERPAPI_KEY` | [SerpAPI](https://serpapi.com) reverse image search |
| `HIVE_AI_KEY` | [Hive AI](https://thehive.ai) AI-generated image detection |
| `GPTZERO_API_KEY` | [GPTZero](https://gptzero.me) AI-written text detection |
| `NEWS_API_KEY` | [NewsAPI](https://newsapi.org) live news cross-reference |
| `VOYAGE_API_KEY` | Voyage AI embeddings (Phase 2 — pgvector claim sync) |

---

## API Endpoints

All endpoints (except `/health`) require HMAC-signed requests with headers:
`X-Session-ID`, `X-Timestamp`, `X-Signature`

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check (no auth) |
| `POST` | `/factcheck/text` | Full text fact-check pipeline |
| `POST` | `/factcheck/image` | Image analysis + reverse search |
| `POST` | `/factcheck/live` | Live news query |
| `POST` | `/ai-detect/text` | AI-written text detection (GPTZero) |
| `POST` | `/ai-detect/image` | AI-generated image detection (Hive) |
| `POST` | `/claims/vote` | Submit agree/disagree/report vote |
| `POST` | `/claims/sync` | Semantic claim similarity (Phase 2) |
| `GET` | `/domain/reputation?domain=` | Source Shield domain lookup |
| `GET` | `/user/dashboard` | Info Diet session stats |

---

## Architecture

```
Chrome Extension (MV3)
├── background.js          Service Worker — HMAC signing, API calls, context menu
├── content/content.js     IIFE — verdict card, region drawer, highlights
├── popup/                 React + Vite — Dashboard, Settings toggles
└── shared/messages.js     Message type constants

Backend (Node.js / Express)
├── middleware/auth.js     HMAC-SHA256 request verification
├── routes/
│   ├── factcheck.js       Text pipeline (ClaimBuster → GoogleFC → NewsAPI → Claude)
│   ├── vision.js          Image pipeline (SerpAPI + Hive → Claude Vision)
│   ├── vote.js            Crowdsource voting + escalation
│   ├── domain.js          Source Shield reputation lookup
│   ├── live.js            NewsAPI proxy
│   ├── aidetect.js        GPTZero + Hive detection
│   ├── dashboard.js       Session stats
│   └── sync.js            pgvector similarity (Phase 2 stub)
├── services/
│   ├── claude.js          Anthropic SDK wrapper (sonnet-4-6 / opus-4-6)
│   ├── googleFactCheck.js Google Fact Check Tools API
│   ├── claimBuster.js     ClaimBuster scoring
│   ├── newsapi.js         NewsAPI live articles
│   ├── serpapi.js         Reverse image search
│   ├── hive.js            AI image detection
│   ├── gptzero.js         AI text detection
│   └── domainRep.js       DB + Redis domain reputation
├── db/
│   ├── client.js          PostgreSQL pool
│   └── schema.sql         Tables: claims, votes, domain_reputation, session_stats
└── cache/redis.js         ioredis wrapper + cacheGetOrSet helper

Data flow (text fact-check):
User selects text → context menu / content script
  → SW signs request → POST /factcheck/text
  → Redis cache check → Postgres dedup check
  → ClaimBuster + GoogleFC + NewsAPI (parallel where possible)
  → Claude claude-sonnet-4-6 synthesis
  → Persist to Postgres → Cache in Redis
  → Verdict card rendered in content script
```

---

## Deployment

**Backend** — Railway or Render:
- Set all env vars in dashboard
- Entry point: `node index.js`
- Update `BACKEND_URL` in `extension/background.js` before building

**Extension** — Chrome Web Store:
- Run `cd extension/popup && npm run build`
- Zip the `extension/` directory (including `popup/dist/`)
- Upload via [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
