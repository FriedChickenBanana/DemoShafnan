const { getDb } = require('../db/client');
const { cacheGetOrSet } = require('../cache/redis');

async function getDomainReputation(domain) {
  const cacheKey = `domain:${domain}`;
  return cacheGetOrSet(cacheKey, 3600, async () => {
    const db = getDb();
    const res = await db.query(
      'SELECT * FROM domain_reputation WHERE domain = $1',
      [domain.toLowerCase().replace(/^www\./, '')]
    );
    return res.rows[0] || null;
  });
}

async function upsertDomainReputation(domain, data) {
  const db = getDb();
  await db.query(`
    INSERT INTO domain_reputation (domain, mbfc_rating, bias, credibility, sources_used, last_updated)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (domain) DO UPDATE SET
      mbfc_rating = EXCLUDED.mbfc_rating,
      bias = EXCLUDED.bias,
      credibility = EXCLUDED.credibility,
      sources_used = EXCLUDED.sources_used,
      last_updated = NOW()
  `, [domain, data.mbfcRating, data.bias, data.credibility, JSON.stringify(data.sources || [])]);
}

module.exports = { getDomainReputation, upsertDomainReputation };
