const dotenv = require('dotenv');
const Bull = require('bull');
const Redis = require('ioredis');

const { pg } = require('../server/db');
const { runJob } = require('./runner');
const { analyze } = require('./analyzer');
const { reportToGitHub } = require('./report');

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const queue = new Bull('flux-jobs', redisUrl);
const redisPub = new Redis(redisUrl);

redisPub.on('error', (error) => {
  console.error('[worker] redis publish connection error:', error.message);
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
  await redisPub.publish('flux:events', JSON.stringify({ event, data, ts: Date.now() }));
}

queue.process(2, async (job) => {
  const payload = job.data;

  await pg.query('UPDATE jobs SET status = $2 WHERE id = $1', [payload.id, 'running']);
  await publish('job:update', { id: payload.id, status: 'running', stage: 1, progress: 10 });

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
           completed_at = NOW()
       WHERE id = $1`,
      [
        payload.id,
        result.verdict,
        result.baseline.p99,
        result.chaos.p99,
        result.p99DeltaPct,
        JSON.stringify(analysis),
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
    });

    return { verdict: result.verdict };
  } catch (error) {
    await pg.query('UPDATE jobs SET status = $2 WHERE id = $1', [payload.id, 'failed']);

    await publish('job:error', {
      id: payload.id,
      status: 'failed',
      error: error.message,
    });

    throw error;
  }
});

queue.on('failed', (job, err) => {
  console.error(`[worker] job failed id=${job?.data?.id} error=${err.message}`);
});

console.log('⚙️ Flux worker ready — waiting for jobs...');

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
