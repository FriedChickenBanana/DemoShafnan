const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PRIMARY_MODEL = 'claude-sonnet-4-6';
const ESCALATION_MODEL = 'claude-opus-4-6';

// ── Text fact-check synthesis ────────────────────────────────────────────────
async function synthesizeVerdict({ claim, language, factCheckHits, liveNews, claimBusterScore, escalate = false }) {
  const model = escalate ? ESCALATION_MODEL : PRIMARY_MODEL;

  const systemPrompt = `You are TruthLens, a precise, neutral fact-checking AI. Your job is to evaluate claims using provided evidence.

Rules:
- Be concise and factual. No sensationalism.
- Never say "this is fake" — explain warning signs neutrally.
- Always cite sources from the provided evidence.
- If a claim mentions recent events, weight live news over stale fact-check databases.
- For Bangla or other non-English claims, respond in the same language as the claim but keep JSON keys in English.
- Verdicts: TRUE | FALSE | MISLEADING | UNVERIFIED | UNKNOWN

Response format: valid JSON only, no markdown:
{
  "verdict": "...",
  "confidence": 0.00,
  "summary": "...",
  "whyBot": {
    "emotionalLanguage": "...",
    "sourceQuality": "...",
    "logicalFallacies": "...",
    "verifiability": "..."
  },
  "sources": [{"title": "...", "url": "...", "publisher": "..."}],
  "category": "political|health|financial|social|other",
  "timeSensitive": true|false
}`;

  const userPrompt = `Claim to evaluate: "${claim}"
Language detected: ${language}
ClaimBuster check-worthiness score: ${claimBusterScore ?? 'N/A'}

Fact-check database hits:
${factCheckHits?.length ? JSON.stringify(factCheckHits, null, 2) : 'None found'}

Live news (last 72h):
${liveNews?.length ? JSON.stringify(liveNews, null, 2) : 'None found'}`;

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  });

  const text = message.content[0].text.trim();
  return JSON.parse(text);
}

// ── Image/vision analysis ─────────────────────────────────────────────────────
async function analyzeImage({ imageBase64, reverseImageResults, aiDetectionResult }) {
  const mediaType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const systemPrompt = `You are TruthLens Vision. Analyze this image for misinformation.

Your tasks:
1. Extract any visible text (OCR)
2. Describe the scene accurately
3. Identify claims made explicitly or implicitly
4. Evaluate using provided reverse image search results and AI detection data
5. Determine if the image is being used misleadingly (e.g., old image presented as new, out-of-context)

Response format: valid JSON only:
{
  "verdict": "TRUE|FALSE|MISLEADING|UNVERIFIED|UNKNOWN",
  "confidence": 0.00,
  "extractedText": "...",
  "sceneDescription": "...",
  "impliedClaims": ["..."],
  "summary": "...",
  "whyBot": "...",
  "sources": [{"title": "...", "url": "..."}]
}`;

  const userContent = [
    {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64Data },
    },
    {
      type: 'text',
      text: `Reverse image search results:\n${JSON.stringify(reverseImageResults, null, 2)}\n\nAI generation detection:\n${JSON.stringify(aiDetectionResult, null, 2)}`,
    },
  ];

  const message = await client.messages.create({
    model: PRIMARY_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: userContent }],
    system: systemPrompt,
  });

  return JSON.parse(message.content[0].text.trim());
}

module.exports = { synthesizeVerdict, analyzeImage };
