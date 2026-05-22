const axios = require('axios');

async function fetchLiveNews(query, fromHoursAgo = 72) {
  const from = new Date(Date.now() - fromHoursAgo * 3600 * 1000).toISOString();
  try {
    const res = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: query,
        from,
        sortBy: 'relevancy',
        pageSize: 5,
        language: 'en', // TODO: add Bangla sources separately
        apiKey: process.env.NEWS_API_KEY,
      },
      timeout: 5000,
    });
    return (res.data.articles || []).map(a => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name,
      publishedAt: a.publishedAt,
    }));
  } catch (err) {
    console.warn('NewsAPI error:', err.message);
    return [];
  }
}

module.exports = { fetchLiveNews };
