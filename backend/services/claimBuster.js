const axios = require('axios');

async function scoreClaimWorthiness(text) {
  try {
    const res = await axios.get('https://idir.uta.edu/claimbuster/api/v2/score/text/', {
      params: { input_text: text },
      headers: { 'x-api-key': process.env.CLAIMBUSTER_API_KEY },
      timeout: 5000,
    });
    const results = res.data.results || [];
    if (!results.length) return null;
    // Return highest score
    return Math.max(...results.map(r => r.score));
  } catch (err) {
    console.warn('ClaimBuster API error:', err.message);
    return null;
  }
}

module.exports = { scoreClaimWorthiness };
