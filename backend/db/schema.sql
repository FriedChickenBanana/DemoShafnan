-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Claims table (core fact-check results)
CREATE TABLE IF NOT EXISTS claims (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text_hash     TEXT NOT NULL,           -- SHA-256 of normalized claim text
  text_snippet  TEXT NOT NULL,           -- first 500 chars of normalized claim
  embedding     vector(1536),            -- for semantic similarity (F5)
  verdict       TEXT NOT NULL CHECK (verdict IN ('TRUE','FALSE','MISLEADING','UNVERIFIED','UNKNOWN')),
  confidence    FLOAT NOT NULL DEFAULT 0,
  summary       TEXT,
  why_bot       TEXT,                    -- explainability text
  sources       JSONB DEFAULT '[]',
  ai_generated  JSONB,                   -- {isAI, confidence, model_likely_used}
  reverse_image JSONB,                   -- reverse image search results
  language      TEXT DEFAULT 'en',
  escalated     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS claims_text_hash_idx ON claims (text_hash);
CREATE INDEX IF NOT EXISTS claims_embedding_idx ON claims USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Votes table (F6 crowdsourcing)
CREATE TABLE IF NOT EXISTS votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  claim_id   UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  vote       TEXT NOT NULL CHECK (vote IN ('agree','disagree','report')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (claim_id, session_id)  -- one vote per session per claim
);

CREATE INDEX IF NOT EXISTS votes_claim_id_idx ON votes (claim_id);

-- Aggregated vote counts (denormalized for read speed)
CREATE TABLE IF NOT EXISTS claim_vote_counts (
  claim_id       UUID PRIMARY KEY REFERENCES claims(id) ON DELETE CASCADE,
  agree_count    INT DEFAULT 0,
  disagree_count INT DEFAULT 0,
  report_count   INT DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Domain reputation (F7 Source Shield)
CREATE TABLE IF NOT EXISTS domain_reputation (
  domain        TEXT PRIMARY KEY,
  mbfc_rating   TEXT,    -- e.g. 'HIGH', 'MOSTLY_FACTUAL', 'MIXED', 'LOW', 'CONSPIRACY'
  bias          TEXT,    -- e.g. 'LEFT', 'CENTER', 'RIGHT', 'EXTREME_RIGHT'
  credibility   FLOAT,   -- 0.0–1.0
  sources_used  JSONB DEFAULT '[]',
  last_updated  TIMESTAMPTZ DEFAULT NOW()
);

-- Image perceptual hash cache (F3)
CREATE TABLE IF NOT EXISTS image_cache (
  phash       TEXT PRIMARY KEY,    -- perceptual hash
  claim_id    UUID REFERENCES claims(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Session stats for Info Diet (F12) — anonymous, local to session
CREATE TABLE IF NOT EXISTS session_stats (
  session_id         TEXT PRIMARY KEY,
  claims_seen        INT DEFAULT 0,
  claims_flagged     INT DEFAULT 0,
  categories_seen    JSONB DEFAULT '{}',   -- {political:3, health:1, ...}
  last_active        TIMESTAMPTZ DEFAULT NOW(),
  week_start         DATE DEFAULT CURRENT_DATE
);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER claims_updated_at BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
