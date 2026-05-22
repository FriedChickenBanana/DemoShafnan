const express = require('express');
const { getDomainReputation } = require('../services/domainRep');

const router = express.Router();

// GET /domain/reputation?domain=example.com
router.get('/reputation', async (req, res, next) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain query param required' });

  try {
    const rep = await getDomainReputation(domain);
    res.json(rep || { domain, credibility: null, mbfc_rating: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
