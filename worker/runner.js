const path = require('path');
const { spawn } = require('child_process');

function toPositiveInt(raw, fallback) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

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
      resolve({ stdout, stderr, code });
    });
  });
}

function dockerHostArgs() {
  if (process.platform === 'linux') {
    return ['--add-host', 'host.docker.internal:host-gateway'];
  }
  return [];
}

function dockerSecurityArgs({ memory = '512m', pids = '256' } = {}) {
  return [
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--pids-limit',
    String(pids),
    '--memory',
    String(memory),
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=64m',
  ];
}

function hashedPort(seed, base, range) {
  const text = String(seed || 'flux');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return base + (Math.abs(hash) % range);
}

async function runK6Script({
  script,
  targetUrl,
  vus = 50,
  duration = '30s',
  shardIndex = 0,
  shardCount = 1,
}) {
  const scriptsPath = path.resolve(__dirname, '..', 'k6');
  const args = [
    'run',
    '--rm',
    ...dockerSecurityArgs({ memory: process.env.K6_MEMORY_LIMIT || '1024m', pids: process.env.K6_PIDS_LIMIT || '256' }),
    ...dockerHostArgs(),
    '-v',
    `${scriptsPath}:/scripts:ro`,
    '-e',
    `TARGET_URL=${targetUrl}`,
    '-e',
    `VUS=${vus}`,
    '-e',
    `DURATION=${duration}`,
    '-e',
    `SHARD_INDEX=${shardIndex}`,
    '-e',
    `SHARD_COUNT=${shardCount}`,
    'grafana/k6',
    'run',
    `/scripts/${script}`,
  ];

  const { stdout, stderr } = await runCommand('docker', args);
  const output = `${stdout}\n${stderr}`;
  return parseK6Summary(output);
}

function splitVusAcrossShards(totalVus, shardCount) {
  const shards = Math.max(toPositiveInt(shardCount, 1), 1);
  const total = Math.max(toPositiveInt(totalVus, 1), shards);
  const base = Math.floor(total / shards);
  let remainder = total % shards;

  const distribution = [];
  for (let idx = 0; idx < shards; idx += 1) {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    distribution.push(base + extra);
  }

  return distribution;
}

function mergeShardSummaries(summaries) {
  if (!Array.isArray(summaries) || summaries.length === 0) {
    return {
      p95: 0,
      p99: 0,
      rps: 0,
      errorRate: 0,
      raw: '',
      shards: [],
    };
  }

  const p95 = Math.max(...summaries.map((x) => Number(x.p95 || 0)));
  const p99 = Math.max(...summaries.map((x) => Number(x.p99 || 0)));
  const rps = summaries.reduce((sum, x) => sum + Number(x.rps || 0), 0);
  const weightedError = summaries.reduce((sum, x) => {
    const shardRps = Number(x.rps || 0);
    return sum + Number(x.errorRate || 0) * Math.max(shardRps, 1);
  }, 0);
  const rpsWeight = summaries.reduce((sum, x) => sum + Math.max(Number(x.rps || 0), 1), 0);

  return {
    p95,
    p99,
    rps,
    errorRate: rpsWeight > 0 ? weightedError / rpsWeight : 0,
    raw: summaries.map((x, idx) => `# shard:${idx + 1}\n${x.raw || ''}`).join('\n\n'),
    shards: summaries,
  };
}

