const axios = require('axios');

async function detectAiGenerated(imageBase64) {
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
      modelLikelyUsed: null, // Hive doesn't return this
    };
  } catch (err) {
    console.warn('Hive AI detection error:', err.message);
    return { isAI: false, confidence: 0, modelLikelyUsed: null };
  }
}

module.exports = { detectAiGenerated };
