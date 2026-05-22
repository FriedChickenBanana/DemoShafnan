# TruthLens — Project Overview

## What Is This?

TruthLens is a Chrome browser extension that detects misinformation in real time as you browse the web. It works on **any website** — not just social media — and can analyse text, images, screenshots, and video thumbnails.

When you encounter a suspicious claim, a misleading headline, or an image that looks out of context, TruthLens checks it against fact-check databases, live news sources, and AI models, then shows you a verdict with an explanation.

It was built for a competition. The differentiators over existing tools are:
- Catches **misrepresented images** (e.g. a 2019 photo presented as a 2024 event)
- Detects **AI-generated content** — deepfakes, AI-written text
- Supports **Bangla** and other South Asian languages
- Works **on-device first** — most text never leaves your browser
- **Teaches** users to spot misinformation instead of just hiding it

---

## How It Works — User's Perspective

### 1. Right-click fact-check
Select any text on any webpage → right-click → "TruthLens: Fact-check this claim"
→ A card appears with: verdict, confidence %, why it was flagged, and sources.

### 2. Rectangle Box (the killer feature)
Click the extension icon → "Analyse Selected Area"
→ Draw a box over anything on screen (image, video thumbnail, screenshot, meme)
→ TruthLens takes a screenshot of that region, runs OCR on it, does a reverse image search, checks if it's AI-generated, and gives you a full analysis panel.

**Example:** You draw a box over a video titled "LOCAL VOTING FRAUD INVESTIGATION". TruthLens finds via reverse image search that the footage is from a 2019 infrastructure meeting — completely unrelated to elections. The panel explains this clearly.

### 3. Auto-highlight (coming in Phase 2)
TruthLens scans the page automatically and underlines suspicious claims in colour:
- Red = likely false
- Orange = misleading
- Yellow = unverified
- Green = verified true

### 4. Source Shield (coming in Phase 2)
Hover over any link → a tooltip shows the credibility rating of that news source.

### 5. Popup dashboard
Click the extension icon to see your weekly "Info Diet": how many claims you've seen, how many were flagged, and which categories (political, health, financial) appeared most.

---

## Architecture — Three Layers

```
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (runs in your browser)            │
│  ├── Content Script  — highlights, region drawer    │
│  ├── Service Worker  — context menu, screenshots    │
│  └── Popup UI        — dashboard, settings          │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS (HMAC-signed requests)
                     ▼
┌─────────────────────────────────────────────────────┐
│  Backend API (Node.js/Express on Railway/Render)    │
│  ├── /factcheck/text   — text pipeline              │
│  ├── /factcheck/image  — vision pipeline            │
│  ├── /factcheck/live   — live news cross-reference  │
│  ├── /ai-detect        — deepfake / AI-text check   │
│  ├── /claims/vote      — crowdsourced feedback      │
│  ├── /domain/reputation — source credibility        │
│  └── /user/dashboard   — info diet stats            │
└────────────────────┬────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────┐
│  Data & AI Layer                                    │
│  ├── Neon (PostgreSQL + pgvector)                   │
│  ├── Upstash Redis (cache + rate limits)            │
│  └── External APIs (see below)                      │
└─────────────────────────────────────────────────────┘
```

---

## What Happens When You Fact-Check Text

1. **Normalize** the claim (lowercase, strip noise) and hash it
2. **Check Redis cache** — if seen before, return instantly
3. **Check Postgres** — if previously analysed, return stored result
4. **Detect language** — English, Bangla, or other
5. **ClaimBuster** — score how "check-worthy" the claim is (0–1)
6. **Google Fact Check** — search existing fact-checker verdicts
7. **NewsAPI** — if the claim mentions recent events, fetch live news from the last 72 hours
8. **GPTZero** — check if the text was AI-written
9. **Claude** — synthesize all evidence into a structured verdict with confidence score and plain-English explanation
10. **Store** in Postgres + cache in Redis
11. **Return** JSON to the extension → rendered as a verdict card

## What Happens When You Analyse an Image (Rectangle Box)

1. Service worker calls `captureVisibleTab()` to screenshot the tab
2. Content script crops to the drawn rectangle (DPR-corrected for retina screens)
3. Cropped image POSTs to `/factcheck/image`
4. **In parallel:**
   - **Claude Vision** — OCR + scene description + implied claims
   - **SerpAPI** — reverse image search to find original source/context
   - **Hive AI** — check if the image is AI-generated or a deepfake
5. Claude synthesizes all results into a verdict
6. Extension renders the full analysis panel

---

## API Keys — What Each One Does

### `SHARED_SECRET`
**What it is:** A secret string you generate yourself (random 64-char hex).

**What it's used for:** Every request from the extension to the backend is signed with HMAC-SHA256 using this secret. The backend verifies the signature before processing any request. This prevents random people from hitting your backend and burning your API credits.

**How to get it:** Generate it yourself:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### `DATABASE_URL`
**What it is:** Connection string to a PostgreSQL database.

