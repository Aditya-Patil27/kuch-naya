const crypto = require('crypto');

function toPositiveInt(raw, fallback) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function getTokenSecret() {
  return process.env.WS_TOKEN_SECRET || process.env.API_KEY || '';
}

function issueWsToken(clientId = 'ui') {
  const secret = getTokenSecret();
  if (!secret) {
    throw new Error('WS token secret is not configured');
  }

  const ttlSeconds = toPositiveInt(process.env.WS_TOKEN_TTL_SECONDS, 60);
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${clientId}.${expiresAt}.${nonce}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const token = Buffer.from(`${payload}.${signature}`, 'utf8').toString('base64url');
  return { token, expiresAt };
}

function verifyWsToken(token, expectedClientId = 'ui') {
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing-token' };
  }

  const secret = getTokenSecret();
  if (!secret) {
    return { ok: false, reason: 'missing-secret' };
  }

  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return { ok: false, reason: 'invalid-encoding' };
  }

  const parts = decoded.split('.');
  if (parts.length !== 4) {
    return { ok: false, reason: 'invalid-shape' };
  }

  const [clientId, expRaw, nonce, signature] = parts;
  if (!clientId || !expRaw || !nonce || !signature) {
    return { ok: false, reason: 'missing-fields' };
  }

  if (clientId !== expectedClientId) {
    return { ok: false, reason: 'wrong-client' };
  }

  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt)) {
    return { ok: false, reason: 'invalid-expiry' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }

  const payload = `${clientId}.${expiresAt}.${nonce}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const actualBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return { ok: false, reason: 'invalid-signature-length' };
  }

  const valid = crypto.timingSafeEqual(actualBuf, expectedBuf);
  return valid
    ? { ok: true, expiresAt }
    : { ok: false, reason: 'invalid-signature' };
}

module.exports = {
  issueWsToken,
  verifyWsToken,
};
