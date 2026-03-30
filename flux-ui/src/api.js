const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`);
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

export function wsUrl() {
  const url = new URL(API_BASE);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws`;
}
