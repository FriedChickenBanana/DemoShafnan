const crypto = require('crypto');

const SHARED_SECRET = process.env.SHARED_SECRET;
const TIMESTAMP_TOLERANCE_MS = 30_000; // 30 seconds

async function verifySignature(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  if (!sessionId || !timestamp || !signature) {
    return res.status(401).json({ error: 'Missing auth headers' });
  }

  // Check timestamp freshness (replay attack prevention)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
    return res.status(401).json({ error: 'Request timestamp expired' });
  }

  // Recompute HMAC
  const message = timestamp + JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', SHARED_SECRET)
    .update(message)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  req.sessionId = sessionId;
  next();
}

module.exports = { verifySignature };
