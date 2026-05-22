const axios = require('axios');

async function detectAiWritten(text) {
  try {
    const res = await axios.post(
      'https://api.gptzero.me/v2/predict/text',
      { document: text },
      {
        headers: {
          'x-api-key': process.env.GPTZERO_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      }
    );
    const doc = res.data?.documents?.[0];
    return {
      isAI: (doc?.completely_generated_prob || 0) > 0.5,
      confidence: doc?.completely_generated_prob || 0,
      aiPercent: doc?.average_generated_prob || 0,
    };
  } catch (err) {
    console.warn('GPTZero error:', err.message);
    return { isAI: false, confidence: 0, aiPercent: 0 };
  }
}

module.exports = { detectAiWritten };
