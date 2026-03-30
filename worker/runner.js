const path = require('path');
const { execSync } = require('child_process');

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

function runK6Script({ script, targetUrl, vus = 50, duration = '30s' }) {
  const scriptsPath = path.resolve(process.cwd(), 'k6');
  const command = [
    'docker run --rm',
    '--network host',
    `-v "${scriptsPath}:/scripts"`,
    '-e TARGET_URL=' + targetUrl,
    '-e VUS=' + vus,
    '-e DURATION=' + duration,
    'grafana/k6 run',
    `/scripts/${script}`,
  ].join(' ');

  const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return parseK6Summary(output);
}

async function fetchDiff(diffUrl) {
  const res = await fetch(diffUrl);
  if (!res.ok) {
    throw new Error(`Unable to fetch diff: HTTP ${res.status}`);
  }
  return res.text();
}

function buildToxiRunCommand(name, listenPort) {
  if (process.platform === 'win32') {
    return `docker run -d --name ${name} -p 8474:8474 -p ${listenPort}:${listenPort} ghcr.io/shopify/toxiproxy`;
  }
  return `docker run -d --name ${name} --network host ghcr.io/shopify/toxiproxy`;
}

async function startToxiproxy(jobId, targetPort) {
  const name = `flux-toxi-${String(jobId).replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24)}`;
  const listenPort = 13001;

  execSync(buildToxiRunCommand(name, listenPort), { stdio: 'pipe' });

  // Give toxiproxy a brief moment to boot.
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const base = 'http://127.0.0.1:8474';

  const proxyRes = await fetch(`${base}/proxies`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'app',
      listen: `0.0.0.0:${listenPort}`,
      upstream: `127.0.0.1:${targetPort}`,
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

function cleanupToxiproxy(containerName) {
  try {
    execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
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
  const targetBase = `http://localhost:${targetPort}`;

  onStage?.('diff', { progress: 15 });
  const diffText = await fetchDiff(payload.diff_url);

  onStage?.('baseline', { progress: 30 });
  const baseline = runK6Script({
    script: 'baseline.js',
    targetUrl: targetBase,
    vus: Number(process.env.K6_VUS || 50),
    duration: process.env.K6_DURATION || '30s',
  });

  onStage?.('toxiproxy', { progress: 45 });
  const tox = await startToxiproxy(payload.id, targetPort);

  let chaos;
  try {
    onStage?.('chaos', { progress: 65 });
    chaos = runK6Script({
      script: 'chaos.js',
      targetUrl: `http://localhost:${tox.listenPort}`,
      vus: Number(process.env.K6_VUS || 50),
      duration: process.env.K6_DURATION || '30s',
    });
  } finally {
    onStage?.('cleanup', { progress: 75 });
    cleanupToxiproxy(tox.name);
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
