const axios = require('axios');

async function reverseImageSearch(imageBase64) {
  try {
    // SerpAPI Google Reverse Image Search
    const res = await axios.post('https://serpapi.com/search', {
      engine: 'google_reverse_image',
      image_data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      api_key: process.env.SERPAPI_KEY,
    }, { timeout: 10000 });

    const results = res.data.image_results || [];
    return results.slice(0, 5).map(r => ({
      title: r.title,
      url: r.link,
      source: r.source?.name,
      date: r.date,
      thumbnail: r.thumbnail,
      snippet: r.snippet,
    }));
  } catch (err) {
    console.warn('SerpAPI reverse image search error:', err.message);
    return [];
  }
}

module.exports = { reverseImageSearch };
