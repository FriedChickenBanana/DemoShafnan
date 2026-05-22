const axios = require('axios');

const BASE_URL = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';

async function searchFactChecks(query, languageCode = 'en') {
  try {
    const res = await axios.get(BASE_URL, {
      params: {
        query,
        languageCode,
        key: process.env.GOOGLE_FACT_CHECK_API_KEY,
        pageSize: 5,
      },
      timeout: 5000,
    });

    const claims = res.data.claims || [];
    return claims.map(c => ({
      text: c.text,
      claimant: c.claimant,
      claimDate: c.claimDate,
      reviews: (c.claimReview || []).map(r => ({
        publisher: r.publisher?.name,
        url: r.url,
        title: r.title,
        rating: r.textualRating,
        reviewDate: r.reviewDate,
      })),
    }));
  } catch (err) {
    console.warn('Google Fact Check API error:', err.message);
    return [];
  }
}

module.exports = { searchFactChecks };
