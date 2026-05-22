const express = require('express');
const crypto = require('crypto');
const { analyzeImage } = require('../services/claude');
const { reverseImageSearch } = require('../services/serpapi');
const { detectAiGenerated } = require('../services/hive');
const { getDb } = require('../db/client');
const { getRedis } = require('../cache/redis');

const router = express.Router();

// POST /factcheck/image
router.post('/image', async (req, res, next) => {
  const { imageBase64 } = req.body;
  if (!imageBase64 || !imageBase64.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image data' });
  }

  // Size check (~10MB base64 limit)
  if (imageBase64.length > 13_000_000) {
    return res.status(400).json({ error: 'Image too large (max ~10MB)' });
  }

  try {
    // ── Perceptual hash cache lookup ─────────────────────────────────────────
    // We use a simple SHA-256 of the first 10k chars as a quick cache key
    // Full perceptual hashing would use imghash (requires file I/O, skip for now)
    const quickHash = crypto.createHash('sha256').update(imageBase64.slice(0, 10000)).digest('hex');
    const cacheKey = `image:${quickHash}`;
    const cached = await getRedis().get(cacheKey);
    if (cached) return res.json({ ...JSON.parse(cached), cached: true });

    // ── Parallel pipeline ─────────────────────────────────────────────────────
    const [reverseImageResults, aiDetectionResult] = await Promise.all([
      reverseImageSearch(imageBase64),
      detectAiGenerated(imageBase64),
    ]);

    // ── Claude Vision synthesis ───────────────────────────────────────────────
    const analysis = await analyzeImage({ imageBase64, reverseImageResults, aiDetectionResult });

    const result = {
      verdict: analysis.verdict,
      confidence: analysis.confidence,
      extractedText: analysis.extractedText,
      sceneDescription: analysis.sceneDescription,
      impliedClaims: analysis.impliedClaims,
      summary: analysis.summary,
      whyBot: analysis.whyBot,
      reverseImageMatches: reverseImageResults,
      aiGenerated: aiDetectionResult,
      sources: analysis.sources,
    };

    // ── Cache result ─────────────────────────────────────────────────────────
    await getRedis().set(cacheKey, JSON.stringify(result), 'EX', 7200);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
