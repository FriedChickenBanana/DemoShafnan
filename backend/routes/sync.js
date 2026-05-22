const express = require('express');
// F5 — Cross-platform claim sync (pgvector similarity)
// Full implementation in Phase 2 after embeddings service is wired up
const router = express.Router();

// POST /claims/sync — lookup similar claims by embedding
router.post('/sync', async (req, res) => {
  res.json({ message: 'Claim sync coming in Phase 2 (pgvector embeddings)' });
});

module.exports = router;
