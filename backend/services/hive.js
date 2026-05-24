const axios = require('axios');

async function detectAiGenerated(imageBase64) {
  // Hive AI bypassed — no API key yet, restore when available
  return { is_ai_generated: null, confidence: null };

  /* eslint-disable no-unreachable */
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const res = await axios.post(
      'https://api.thehive.ai/api/v2/task/sync',
      { image: base64Data },
      {
        headers: {
          Authorization: `Token ${process.env.HIVE_AI_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const output = res.data?.status?.[0]?.response?.output?.[0]?.classes || [];
    const aiClass = output.find(c => c.class === 'ai_generated');
    return {
      isAI: aiClass ? aiClass.score > 0.5 : false,
      confidence: aiClass?.score || 0,
      modelLikelyUsed: null,
    };
  } catch (err) {
    console.warn('Hive AI detection error:', err.message);
    return { isAI: false, confidence: 0, modelLikelyUsed: null };
  }
  /* eslint-enable no-unreachable */
}

module.exports = { detectAiGenerated };
