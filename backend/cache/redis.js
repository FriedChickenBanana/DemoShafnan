const Redis = require('ioredis');

let redis;

async function initRedis() {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    tls: { rejectUnauthorized: false },
  });
  redis.on('error', (err) => console.error('Redis error:', err));
  await redis.ping();
  console.log('Redis connected');
}

function getRedis() {
  if (!redis) throw new Error('Redis not initialized');
  return redis;
}

// Convenience: get or set with TTL
async function cacheGetOrSet(key, ttlSeconds, fetchFn) {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  const value = await fetchFn();
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
}

module.exports = { initRedis, getRedis, cacheGetOrSet };
