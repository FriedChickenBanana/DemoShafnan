const express = require('express');
const { detectAiGenerated } = require('../services/hive');
const { detectAiWritten } = require('../services/gptzero');

const router = express.Router();

// POST /ai-detect/image
router.post('/image', async (req, res, next) => {
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });
  try {
    const result = await detectAiGenerated(imageBase64);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /ai-detect/text
router.post('/text', async (req, res, next) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  try {
    const result = await detectAiWritten(text);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
