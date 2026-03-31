const test = require('node:test');
const assert = require('node:assert/strict');

const { validateWebhookPayload } = require('../server/validation');

test('validateWebhookPayload accepts minimal valid payload', () => {
  const payload = {
    installation: { id: 123 },
    repository: {
      name: 'repo',
      owner: { login: 'owner' },
    },
    pull_request: {
      number: 99,
      head: { sha: 'abc123' },
      diff_url: 'https://github.com/owner/repo/pull/99.diff',
    },
  };

  const result = validateWebhookPayload(payload);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('validateWebhookPayload rejects missing fields', () => {
  const result = validateWebhookPayload({});
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});
