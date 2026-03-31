function toPositiveInt(raw, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function createRateLimiter(options = {}) {
  const windowMs = toPositiveInt(options.windowMs, 60_000);
  const max = toPositiveInt(options.max, 60);
  const keyFn = typeof options.keyFn === 'function'
    ? options.keyFn
    : (req) => req.ip || 'unknown';
  const name = options.name || 'rate-limit';

  const entries = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries.entries()) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${String(keyFn(req) || 'unknown')}`;
    const existing = entries.get(key);

    if (!existing || existing.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('x-ratelimit-limit', String(max));
      res.setHeader('x-ratelimit-remaining', String(Math.max(max - 1, 0)));
      return next();
    }

    existing.count += 1;
    res.setHeader('x-ratelimit-limit', String(max));
    res.setHeader('x-ratelimit-remaining', String(Math.max(max - existing.count, 0)));

    if (existing.count > max) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      res.setHeader('retry-after', String(Math.max(retryAfter, 1)));
      return res.status(429).json({ error: 'Too Many Requests', limit: max, windowMs });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter,
};
