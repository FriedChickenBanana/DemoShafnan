const express = require('express');
const { getDb } = require('../db/client');

const router = express.Router();

// GET /user/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const db = getDb();
    const stats = await db.query(
      'SELECT * FROM session_stats WHERE session_id = $1',
      [req.sessionId]
    );
    res.json(stats.rows[0] || {
      claims_seen: 0,
      claims_flagged: 0,
      categories_seen: {},
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
