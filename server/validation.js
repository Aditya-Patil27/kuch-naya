const VALID_ROLES = new Set(['viewer', 'operator', 'admin']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function toPositiveInt(raw, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function validateWebhookPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const pr = payload.pull_request;
  if (!pr || typeof pr !== 'object') {
    errors.push('pull_request is required');
  } else {
    if (!Number.isFinite(Number(pr.number))) {
      errors.push('pull_request.number is required');
    }
    if (!isNonEmptyString(pr.head?.sha)) {
      errors.push('pull_request.head.sha is required');
    }
    if (!isNonEmptyString(pr.diff_url)) {
      errors.push('pull_request.diff_url is required');
    }
  }

  if (!isNonEmptyString(payload.repository?.owner?.login)) {
    errors.push('repository.owner.login is required');
  }

  if (!isNonEmptyString(payload.repository?.name)) {
    errors.push('repository.name is required');
  }

  if (!Number.isFinite(Number(payload.installation?.id))) {
    errors.push('installation.id is required');
  }

  return { ok: errors.length === 0, errors };
}

function normalizeRole(role, fallback = 'viewer') {
  const value = String(role || '').toLowerCase();
  return VALID_ROLES.has(value) ? value : fallback;
}

function validateTokenIssuePayload(body) {
  const errors = [];
  const rawRole = body?.role;
  const normalizedRawRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
  const role = normalizeRole(rawRole, 'viewer');
  const subject = isNonEmptyString(body?.sub) ? body.sub.trim() : 'local-user';
  const tenantId = isNonEmptyString(body?.tenantId) ? body.tenantId.trim() : 'default';

  if (normalizedRawRole && !VALID_ROLES.has(normalizedRawRole)) {
    errors.push('role must be one of viewer, operator, admin');
  }

  if (!isNonEmptyString(subject)) {
    errors.push('sub is required');
  }

  if (!isNonEmptyString(tenantId)) {
    errors.push('tenantId is required');
  }

  return { ok: errors.length === 0, errors, value: { role, subject, tenantId } };
}

function validateTenantPayload(body) {
  const errors = [];

  const name = isNonEmptyString(body?.name) ? body.name.trim() : '';
  const githubOrg = isNonEmptyString(body?.githubOrg) ? body.githubOrg.trim() : null;

  if (!name) {
    errors.push('name is required');
  }

  if (name.length > 120) {
    errors.push('name must be <= 120 characters');
  }

  if (githubOrg && !/^[A-Za-z0-9_.-]+$/.test(githubOrg)) {
    errors.push('githubOrg has invalid characters');
  }

  return { ok: errors.length === 0, errors, value: { name, githubOrg } };
}

function validateRunnerTokenRequestPayload(body) {
  const rawRole = body?.role;
  const normalizedRawRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
  const role = normalizeRole(rawRole, 'operator');
  const expiresInMinutes = toPositiveInt(body?.expiresInMinutes, 60);
  const bounded = Math.min(Math.max(expiresInMinutes, 5), 7 * 24 * 60);

  const errors = [];
  if (normalizedRawRole && !VALID_ROLES.has(normalizedRawRole)) {
    errors.push('role must be one of viewer, operator, admin');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      role,
      expiresInMinutes: bounded,
    },
  };
}

function validateRunnerRegistrationPayload(body) {
  const errors = [];

  const registrationToken = isNonEmptyString(body?.registrationToken)
    ? body.registrationToken.trim()
    : '';
  const name = isNonEmptyString(body?.name) ? body.name.trim() : '';
  const capabilities = body?.capabilities && typeof body.capabilities === 'object'
    ? body.capabilities
    : {};

  if (!registrationToken) {
    errors.push('registrationToken is required');
  }

  if (!name) {
    errors.push('name is required');
  }

  if (name.length > 120) {
    errors.push('name must be <= 120 characters');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: { registrationToken, name, capabilities },
  };
}

module.exports = {
  VALID_ROLES,
  normalizeRole,
  validateWebhookPayload,
  validateTokenIssuePayload,
  validateTenantPayload,
  validateRunnerTokenRequestPayload,
  validateRunnerRegistrationPayload,
};
