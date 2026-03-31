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
