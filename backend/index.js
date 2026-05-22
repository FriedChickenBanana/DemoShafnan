require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { verifySignature } = require('./middleware/auth');
const factcheckRoutes = require('./routes/factcheck');
const visionRoutes = require('./routes/vision');
const liveRoutes = require('./routes/live');
const aidetectRoutes = require('./routes/aidetect');
const syncRoutes = require('./routes/sync');
const voteRoutes = require('./routes/vote');
const domainRoutes = require('./routes/domain');
const dashboardRoutes = require('./routes/dashboard');
const { initDb } = require('./db/client');
const { initRedis } = require('./cache/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // Allow Chrome extension origins (chrome-extension://) and dev tools
    if (!origin || origin.startsWith('chrome-extension://') || origin === 'http://localhost:5173') {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Session-ID', 'X-Timestamp', 'X-Signature'],
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req) => req.headers['x-session-id'] || req.ip,
  message: { error: 'Too many requests. Please slow down.' },
});

const factcheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // stricter for AI calls
  keyGenerator: (req) => req.headers['x-session-id'] || req.ip,
  message: { error: 'Fact-check rate limit exceeded.' },
});

app.use(express.json({ limit: '10mb' })); // allow base64 images
app.use(globalLimiter);

// ── Health check (no auth) ───────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Authenticated routes ──────────────────────────────────────────────────────
app.use('/factcheck', verifySignature, factcheckLimiter, factcheckRoutes);
app.use('/factcheck', verifySignature, factcheckLimiter, visionRoutes);
app.use('/factcheck', verifySignature, factcheckLimiter, liveRoutes);
app.use('/ai-detect', verifySignature, factcheckLimiter, aidetectRoutes);
app.use('/claims', verifySignature, syncRoutes);
app.use('/claims', verifySignature, voteRoutes);
app.use('/domain', verifySignature, domainRoutes);
app.use('/user', verifySignature, dashboardRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await initDb();
  await initRedis();
  app.listen(PORT, () => {
    console.log(`TruthLens API running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
