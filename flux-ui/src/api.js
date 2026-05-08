const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY || '';
const BEARER_TOKEN = import.meta.env.VITE_BEARER_TOKEN || '';

function withApiHeaders(headers = {}) {
  const next = { ...headers };
  if (API_KEY) next['x-api-key'] = API_KEY;
  if (BEARER_TOKEN) next.authorization = `Bearer ${BEARER_TOKEN}`;
  return next;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: withApiHeaders(options.headers || {}),
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function getJobs() {
  return request('/api/jobs');
}

export function getJob(id) {
  return request(`/api/jobs/${id}`);
}

export function health() {
  return request('/api/health');
}

export function getWsToken() {
  return request('/api/ws-token');
}

export function wsUrl(wsToken) {
  const url = new URL(API_BASE);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new URL(`${protocol}//${url.host}/ws`);

  if (wsToken) {
    ws.searchParams.set('ws_token', wsToken);
  }

  return ws.toString();
}

export function getMetrics() {
  return request('/api/metrics');
}

export function getDeadLetterJobs() {
  return request('/api/jobs/dead-letter');
}

export function retryJob(id) {
  return request(`/api/jobs/${id}/retry`, { method: 'POST' });
}

export function getTenants() {
  return request('/api/tenants');
}

export function createTenant(data) {
  return request('/api/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export function getRunners() {
  return request('/api/runners');
}

export function getJobStats() {
  return request('/api/jobs/stats');
}

export function getSettings() {
  return request('/api/settings');
}

export function updateSetting(key, value) {
  return request(`/api/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
}

export function deleteJob(id) {
  return request(`/api/jobs/${id}`, { method: 'DELETE' });
}

export function deleteTenant(id) {
  return request(`/api/tenants/${id}`, { method: 'DELETE' });
}

export function deleteRunner(id) {
  return request(`/api/runners/${id}`, { method: 'DELETE' });
}

export function deleteSetting(key) {
  return request(`/api/settings/${key}`, { method: 'DELETE' });
}

export function getRateLimits() {
  return request('/api/config/rate-limits');
}
