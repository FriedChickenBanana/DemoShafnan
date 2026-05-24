const express = require('express');
const crypto = require('crypto');
const franc = require('franc-min');
const { synthesizeVerdict } = require('../services/claude');
const { searchFactChecks } = require('../services/googleFactCheck');
const { scoreClaimWorthiness } = require('../services/claimBuster');
const { fetchLiveNews } = require('../services/newsapi');
const { detectAiWritten } = require('../services/gptzero');
const { getDb } = require('../db/client');
const { cacheGetOrSet, getRedis } = require('../cache/redis');

const router = express.Router();

// Normalize claim text for consistent hashing
function normalizeClaim(text) {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\w\s'.,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashClaim(normalizedText) {
  return crypto.createHash('sha256').update(normalizedText).digest('hex');
}

// POST /factcheck/text
router.post('/text', async (req, res, next) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Text must be at least 10 characters' });
  }
  if (text.length > 5000) {
    return res.status(400).json({ error: 'Text too long (max 5000 chars)' });
  }

  try {
    const normalized = normalizeClaim(text);
    const textHash = hashClaim(normalized);

    // ── 1. Check Redis hot cache ─────────────────────────────────────────────
    const cacheKey = `claim:${textHash}`;
    const cached = await getRedis().get(cacheKey);
    if (cached) {
      return res.json({ ...JSON.parse(cached), cached: true });
    }

    // ── 2. Check Postgres for existing verdict ──────────────────────────────
    const db = getDb();
    const existing = await db.query(
      'SELECT * FROM claims WHERE text_hash = $1',
      [textHash]
    );
    if (existing.rows.length) {
      const row = existing.rows[0];
      const result = {
        claimId: row.id,
        verdict: row.verdict,
        confidence: row.confidence,
        summary: row.summary,
        whyBot: row.why_bot,
        sources: row.sources,
        aiGenerated: row.ai_generated,
        language: row.language,
      };
      await getRedis().set(cacheKey, JSON.stringify(result), 'EX', 3600);
      return res.json({ ...result, cached: true });
    }

    // ── 3. Detect language ───────────────────────────────────────────────────
    const langCode = franc(normalized) || 'und';
    const language = langCode === 'und' ? 'en' : langCode;

    // ── 4. ClaimBuster check-worthiness ──────────────────────────────────────
    const claimBusterScore = await scoreClaimWorthiness(text.slice(0, 500));

    // ── 5. Google Fact Check ──────────────────────────────────────────────────
    const factCheckHits = await searchFactChecks(text.slice(0, 200), language.slice(0, 2));

    // ── 6. Live news (if time-sensitive indicators present) ──────────────────
    const timeSensitiveWords = /yesterday|today|this week|breaking|just in|latest|recent|hours ago/i;
    let liveNews = [];
    if (timeSensitiveWords.test(text)) {
      // Extract first ~100 chars as search query
      liveNews = await fetchLiveNews(text.slice(0, 100));
    }

    // ── 7. AI text detection ─────────────────────────────────────────────────
    const aiTextResult = await detectAiWritten(text.slice(0, 1000));

    // ── 8. Claude synthesis ──────────────────────────────────────────────────
    const verdict = await synthesizeVerdict(text, {
      googleFactCheck: factCheckHits,
      newsSnippets: liveNews,
      claimBusterScore,
      gptzeroResult: aiTextResult,
      language,
    });

    // ── 9. Persist to DB ─────────────────────────────────────────────────────
    const insertResult = await db.query(`
      INSERT INTO claims (text_hash, text_snippet, verdict, confidence, summary, why_bot, sources, ai_generated, language)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      textHash,
      normalized.slice(0, 500),
      verdict.verdict,
      verdict.confidence,
      verdict.summary,
      typeof verdict.why === 'object' ? JSON.stringify(verdict.why) : (verdict.why ?? verdict.whyBot),
      JSON.stringify(verdict.sources || []),
      JSON.stringify(aiTextResult),
      language,
    ]);

    const claimId = insertResult.rows[0].id;

    const result = {
      claimId,
      verdict: verdict.verdict,
      confidence: verdict.confidence,
      summary: verdict.summary,
      whyBot: verdict.why ?? verdict.whyBot,
      sources: verdict.sources,
      aiGenerated: aiTextResult,
      language,
      category: verdict.category,
      timeSensitive: verdict.timeSensitive,
    };

    // ── 10. Cache in Redis (1 hour) ──────────────────────────────────────────
    await getRedis().set(cacheKey, JSON.stringify(result), 'EX', 3600);

    // ── 11. Update session stats ──────────────────────────────────────────────
    const sessionId = req.sessionId;
    await db.query(`
      INSERT INTO session_stats (session_id, claims_seen, claims_flagged, categories_seen)
      VALUES ($1, 1, $2, $3)
      ON CONFLICT (session_id) DO UPDATE SET
        claims_seen = session_stats.claims_seen + 1,
        claims_flagged = session_stats.claims_flagged + $2,
        last_active = NOW()
    `, [
      sessionId,
      ['FALSE', 'MISLEADING'].includes(verdict.verdict) ? 1 : 0,
      JSON.stringify({ [verdict.category || 'other']: 1 }),
    ]);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
