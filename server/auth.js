const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const { normalizeRole } = require('./validation');

const ROLE_WEIGHT = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

function securityConfigured() {
  return Boolean(process.env.API_KEY || process.env.AUTH_JWT_SECRET || process.env.OIDC_ISSUER);
}

function authMode() {
  return String(process.env.AUTH_MODE || 'auto').toLowerCase();
}

function parseAlgorithms(raw, fallback = ['RS256']) {
  const text = String(raw || '').trim();
  if (!text) return fallback;

  const parsed = text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return parsed.length ? parsed : fallback;
}

function parsePositiveInt(raw, fallback) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function isLocalJwtConfigured() {
  return Boolean(process.env.AUTH_JWT_SECRET);
}

function oidcConfig() {
  const issuer = String(process.env.OIDC_ISSUER || '').trim();
  const audience = String(process.env.OIDC_AUDIENCE || '').trim();
  const jwksUri = String(process.env.OIDC_JWKS_URI || '').trim()
    || (issuer ? `${issuer.replace(/\/$/, '')}/.well-known/jwks.json` : '');

  return {
    issuer,
    audience,
    jwksUri,
    algorithms: parseAlgorithms(process.env.OIDC_ALGORITHMS, ['RS256']),
    cacheMaxAge: parsePositiveInt(process.env.OIDC_JWKS_CACHE_MAX_AGE_MS, 600000),
    cacheMaxEntries: parsePositiveInt(process.env.OIDC_JWKS_CACHE_MAX_ENTRIES, 10),
    requestsPerMinute: parsePositiveInt(process.env.OIDC_JWKS_REQUESTS_PER_MINUTE, 10),
  };
}

function isOidcConfigured() {
  const config = oidcConfig();
  return Boolean(config.issuer && config.audience && config.jwksUri);
}

function tokenOptions() {
  const options = {
    algorithm: 'HS256',
    expiresIn: process.env.AUTH_TOKEN_TTL || '4h',
  };

  if (process.env.AUTH_ISSUER) {
    options.issuer = process.env.AUTH_ISSUER;
  }

  if (process.env.AUTH_AUDIENCE) {
    options.audience = process.env.AUTH_AUDIENCE;
  }

  return options;
}

function verifyOptions() {
  const options = {
    algorithms: ['HS256'],
  };

  if (process.env.AUTH_ISSUER) {
    options.issuer = process.env.AUTH_ISSUER;
  }

  if (process.env.AUTH_AUDIENCE) {
    options.audience = process.env.AUTH_AUDIENCE;
  }

  return options;
}

function oidcVerifyOptions() {
  const config = oidcConfig();
  return {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: config.algorithms,
    clockTolerance: parsePositiveInt(process.env.OIDC_CLOCK_TOLERANCE_SECONDS, 10),
  };
}

function parseBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== 'string') return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

