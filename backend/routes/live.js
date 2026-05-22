const express = require('express');
const { fetchLiveNews } = require('../services/newsapi');

const router = express.Router();

// POST /factcheck/live
router.post('/live', async (req, res, next) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const news = await fetchLiveNews(query);
    res.json({ news });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