**What it's used for:** Stores everything persistent:
- Fact-check results (so the same claim isn't re-analysed every time)
- Crowdsourced votes on verdicts
- Domain reputation ratings
- Per-session usage stats (Info Diet dashboard)
- Claim embeddings for semantic similarity search (Phase 2)

**Recommended provider:** [Neon](https://neon.tech) — free tier, has pgvector built in, no local setup needed.

**After getting the URL:** Run the schema once:
```bash
psql $DATABASE_URL < backend/db/schema.sql
```

---

### `REDIS_URL`
**What it is:** Connection string to a Redis instance.

**What it's used for:**
- **Hot cache** — stores recent fact-check results for 1 hour so repeated checks return instantly without hitting Claude
- **Rate limiting** — tracks request counts per session to enforce the 20 requests/minute cap

**Recommended provider:** [Upstash](https://upstash.com) — free tier (10k commands/day), works over HTTPS (use the `rediss://` TLS URL they provide).

---

### `ANTHROPIC_API_KEY`
**What it is:** Your Anthropic API key.

**What it's used for:** This is the core intelligence of TruthLens.

- **`claude-sonnet-4-6`** (primary) — used for every fact-check. Given a claim, all fact-check database hits, and live news snippets, it reasons about the evidence and returns a structured verdict with confidence score, summary, and a "Why Bot" breakdown (emotional language, source quality, logical fallacies, verifiability).
- **`claude-sonnet-4-6` Vision** — used for the Rectangle Box feature. Given a cropped screenshot + reverse image results + AI-detection data, it does OCR, describes the scene, identifies implied claims, and gives a verdict.
- **`claude-opus-4-6`** (escalation only) — used when a verdict gets flagged by crowdsourced votes (>50 disagrees or >10 reports). Re-analyses the claim with the most capable model.

**Cost note:** claude-sonnet-4-6 is ~$3/MTok input, ~$15/MTok output. A typical fact-check uses ~800 tokens in + ~300 tokens out ≈ $0.007 per check.

**Where to get it:** [console.anthropic.com](https://console.anthropic.com) → API Keys

---

### `GOOGLE_FACT_CHECK_API_KEY`
**What it is:** A Google Cloud API key with the Fact Check Tools API enabled.

**What it's used for:** Searches a database of published fact-checks from major fact-checking organizations worldwide (PolitiFact, Snopes, AFP, Reuters Fact Check, etc.). When a claim matches something already debunked, this returns the existing verdict and a link to the original fact-check article. Fast, free, and catches known misinformation instantly.

**Cost:** Free. No billing required.

**Where to get it:** [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Enable "Fact Check Tools API" → Credentials → Create API Key

---

### `CLAIMBUSTER_API_KEY`
**What it is:** API key for ClaimBuster, an academic tool from UT Arlington.

**What it's used for:** Before sending a sentence to Claude (which costs money), ClaimBuster scores it from 0–1 on "check-worthiness" — essentially, is this a verifiable factual claim or just an opinion/noise? Sentences below the threshold (e.g. "I love pizza") are skipped. This reduces unnecessary Claude calls by ~60–80%.

**Cost:** Free for research/competition use.

**Where to get it:** Register at [idir.uta.edu/claimbuster](https://idir.uta.edu/claimbuster) or email idir@uta.edu

---

### `SERPAPI_KEY`
**What it is:** API key for SerpAPI, a Google Search results scraper.

**What it's used for:** Powers the **reverse image search** in the Rectangle Box feature. When you draw a box over an image, TruthLens sends it to SerpAPI which runs a Google Reverse Image Search and returns where that image (or visually similar ones) appeared before — with dates and context. This is how TruthLens catches images being reused out of context (e.g. a 2019 photo presented as something that happened today).

**Cost:** Free tier = 100 searches/month. Paid plans from $50/month.

**Where to get it:** [serpapi.com](https://serpapi.com) → Sign up → Dashboard → API Key

---

### `HIVE_AI_KEY`
**What it is:** API key for Hive AI's Visual Moderation API.

**What it's used for:** Detects whether an image was **AI-generated** (DALL-E, Midjourney, Stable Diffusion, etc.) or is a deepfake. Returns a confidence score. Shown as a badge on the analysis card: `🤖 Likely AI-generated (87%)`. Combined with the Rectangle Box — if you draw a box over a suspicious photo, TruthLens checks if it's synthetic.

**Cost:** Paid API. Request access at [thehive.ai](https://thehive.ai). If access is slow, **Sightengine** (`sightengine.com`) is a faster-signup alternative with a similar API shape.

**Where to get it:** [thehive.ai](https://thehive.ai) → Request API Access

---

### `GPTZERO_API_KEY`
**What it is:** API key for GPTZero's AI-text detection API.

**What it's used for:** Detects whether a piece of text was **written by an AI** (ChatGPT, Claude, Gemini, etc.). Returns a probability score. Shown on the verdict card. Especially useful for detecting AI-generated disinformation articles, fake quotes, and synthetic news.

**Cost:** Free tier = 10,000 words/month.

**Where to get it:** [gptzero.me](https://gptzero.me) → Sign Up → API section

---

### `NEWS_API_KEY`
**What it is:** API key for NewsAPI.org.

**What it's used for:** Powers the **live news cross-reference** feature. When a claim contains time-sensitive words ("yesterday", "this week", "breaking") or named entities, TruthLens fetches the top 5 recent news stories from trusted sources (Reuters, AP, BBC, etc.) matching the claim's topic. These are handed to Claude alongside the claim so it can verify against what actually happened — not just a stale fact-check database. This catches misinformation that piggybacks on real breaking events.

**Cost:** Free developer tier = 100 requests/day, English articles only.

**Where to get it:** [newsapi.org/register](https://newsapi.org/register)

---

### `VOYAGE_API_KEY`
**What it is:** API key for Voyage AI's text embedding API.

**What it's used for:** Powers **cross-platform claim sync** (Phase 2, not yet built). The idea: when a claim is fact-checked, its semantic embedding (a 1536-dimension vector) is stored in Postgres via pgvector. When the same claim appears later — even paraphrased or on a different platform — the embedding similarity lookup catches it instantly without re-running Claude. A claim debunked on Facebook auto-flags on X seconds later.

**Cost:** Free tier available. Not needed until Phase 2.

**Where to get it:** [voyageai.com](https://voyageai.com) → API Keys

---

## What You Can Skip for the Initial Demo

For the core demo (right-click fact-check + Rectangle Box), you only need these 5 keys:

| Key | Why needed |
|---|---|
| `SHARED_SECRET` | Security — generate locally |
| `DATABASE_URL` | Store results |
| `REDIS_URL` | Cache + rate limits |
| `ANTHROPIC_API_KEY` | The AI brain |
| `GOOGLE_FACT_CHECK_API_KEY` | Fact-check database |

The services for `SERPAPI_KEY`, `HIVE_AI_KEY`, `GPTZERO_API_KEY`, and `NEWS_API_KEY` are all written to return empty/safe fallbacks if the API call fails — so the app won't crash without them, it just skips those enrichment steps.

---

## Project File Structure

```
misinformation-filter/
├── extension/                   ← Chrome extension (load unpacked)
│   ├── manifest.json            ← MV3 permissions + entry points
│   ├── background.js            ← Service worker: context menu, screenshot, signing
│   ├── shared/messages.js       ← Message type constants
│   ├── content/content.js       ← Injected on every page: verdict card, region drawer
│   ├── styles/content.css       ← Highlight colours, nuclear blur
│   ├── i18n/en.json             ← English UI strings
│   ├── i18n/bn.json             ← Bangla UI strings
│   └── popup/                   ← React + Vite popup app
│       └── src/
│           ├── App.jsx          ← Shell: master toggle, tab nav
│           ├── Dashboard.jsx    ← Weekly info diet stats
│           └── Settings.jsx     ← Feature toggles
│
└── backend/                     ← Node.js/Express API
    ├── index.js                 ← Server, middleware, route mounting
    ├── middleware/auth.js       ← HMAC signature verification
    ├── db/
    │   ├── client.js            ← PostgreSQL pool
    │   └── schema.sql           ← Tables + pgvector index
    ├── cache/redis.js           ← Redis wrapper
    ├── routes/
    │   ├── factcheck.js         ← POST /factcheck/text (11-step pipeline)
    │   ├── vision.js            ← POST /factcheck/image
    │   ├── live.js              ← POST /factcheck/live
    │   ├── aidetect.js          ← POST /ai-detect/text|image
    │   ├── vote.js              ← POST /claims/vote
    │   ├── domain.js            ← GET  /domain/reputation
    │   └── dashboard.js         ← GET  /user/dashboard
    └── services/
        ├── claude.js            ← synthesizeVerdict + analyzeImage
        ├── googleFactCheck.js
        ├── claimBuster.js
        ├── newsapi.js
        ├── serpapi.js
        ├── hive.js
        ├── gptzero.js
        └── domainRep.js
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Extension | Chrome MV3, Vanilla JS | Required by Chrome; vanilla keeps bundle small |
| Popup UI | React + Vite | Component model for the dashboard/settings UI |
| Backend | Node.js + Express | Fast to develop, huge ecosystem |
| Database | PostgreSQL + pgvector (Neon) | Relational + vector search in one service |
| Cache | Redis (Upstash) | Sub-millisecond cache lookups |
| Primary AI | claude-sonnet-4-6 | Best reasoning + vision + Bangla support |
| Escalation AI | claude-opus-4-6 | For crowdsource-flagged re-reviews |
| Fact-check DB | Google Fact Check Tools API | Largest aggregated fact-check database |
| Claim scoring | ClaimBuster | Filters non-claims before hitting Claude |
| Reverse image | SerpAPI | Google RIS with a clean API wrapper |
| AI image detect | Hive AI | Deepfake + AI-generation detection |
| AI text detect | GPTZero | AI-written text probability |
| Live news | NewsAPI | Recent stories for time-sensitive claims |
| Embeddings | Voyage AI | Semantic claim similarity (Phase 2) |