async function runK6ShardWithRetry({
  script,
  targetUrl,
  vus,
  duration,
  shardIndex,
  shardCount,
}) {
  const maxAttempts = Math.max(toPositiveInt(process.env.SHARD_MAX_ATTEMPTS, 2), 1);
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runK6Script({
        script,
        targetUrl,
        vus,
        duration,
        shardIndex,
        shardCount,
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }

  throw new Error(
    `Shard ${shardIndex + 1}/${shardCount} failed after ${maxAttempts} attempts: ${lastError?.message || 'unknown error'}`
  );
}

async function runK6Sharded({ script, targetUrl, vus = 50, duration = '30s', shardCount = 1 }) {
  const shards = Math.max(toPositiveInt(shardCount, 1), 1);
  const vusDistribution = splitVusAcrossShards(vus, shards);

  const shardPromises = vusDistribution.map((shardVus, shardIndex) => {
    return runK6ShardWithRetry({
      script,
      targetUrl,
      vus: shardVus,
      duration,
      shardIndex,
      shardCount: shards,
    });
  });

  const shardResults = await Promise.all(shardPromises);
  return mergeShardSummaries(shardResults);
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

async function waitForPort(port, retries = 10, delayMs = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/proxies`);
      if (res.ok) return;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Toxiproxy not ready on port ${port} after ${retries} retries`);
}

async function startToxiproxy(jobId, targetHost, targetPort) {
  const name = `flux-toxi-${String(jobId).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24)}`;
  const adminPort = hashedPort(`${jobId}-admin`, 18000, 1000);
  const listenPort = hashedPort(`${jobId}-listen`, 13000, 1000);

  await cleanupToxiproxy(name);

  const runArgs = [
    'run',
    '-d',
    ...dockerSecurityArgs({ memory: process.env.TOXIPROXY_MEMORY_LIMIT || '256m', pids: process.env.TOXIPROXY_PIDS_LIMIT || '128' }),
    '--name',
    name,
    '-p',
    `${adminPort}:8474`,
    '-p',
    `${listenPort}:${listenPort}`,
    'ghcr.io/shopify/toxiproxy',
  ];

  await runCommand('docker', runArgs);

  await waitForPort(adminPort);

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

function normalizeTargetBaseUrl(rawTarget) {
  let parsed;
  try {
    parsed = new URL(rawTarget);
  } catch {
    throw new Error('APP target URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('APP target URL protocol must be http or https');
  }

  const allowListRaw = process.env.ALLOWED_TARGET_HOSTS
    || 'host.docker.internal,localhost,127.0.0.1';
  const allowList = allowListRaw
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  if (allowList.length && !allowList.includes(parsed.hostname.toLowerCase())) {
    throw new Error(`APP target host ${parsed.hostname} is not in ALLOWED_TARGET_HOSTS`);
  }

  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed.toString().replace(/\/$/, '');
}

async function runJob(payload, onStage) {
  const targetPort = Number(process.env.APP_TARGET_PORT || 3001);
  const targetHost = process.env.APP_TARGET_HOST || 'host.docker.internal';
  const targetBase = normalizeTargetBaseUrl(
    process.env.APP_TARGET_BASE_URL || `http://${targetHost}:${targetPort}`
  );
  const shardCount = Math.max(toPositiveInt(payload.shard_count, 0), toPositiveInt(process.env.RUNNER_SHARD_COUNT, 1));
  const runMode = shardCount > 1 ? 'distributed' : 'single';

  onStage?.('diff', { progress: 15 });
  const diffText = await fetchDiff(payload.diff_url);

  onStage?.('baseline', { progress: 30 });
  const baseline = await runK6Sharded({
    script: 'baseline.js',
    targetUrl: targetBase,
    vus: Number(process.env.K6_VUS || 50),
    duration: process.env.K6_DURATION || '30s',
    shardCount,
  });

  onStage?.('toxiproxy', { progress: 45 });
  const tox = await startToxiproxy(payload.id, targetHost, targetPort);

  let chaos;
  try {
    onStage?.('chaos', { progress: 65 });
    chaos = await runK6Sharded({
      script: 'chaos.js',
      targetUrl: `http://${targetHost}:${tox.listenPort}`,
      vus: Number(process.env.K6_VUS || 50),
      duration: process.env.K6_DURATION || '30s',
      shardCount,
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
    runMode,
    shardCount,
  };
}

module.exports = { runJob };
