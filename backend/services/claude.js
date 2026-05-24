const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

async function synthesizeVerdict(claim, evidence) {
  const { googleFactCheck, newsSnippets, claimBusterScore, gptzeroResult, language } = evidence;

  const prompt = `You are a fact-checking assistant. Analyse the following claim and evidence, then return a JSON verdict.

Claim: ${claim}
Language: ${language || 'English'}
ClaimBuster score: ${claimBusterScore}
Google Fact Check results: ${JSON.stringify(googleFactCheck)}
Live news snippets: ${JSON.stringify(newsSnippets)}
AI-written probability: ${JSON.stringify(gptzeroResult)}

Respond ONLY with a valid JSON object in this exact format, no markdown, no backticks:
{
  "verdict": "True" | "False" | "Misleading" | "Unverified",
  "confidence": <number 0-100>,
  "summary": "<plain English explanation in 2-3 sentences>",
  "why": {
    "emotional_language": "<yes/no and brief note>",
    "source_quality": "<assessment>",
    "logical_fallacies": "<any detected or none>",
    "verifiability": "<how verifiable is this claim>"
  },
  "sources": ["<source url or name if available>"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function analyzeImage(imageBase64, mimeType, serpResults, hiveResult) {
  const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a fact-checking assistant analysing an image.

Reverse image search results: ${JSON.stringify(serpResults)}
AI-generation detection: ${JSON.stringify(hiveResult)}

Analyse the image and respond ONLY with a valid JSON object, no markdown, no backticks:
{
  "ocr_text": "<any text visible in the image>",
  "scene_description": "<what the image shows>",
  "implied_claims": "<what claims this image makes or implies>",
  "verdict": "Authentic" | "Misleading" | "AI-Generated" | "Unverified",
  "confidence": <number 0-100>,
  "summary": "<plain English explanation in 2-3 sentences>",
  "is_ai_generated": <true|false|null>
}`;

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType || 'image/png'
    }
  };

  const result = await visionModel.generateContent([prompt, imagePart]);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { synthesizeVerdict, analyzeImage };
