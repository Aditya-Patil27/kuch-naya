const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractPrincipal,
  requireRole,
  issueAccessToken,
  verifyAuthorizationHeader,
} = require('../server/auth');

const ORIGINAL_ENV = { ...process.env };

function makeReq(headers = {}) {
  return {
    header(name) {
      return headers[name.toLowerCase()] || headers[name] || undefined;
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test.beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.AUTH_JWT_SECRET = 'test-secret';
  delete process.env.API_KEY;
  delete process.env.AUTH_ISSUER;
  delete process.env.AUTH_AUDIENCE;
});

test.after(() => {
  process.env = ORIGINAL_ENV;
});

test('issues and verifies bearer token', async () => {
  const issued = issueAccessToken({
    subject: 'u-1',
    role: 'operator',
    tenantId: 'tenant-a',
  });

  const verified = await verifyAuthorizationHeader(`Bearer ${issued.token}`);
  assert.equal(verified.ok, true);
  assert.equal(verified.claims.sub, 'u-1');
  assert.equal(verified.claims.role, 'operator');
  assert.equal(verified.claims.tenantId, 'tenant-a');
});

test('extractPrincipal maps API key to admin', async () => {
  process.env.API_KEY = 'abc123';
  const principal = await extractPrincipal(makeReq({ 'x-api-key': 'abc123' }));
  assert.equal(principal.role, 'admin');
  assert.equal(principal.authType, 'api-key');
});

test('requireRole blocks insufficient role', async () => {
  const issued = issueAccessToken({
    subject: 'u-2',
    role: 'viewer',
    tenantId: 'default',
  });

  const req = makeReq({ authorization: `Bearer ${issued.token}` });
  const res = makeRes();

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  await requireRole('operator')(req, res, next);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'Forbidden');
});
