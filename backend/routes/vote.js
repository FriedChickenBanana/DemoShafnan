const express = require('express');
const { getDb } = require('../db/client');

const router = express.Router();

// POST /claims/vote
router.post('/vote', async (req, res, next) => {
  const { claimId, vote } = req.body;
  const sessionId = req.sessionId;

  if (!claimId || !vote || !['agree', 'disagree', 'report'].includes(vote)) {
    return res.status(400).json({ error: 'Invalid vote data' });
  }

  try {
    const db = getDb();

    // Insert vote (unique constraint prevents double-voting)
    await db.query(`
      INSERT INTO votes (claim_id, session_id, vote)
      VALUES ($1, $2, $3)
      ON CONFLICT (claim_id, session_id) DO UPDATE SET vote = EXCLUDED.vote
    `, [claimId, sessionId, vote]);

    // Update denormalized counts
    await db.query(`
      INSERT INTO claim_vote_counts (claim_id, agree_count, disagree_count, report_count)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (claim_id) DO UPDATE SET
        agree_count    = claim_vote_counts.agree_count    + $2,
        disagree_count = claim_vote_counts.disagree_count + $3,
        report_count   = claim_vote_counts.report_count   + $4,
        updated_at     = NOW()
    `, [
      claimId,
      vote === 'agree'    ? 1 : 0,
      vote === 'disagree' ? 1 : 0,
      vote === 'report'   ? 1 : 0,
    ]);

    // ── Escalation logic ──────────────────────────────────────────────────────
    const counts = await db.query(
      'SELECT * FROM claim_vote_counts WHERE claim_id = $1',
      [claimId]
    );
    if (counts.rows.length) {
      const c = counts.rows[0];
      if (c.disagree_count > 50 || c.report_count > 10) {
        await db.query(
          'UPDATE claims SET escalated = TRUE WHERE id = $1',
          [claimId]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
