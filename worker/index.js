const dotenv = require('dotenv');
dotenv.config();
const Bull = require('bull');
const Redis = require('ioredis');

const { pg } = require('../server/db');
const { runJob } = require('./runner');
const { analyze } = require('./analyzer');
const { reportToGitHub } = require('./report');
const { logInfo, logError } = require('../server/log');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const queue = new Bull('flux-jobs', redisUrl);
const redisPub = new Redis(redisUrl);

function toPositiveInt(raw, fallback) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

const workerConcurrency = toPositiveInt(process.env.WORKER_CONCURRENCY, 2);

redisPub.on('error', (error) => {
  logError('worker_redis_publish_connection_error', { error: error.message });
});

function stageToIndex(stage) {
  const map = {
    queued: 0,
    diff: 1,
    baseline: 2,
    toxiproxy: 3,
    chaos: 4,
    cleanup: 5,
    analyze: 5,
    report: 6,
  };
  return map[stage] ?? 0;
}

async function publish(event, data) {
  try {
    await redisPub.publish('flux:events', JSON.stringify({ event, data, ts: Date.now() }));
  } catch (error) {
    logError('worker_publish_failed', { event, error: error.message });
  }
}

queue.process(workerConcurrency, async (job) => {
  const payload = job.data;
  const shardCount = toPositiveInt(payload.shard_count, 1);
  const runMode = shardCount > 1 ? 'distributed' : 'single';
  const attemptCount = toPositiveInt(job.attemptsMade + 1, 1);

  await pg.query(
    `UPDATE jobs
     SET status = 'running',
         attempt_count = GREATEST(attempt_count, $2),
         run_mode = $3,
         shard_count = $4,
         dead_letter_reason = NULL
     WHERE id = $1`,
    [payload.id, attemptCount, runMode, shardCount]
  );
  await publish('job:update', {
    id: payload.id,
    status: 'running',
    stage: 1,
    progress: 10,
    attempt_count: attemptCount,
    run_mode: runMode,
    shard_count: shardCount,
  });

  try {
    const result = await runJob(payload, async (stage, meta = {}) => {
      await publish('job:stage', {
        id: payload.id,
        status: 'running',
        stage: stageToIndex(stage),
        progress: meta.progress ?? 0,
      });
    });

    await publish('job:stage', { id: payload.id, stage: 5, progress: 85 });
    const analysis = await analyze(result);

    await publish('job:stage', { id: payload.id, stage: 6, progress: 95 });
    await reportToGitHub({ payload, result, analysis });

    await pg.query(
      `UPDATE jobs
       SET status = 'completed',
           verdict = $2,
           p99_baseline = $3,
           p99_pr = $4,
           p99_delta_pct = $5,
           findings = $6::jsonb,
           run_mode = $7,
           shard_count = $8,
           completed_at = NOW()
       WHERE id = $1`,
      [
        payload.id,
        result.verdict,
        result.baseline.p99,
        result.chaos.p99,
        result.p99DeltaPct,
        JSON.stringify(analysis),
        result.runMode,
        result.shardCount,
      ]
    );

    await publish('job:complete', {
      id: payload.id,
      status: 'completed',
      verdict: result.verdict,
      p99_baseline: result.baseline.p99,
      p99_pr: result.chaos.p99,
      p99_delta_pct: result.p99DeltaPct,
      findings: analysis,
      completed_at: new Date().toISOString(),
      stage: 6,
      progress: 100,
      run_mode: result.runMode,
      shard_count: result.shardCount,
    });

    return { verdict: result.verdict };
  } catch (error) {
    await pg.query(
      `UPDATE jobs
       SET status = 'failed',
           failed_at = NOW(),
           last_error = $2,
           attempt_count = GREATEST(attempt_count, $3)
       WHERE id = $1`,
      [payload.id, String(error.message || 'unknown error').slice(0, 2000), attemptCount]
    );

    await publish('job:error', {
      id: payload.id,
      status: 'failed',
      error: error.message,
      attempt_count: attemptCount,
    });

    throw error;
  }
});

queue.on('failed', (job, err) => {
  const jobId = job?.data?.id;
  logError('worker_job_failed', {
    id: jobId,
    error: err.message,
    attemptsMade: job?.attemptsMade,
    maxAttempts: job?.opts?.attempts,
  });

  Promise.resolve()
    .then(async () => {
      if (!jobId) return;

      const maxAttempts = toPositiveInt(job?.opts?.attempts, 1);
      const attemptsMade = toPositiveInt(job?.attemptsMade, 1);
      if (attemptsMade < maxAttempts) return;

      await pg.query('BEGIN');
      await pg.query(
        `UPDATE jobs
         SET status = 'dead-letter',
             dead_letter_reason = $2,
             last_error = $2,
             failed_at = NOW()
         WHERE id = $1`,
        [jobId, String(err.message || 'unknown error').slice(0, 2000)]
      );

      await pg.query(
        `INSERT INTO dead_letter_jobs (job_id, reason, payload)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (job_id)
         DO UPDATE SET reason = EXCLUDED.reason,
                       payload = EXCLUDED.payload,
                       moved_at = NOW()`,
        [
          jobId,
          String(err.message || 'unknown error').slice(0, 2000),
          JSON.stringify(job.data || {}),
        ]
      );

      await pg.query('COMMIT');

      await publish('job:dead-letter', {
        id: jobId,
        status: 'dead-letter',
        error: String(err.message || 'unknown error').slice(0, 2000),
        attempt_count: attemptsMade,
      });
    })
    .catch(async (failureError) => {
      await pg.query('ROLLBACK').catch(() => {});
      logError('worker_dead_letter_handling_failed', {
        id: jobId,
        error: failureError.message,
      });
    });
});

const REQUIRED = ['GITHUB_APP_ID', 'GITHUB_WEBHOOK_SECRET', 'DATABASE_URL', 'REDIS_URL'];
const missing = REQUIRED.filter(v => !process.env[v]);
if (missing.length) { 
  console.error('[startup] Missing:', missing.join(', ')); 
  process.exit(1); 
}

if (!process.env.GROQ_API_KEY && process.env.AI_PROVIDER !== 'ollama') {
  logError('startup_warning', { warn: 'GROQ_API_KEY not set. AI fallback is deterministic.' });
}

fetch(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`)
  .then(r => r.json())
  .then(data => {
    const model = process.env.OLLAMA_MODEL || 'qwen3:8b';
    if (!data.models?.some(m => m.name.startsWith(model))) {
      logError('startup_warning', { warn: `Model ${model} not pulled in Ollama.` });
    }
  })
  .catch(() => logError('startup_warning', { warn: 'Ollama not reachable at startup.' }));

logInfo('worker_ready', { concurrency: workerConcurrency });

process.on('SIGINT', async () => {
  await redisPub.quit();
  await queue.close();
  await pg.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisPub.quit();
  await queue.close();
  await pg.end();
  process.exit(0);
});
