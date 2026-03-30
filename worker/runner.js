const path = require('path');
const { spawn } = require('child_process');

function parseDurationToMs(raw, unit) {
  const value = Number(raw);
  if (Number.isNaN(value)) return null;
  if (unit === 's') return value * 1000;
  if (unit === 'm') return value * 60 * 1000;
  return value;
}

function parseMetric(output, regex) {
  const match = output.match(regex);
  if (!match) return null;
  return parseDurationToMs(match[1], match[2]);
}

function parseK6Summary(output) {
  const p95 = parseMetric(output, /p\(95\)=\s*([\d.]+)\s*(ms|s|m)/i);
  const p99 = parseMetric(output, /p\(99\)=\s*([\d.]+)\s*(ms|s|m)/i);

  const rpsMatch = output.match(/http_reqs[^\n]*?([\d.]+)\/s/i);
  const errMatch = output.match(/http_req_failed[^\n]*?([\d.]+)%/i);

  return {
    p95: p95 ?? 0,
    p99: p99 ?? 0,
    rps: rpsMatch ? Number(rpsMatch[1]) : 0,
    errorRate: errMatch ? Number(errMatch[1]) : 0,
    raw: output,
  };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const details = `${stdout}\n${stderr}`.trim();
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}${details ? `: ${details}` : ''}`));
    });
  });
}

function dockerHostArgs() {
  if (process.platform === 'linux') {
    return ['--add-host', 'host.docker.internal:host-gateway'];
  }
  return [];
}

function hashedPort(seed, base, range) {
  const text = String(seed || 'flux');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return base + (Math.abs(hash) % range);
}

async function runK6Script({ script, targetUrl, vus = 50, duration = '30s' }) {
  const scriptsPath = path.resolve(process.cwd(), 'k6');
  const args = [
    'run',
    '--rm',
    ...dockerHostArgs(),
    '-v',
    `${scriptsPath}:/scripts:ro`,
    '-e',
    `TARGET_URL=${targetUrl}`,
    '-e',
    `VUS=${vus}`,
    '-e',
    `DURATION=${duration}`,
    'grafana/k6',
    'run',
    `/scripts/${script}`,
  ];

  const { stdout, stderr } = await runCommand('docker', args);
  const output = `${stdout}\n${stderr}`;
  return parseK6Summary(output);
}

function normalizeDiffUrl(diffUrl) {
  let parsed;
  try {
    parsed = new URL(diffUrl);
  } catch {
    throw new Error('Diff URL is invalid');
  }

  const allowedHosts = new Set(['github.com', 'api.github.com', 'raw.githubusercontent.com']);

  if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname)) {
    throw new Error('Diff URL host is not allowed');
  }

  return parsed.toString();
}

async function fetchDiff(diffUrl) {
  const safeUrl = normalizeDiffUrl(diffUrl);
  const timeoutMs = Number(process.env.DIFF_FETCH_TIMEOUT_MS || 15000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(safeUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Unable to fetch diff: HTTP ${res.status}`);
    }
    return res.text();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Diff fetch timed out');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function startToxiproxy(jobId, targetHost, targetPort) {
  const name = `flux-toxi-${String(jobId).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24)}`;
  const adminPort = hashedPort(`${jobId}-admin`, 18000, 1000);
  const listenPort = hashedPort(`${jobId}-listen`, 13000, 1000);

  const runArgs = [
    'run',
    '-d',
    '--name',
    name,
    '-p',
    `${adminPort}:8474`,
    '-p',
    `${listenPort}:${listenPort}`,
    'ghcr.io/shopify/toxiproxy',
  ];

  await runCommand('docker', runArgs);

  await new Promise((resolve) => setTimeout(resolve, 1200));

  const base = `http://127.0.0.1:${adminPort}`;

  const proxyRes = await fetch(`${base}/proxies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'app',
      listen: `0.0.0.0:${listenPort}`,
      upstream: `${targetHost}:${targetPort}`,
    }),
  });

  if (!proxyRes.ok) {
    throw new Error(`Failed creating toxiproxy proxy: HTTP ${proxyRes.status}`);
  }

  const toxicRes = await fetch(`${base}/proxies/app/toxics`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'latency_200ms',
      type: 'latency',
      stream: 'downstream',
      toxicity: 1,
      attributes: { latency: 200, jitter: 20 },
    }),
  });

  if (!toxicRes.ok) {
    throw new Error(`Failed creating latency toxic: HTTP ${toxicRes.status}`);
  }

  return { name, listenPort };
}

async function cleanupToxiproxy(containerName) {
  try {
    await runCommand('docker', ['rm', '-f', containerName]);
  } catch {
    // Cleanup must never fail the whole job.
  }
}

function computeVerdict(deltaPct) {
  if (deltaPct > 100) return 'BLOCK';
  if (deltaPct > 20) return 'WARN';
  return 'PASS';
}

async function runJob(payload, onStage) {
  const targetPort = Number(process.env.APP_TARGET_PORT || 3001);
  const targetHost = process.env.APP_TARGET_HOST || 'host.docker.internal';
  const targetBase = process.env.APP_TARGET_BASE_URL || `http://${targetHost}:${targetPort}`;

  onStage?.('diff', { progress: 15 });
  const diffText = await fetchDiff(payload.diff_url);

  onStage?.('baseline', { progress: 30 });
  const baseline = await runK6Script({
    script: 'baseline.js',
    targetUrl: targetBase,
    vus: Number(process.env.K6_VUS || 50),
    duration: process.env.K6_DURATION || '30s',
  });

  onStage?.('toxiproxy', { progress: 45 });
  const tox = await startToxiproxy(payload.id, targetHost, targetPort);

  let chaos;
  try {
    onStage?.('chaos', { progress: 65 });
    chaos = await runK6Script({
      script: 'chaos.js',
      targetUrl: `http://${targetHost}:${tox.listenPort}`,
      vus: Number(process.env.K6_VUS || 50),
      duration: process.env.K6_DURATION || '30s',
    });
  } finally {
    onStage?.('cleanup', { progress: 75 });
    await cleanupToxiproxy(tox.name);
  }

  const p99DeltaPct = baseline.p99 > 0
    ? ((chaos.p99 - baseline.p99) / baseline.p99) * 100
    : 0;

  const verdict = computeVerdict(p99DeltaPct);

  return {
    diffText,
    baseline,
    chaos,
    p99DeltaPct,
    verdict,
  };
}

module.exports = { runJob };