function verifyLocalBearerToken(token) {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || !token) {
    return { ok: false, reason: 'missing-token-or-secret' };
  }

  try {
    const decoded = jwt.verify(token, secret, verifyOptions());
    return {
      ok: true,
      claims: decoded,
    };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

let cachedJwksClient;
let cachedJwksCacheKey;

function getJwksClient() {
  const config = oidcConfig();
  const cacheKey = JSON.stringify({
    jwksUri: config.jwksUri,
    cacheMaxAge: config.cacheMaxAge,
    cacheMaxEntries: config.cacheMaxEntries,
    requestsPerMinute: config.requestsPerMinute,
  });

  if (!cachedJwksClient || cachedJwksCacheKey !== cacheKey) {
    cachedJwksClient = jwksRsa({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxAge: config.cacheMaxAge,
      cacheMaxEntries: config.cacheMaxEntries,
      rateLimit: true,
      jwksRequestsPerMinute: config.requestsPerMinute,
    });
    cachedJwksCacheKey = cacheKey;
  }

  return cachedJwksClient;
}

function verifyOidcBearerToken(token) {
  if (!token) {
    return Promise.resolve({ ok: false, reason: 'missing-token' });
  }

  if (!isOidcConfigured()) {
    return Promise.resolve({ ok: false, reason: 'oidc-not-configured' });
  }

  const client = getJwksClient();

  function getSigningKey(header, callback) {
    if (!header?.kid) {
      callback(new Error('Missing kid in token header'));
      return;
    }

    client.getSigningKey(header.kid, (error, key) => {
      if (error) {
        callback(error);
        return;
      }
      callback(null, key.getPublicKey());
    });
  }

  return new Promise((resolve) => {
    jwt.verify(token, getSigningKey, oidcVerifyOptions(), (error, decoded) => {
      if (error) {
        resolve({ ok: false, reason: error.message });
        return;
      }

      resolve({ ok: true, claims: decoded, strategy: 'oidc' });
    });
  });
}

async function verifyBearerToken(token) {
  const mode = authMode();
  const localConfigured = isLocalJwtConfigured();
  const oidcConfigured = isOidcConfigured();

  if (mode === 'local') {
    return verifyLocalBearerToken(token);
  }

  if (mode === 'oidc') {
    return verifyOidcBearerToken(token);
  }

  if (localConfigured) {
    const local = verifyLocalBearerToken(token);
    if (local.ok) return local;
  }

  if (oidcConfigured) {
    return verifyOidcBearerToken(token);
  }

  return { ok: false, reason: 'no-auth-strategy-configured' };
}

async function verifyAuthorizationHeader(headerValue) {
  const token = parseBearerToken(headerValue);
  if (!token) {
    return { ok: false, reason: 'missing-bearer-token' };
  }
  return verifyBearerToken(token);
}

function buildPrincipalFromClaims(claims = {}) {
  return {
    id: String(claims.sub || 'user'),
    role: normalizeRole(claims.role, 'viewer'),
    tenantId: String(claims.tenantId || 'default'),
    authType: 'jwt',
  };
}

async function extractPrincipal(req) {
  const configuredApiKey = process.env.API_KEY;
  const headerApiKey = req.header('x-api-key');

  if (configuredApiKey && headerApiKey && headerApiKey === configuredApiKey) {
    return {
      id: 'api-key-admin',
      role: 'admin',
      tenantId: req.header('x-tenant-id') || 'default',
      authType: 'api-key',
    };
  }

  const verified = await verifyAuthorizationHeader(req.header('authorization'));
  if (verified.ok) {
    return buildPrincipalFromClaims(verified.claims);
  }

  if (!securityConfigured()) {
    return {
      id: 'anonymous-viewer',
      role: 'viewer',
      tenantId: 'default',
      authType: 'anonymous',
    };
  }

  return null;
}

function requireAuth(req, res, next) {
  return Promise.resolve()
    .then(async () => {
      const principal = await extractPrincipal(req);
      if (!principal) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.principal = principal;
      return next();
    })
    .catch((error) => {
      return res.status(401).json({ error: 'Unauthorized', detail: error.message });
    });
}

function hasRequiredRole(actualRole, requiredRole) {
  const actual = ROLE_WEIGHT[normalizeRole(actualRole, 'viewer')] || 0;
  const required = ROLE_WEIGHT[normalizeRole(requiredRole, 'viewer')] || 0;
  return actual >= required;
}

function requireRole(requiredRole = 'viewer') {
  return (req, res, next) => {
    return Promise.resolve()
      .then(async () => {
        const principal = await extractPrincipal(req);

        if (!principal) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!hasRequiredRole(principal.role, requiredRole)) {
          return res.status(403).json({ error: 'Forbidden', requiredRole });
        }

        req.principal = principal;
        return next();
      })
      .catch((error) => {
        return res.status(401).json({ error: 'Unauthorized', detail: error.message });
      });
  };
}

function issueAccessToken({ subject, role, tenantId, extraClaims = {} }) {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET is required to issue tokens');
  }

  const payload = {
    sub: subject,
    role: normalizeRole(role, 'viewer'),
    tenantId: tenantId || 'default',
    ...extraClaims,
  };

  const token = jwt.sign(payload, secret, tokenOptions());
  return {
    token,
    tokenType: 'Bearer',
    expiresIn: tokenOptions().expiresIn,
  };
}

module.exports = {
  extractPrincipal,
  requireAuth,
  requireRole,
  issueAccessToken,
  verifyAuthorizationHeader,
};
