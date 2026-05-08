const crypto = require('crypto');
const http = require('http');
const path = require('path');
const express = require('express');
const Bull = require('bull');
const Redis = require('ioredis');
const dotenv = require('dotenv');
const { nanoid } = require('nanoid');

const { pg, ensureJobSchema } = require('./db');
const { wss, broadcastJob } = require('./ws');
const { createWebhookHandler } = require('./webhook');
const { issueWsToken, verifyWsToken } = require('./wsAuth');
const { createRateLimiter } = require('./rateLimit');
const { requestContext, requestLogger, logInfo, logError, auditLog } = require('./log');
const {
  requireRole,
  issueAccessToken,
  extractPrincipal,
} = require('./auth');
const {
  validateTokenIssuePayload,
  validateTenantPayload,
  validateRunnerTokenRequestPayload,
  validateRunnerRegistrationPayload,
} = require('./validation');

dotenv.config();

const REQUIRED = ['GITHUB_APP_ID', 'GITHUB_WEBHOOK_SECRET', 'DATABASE_URL', 'REDIS_URL'];
const missing = REQUIRED.filter(v => !process.env[v]);
if (missing.length) {
  console.error('[startup] Missing required environment variables:', missing.join(', '));
  process.exit(1);
}

const OPTIONAL_WARNINGS = [];
if (!process.env.GROQ_API_KEY && process.env.AI_PROVIDER !== 'ollama') {
  OPTIONAL_WARNINGS.push('GROQ_API_KEY not set - AI fallback will be deterministic');
}
if (!process.env.OLLAMA_URL) {
  OPTIONAL_WARNINGS.push('OLLAMA_URL not set - defaulting to http://localhost:11434');
}
if (OPTIONAL_WARNINGS.length) {
  console.warn('[startup] Optional:', OPTIONAL_WARNINGS.join('; '));
}

const app = express();
const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-request-id'],
  exposedHeaders: ['x-request-id', 'x-rate-limit-limit', 'x-rate-limit-remaining', 'x-rate-limit-reset'],
  credentials: true,
  maxAge: 86400,
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (corsOptions.origin === false || (Array.isArray(corsOptions.origin) && corsOptions.origin.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  next();
});

const queue = new Bull('flux-jobs', redisUrl);

if (String(process.env.TRUST_PROXY || '').toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}

const webhookLimiter = createRateLimiter({
  name: 'webhook',
  windowMs: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 120),
});

const apiLimiter = createRateLimiter({
  name: 'api',
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.API_RATE_LIMIT_MAX || 300),
  keyFn: (req) => req.header('x-api-key') || req.ip || 'unknown',
});

const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
  keyFn: (req) => req.ip || 'unknown',
});

const redisSub = new Redis(redisUrl);
redisSub.subscribe('flux:events').catch((err) => {
  logError('redis_subscribe_failed', { error: err.message });
});

redisSub.on('error', (error) => {
  logError('redis_sub_connection_error', { error: error.message });
});

redisSub.on('message', (_channel, message) => {
  try {
    const parsed = JSON.parse(message);
    if (parsed?.event) {
      broadcastJob(parsed.event, parsed.data || {});
    }
  } catch (error) {
    logError('redis_sub_invalid_message', { error: error.message });
  }
});

app.use(requestContext());
app.use(requestLogger());

app.post(
  '/webhooks/github',
  webhookLimiter,
  express.raw({ type: 'application/json' }),
  createWebhookHandler(queue)
);

app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use('/api', apiLimiter);

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function requireAdminOrBootstrap(req, res, next) {
  return Promise.resolve()
    .then(async () => {
      const principal = await extractPrincipal(req);
      if (principal && principal.role === 'admin') {
        req.principal = principal;
        return next();
      }

      const allowBootstrap = String(process.env.ALLOW_LOCAL_ADMIN_TOKEN_ISSUE || '').toLowerCase() === 'true';
      if (allowBootstrap && !process.env.API_KEY && !process.env.OIDC_ISSUER) {
        req.principal = {
          id: 'bootstrap-admin',
          role: 'admin',
          tenantId: 'default',
          authType: 'bootstrap',
        };
        return next();
      }

      if (!principal) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      return res.status(403).json({ error: 'Forbidden', requiredRole: 'admin' });
    })
    .catch((error) => {
      return res.status(401).json({ error: 'Unauthorized', detail: error.message });
    });
}

function getScopedTenant(req) {
  const requested = typeof req.query?.tenantId === 'string' ? req.query.tenantId.trim() : '';
  if (req.principal?.role === 'admin') {
    return requested || null;
  }
  return String(req.principal?.tenantId || 'default');
}

function assertTenantAccess(principal, tenantId) {
  if (!tenantId) return true;
  if (!principal) return false;
  if (principal.role === 'admin') return true;
  return String(principal.tenantId || 'default') === String(tenantId);
}

function safeQueueAttempts() {
  const parsed = Number(process.env.JOB_MAX_ATTEMPTS || 3);
  if (!Number.isFinite(parsed) || parsed < 1) return 3;
  return Math.floor(parsed);
}

function safeRetryDelay() {
  const parsed = Number(process.env.JOB_RETRY_DELAY_MS || 5000);
  if (!Number.isFinite(parsed) || parsed < 100) return 5000;
  return Math.floor(parsed);
}

app.get('/api/health', async (_req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {},
  };

  // Check database
  const dbStart = Date.now();
  try {
    await pg.query('SELECT 1');
    health.components.database = {
      status: 'up',
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    health.components.database = {
      status: 'down',
      latencyMs: Date.now() - dbStart,
      error: error.message,
    };
    health.status = 'degraded';
  }

  // Check Redis
  const redisStart = Date.now();
  try {
    const redisClient = new Redis(redisUrl);
    await redisClient.ping();
    await redisClient.quit();
    health.components.redis = {
      status: 'up',
      latencyMs: Date.now() - redisStart,
    };
  } catch (error) {
    health.components.redis = {
      status: 'down',
      latencyMs: Date.now() - redisStart,
      error: error.message,
    };
    health.status = 'degraded';
  }

  // Check queue
  try {
    const [waiting, active, delayed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount(),
    ]);
    health.components.queue = {
      status: 'up',
      waiting,
      active,
      delayed,
      failed,
    };
  } catch (error) {
    health.components.queue = {
      status: 'down',
      error: error.message,
    };
    health.status = 'degraded';
  }

  // Set overall status based on critical components
  if (health.components.database?.status === 'down' || health.components.redis?.status === 'down') {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/api/auth/me', requireRole('viewer'), (req, res) => {
  res.json({ principal: req.principal });
});

app.post('/api/auth/token', authLimiter, requireAdminOrBootstrap, (req, res) => {
  const validated = validateTokenIssuePayload(req.body || {});
  if (!validated.ok) {
    return res.status(400).json({ error: 'Invalid token request', details: validated.errors });
  }

  try {
    const issued = issueAccessToken({
      subject: validated.value.subject,
      role: validated.value.role,
      tenantId: validated.value.tenantId,
      extraClaims: {
        issuedBy: req.principal.id,
      },
    });

    return res.json(issued);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/ws-token', requireRole('viewer'), (_req, res) => {
  const authRequired = Boolean(process.env.API_KEY || process.env.AUTH_JWT_SECRET || process.env.OIDC_ISSUER);
  if (!authRequired) {
    return res.json({ required: false });
  }

  try {
    const issued = issueWsToken('ui');
    return res.json({
      required: true,
      token: issued.token,
      expiresAt: issued.expiresAt,
    });
  } catch (error) {
    logError('api_ws_token_issue_failed', { error: error.message });
    return res.status(500).json({ error: 'Unable to issue websocket token' });
  }
});

app.get('/api/jobs', requireRole('viewer'), async (req, res) => {
  const tenantId = getScopedTenant(req);

  try {
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;

    if (!tenantId) {
      const { rows } = await pg.query(
        `SELECT * FROM jobs
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return res.json(rows);
    }

    const { rows } = await pg.query(
      `SELECT * FROM jobs
       WHERE COALESCE(tenant_id, 'default') = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    return res.json(rows);
  } catch (error) {
    logError('api_jobs_query_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load jobs' });
  }
});

app.get('/api/jobs/stats', requireRole('viewer'), async (req, res) => {
  const tenantId = getScopedTenant(req);
  
  try {
    const dailyQuery = tenantId 
      ? `SELECT TO_CHAR(created_at, 'Day') as day, COUNT(*) as count 
         FROM jobs 
         WHERE COALESCE(tenant_id, 'default') = $1 
           AND created_at > NOW() - INTERVAL '7 days'
         GROUP BY TO_CHAR(created_at, 'Day')
         ORDER BY MIN(created_at)`
      : `SELECT TO_CHAR(created_at, 'Day') as day, COUNT(*) as count 
         FROM jobs 
         WHERE created_at > NOW() - INTERVAL '7 days'
         GROUP BY TO_CHAR(created_at, 'Day')
         ORDER BY MIN(created_at)`;
    
    const dailyParams = tenantId ? [tenantId] : [];
    const { rows: dailyVolume } = await pg.query(dailyQuery, dailyParams);
    
    const worstQuery = tenantId
      ? `SELECT pr_number, repo, p50_delta_pct 
         FROM jobs 
         WHERE COALESCE(tenant_id, 'default') = $1 
           AND p50_delta_pct IS NOT NULL 
           AND status = 'completed'
         ORDER BY p50_delta_pct DESC 
         LIMIT 1`
      : `SELECT pr_number, repo, p50_delta_pct 
         FROM jobs 
         WHERE p50_delta_pct IS NOT NULL 
           AND status = 'completed'
         ORDER BY p50_delta_pct DESC 
         LIMIT 1`;
    
    const worstParams = tenantId ? [tenantId] : [];
    const { rows: [worstRegression] } = await pg.query(worstQuery, worstParams);
    
    return res.json({
      dailyVolume: dailyVolume.map(r => ({ day: r.day.trim(), count: Number(r.count) })),
      worstRegression: worstRegression ? {
        pr: worstRegression.pr_number,
        repo: worstRegression.repo,
        p50DeltaPct: Number(worstRegression.p50_delta_pct)
      } : null
    });
  } catch (error) {
    logError('api_jobs_stats_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load job stats' });
  }
});

app.get('/api/jobs/dead-letter', requireRole('operator'), async (req, res) => {
  const tenantId = getScopedTenant(req);

  try {
    const params = [];
    let whereClause = '';

    if (tenantId) {
      whereClause = "WHERE COALESCE(j.tenant_id, 'default') = $1";
      params.push(tenantId);
    }

    const { rows } = await pg.query(
      `SELECT dl.job_id,
              dl.reason,
              dl.moved_at,
              j.repo,
              j.pr_number,
              COALESCE(j.tenant_id, 'default') AS tenant_id,
              j.attempt_count,
              j.last_error
       FROM dead_letter_jobs dl
       JOIN jobs j ON j.id = dl.job_id
       ${whereClause}
       ORDER BY dl.moved_at DESC
       LIMIT 100`,
      params
    );

    return res.json(rows);
  } catch (error) {
    logError('api_dead_letter_query_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load dead-letter jobs' });
  }
});

app.get('/api/jobs/:id', requireRole('viewer'), async (req, res) => {
  const tenantId = getScopedTenant(req);

  try {
    let rows;
    if (!tenantId) {
      ({ rows } = await pg.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [req.params.id]));
    } else {
      ({ rows } = await pg.query(
        "SELECT * FROM jobs WHERE id = $1 AND COALESCE(tenant_id, 'default') = $2 LIMIT 1",
        [req.params.id, tenantId]
      ));
    }

    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    logError('api_job_query_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load job' });
  }
});

app.post('/api/jobs/:id/retry', requireRole('operator'), async (req, res) => {
  try {
    const { rows } = await pg.query(
      `SELECT id,
              repo,
              pr_number,
              head_sha,
              installation_id,
              check_run_id,
              COALESCE(tenant_id, 'default') AS tenant_id,
              metadata
       FROM jobs
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const record = rows[0];
    if (!assertTenantAccess(req.principal, record.tenant_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const queuePayload =
      record?.metadata?.queuePayload && typeof record.metadata.queuePayload === 'object'
        ? record.metadata.queuePayload
        : null;

    if (!queuePayload || !queuePayload.diff_url) {
      return res.status(409).json({ error: 'Job does not contain retry payload metadata' });
    }

    const retryPayload = {
      ...queuePayload,
      id: record.id,
      check_run_id: record.check_run_id,
      installation_id: record.installation_id,
      tenant_id: record.tenant_id,
    };

    await pg.query(
      `UPDATE jobs
       SET status = 'queued',
           dead_letter_reason = NULL,
           last_error = NULL,
           failed_at = NULL,
           completed_at = NULL
       WHERE id = $1`,
      [record.id]
    );

    await pg.query('DELETE FROM dead_letter_jobs WHERE job_id = $1', [record.id]);

    await queue.add(retryPayload, {
      jobId: `retry:${record.id}:${Date.now()}`,
      attempts: safeQueueAttempts(),
      backoff: {
        type: 'exponential',
        delay: safeRetryDelay(),
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    broadcastJob('job:queued', {
      id: record.id,
      status: 'queued',
      tenant_id: record.tenant_id,
      stage: 0,
      progress: 5,
    });

    return res.status(202).json({ queued: true, id: record.id });
  } catch (error) {
    logError('api_job_retry_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to retry job' });
  }
});

app.delete('/api/jobs/:id', requireRole('operator'), async (req, res) => {
  const jobId = req.params.id;
  
  try {
    const { rows } = await pg.query(
      'SELECT id, COALESCE(tenant_id, \'default\') AS tenant_id FROM jobs WHERE id = $1 LIMIT 1',
      [jobId]
    );
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!assertTenantAccess(req.principal, rows[0].tenant_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pg.query('DELETE FROM dead_letter_jobs WHERE job_id = $1', [jobId]);
    await pg.query('DELETE FROM jobs WHERE id = $1', [jobId]);

    auditLog('delete', 'job', jobId, req.principal, true, { tenantId: rows[0].tenant_id });

    return res.status(204).send();
  } catch (error) {
    auditLog('delete', 'job', jobId, req.principal, false, { error: error.message });
    logError('api_job_delete_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to delete job' });
  }
});

app.get('/api/metrics', requireRole('viewer'), async (req, res) => {
  const tenantId = getScopedTenant(req);

  try {
    const queueCounts = await queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );

    const params = [];
    let whereClause = '';
    if (tenantId) {
      whereClause = "WHERE COALESCE(tenant_id, 'default') = $1";
      params.push(tenantId);
    }

    const statusRows = await pg.query(
      `SELECT status, COUNT(*)::int AS count
       FROM jobs
       ${whereClause}
       GROUP BY status`,
      params
    );

    const providerRows = await pg.query(
      `SELECT COALESCE(findings->>'provider', 'unknown') AS provider,
              COUNT(*)::int AS count
       FROM jobs
       ${whereClause}
       GROUP BY COALESCE(findings->>'provider', 'unknown')`,
      params
    );

    const deadLetterCount = await pg.query(
      `SELECT COUNT(*)::int AS count
       FROM dead_letter_jobs dl
       JOIN jobs j ON j.id = dl.job_id
       ${tenantId ? "WHERE COALESCE(j.tenant_id, 'default') = $1" : ''}`,
      tenantId ? [tenantId] : []
    );

    // Throughput: completed jobs in last 24 hours grouped by hour
    const throughputParams = tenantId ? [tenantId] : [];
    const throughputQuery = tenantId
      ? `SELECT date_trunc('hour', completed_at) as hour, COUNT(*)::int as count
         FROM jobs
         WHERE COALESCE(tenant_id, 'default') = $1
           AND status = 'completed'
           AND completed_at > NOW() - INTERVAL '24 hours'
         GROUP BY date_trunc('hour', completed_at)
         ORDER BY hour`
      : `SELECT date_trunc('hour', completed_at) as hour, COUNT(*)::int as count
         FROM jobs
         WHERE status = 'completed'
           AND completed_at > NOW() - INTERVAL '24 hours'
         GROUP BY date_trunc('hour', completed_at)
         ORDER BY hour`;
    
    const throughputRows = await pg.query(throughputQuery, throughputParams);

    // Summary stats
    const summaryStats = await pg.query(
      `${tenantId ? `SELECT 
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as jobs_24h,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as jobs_7d,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as jobs_30d,
         AVG(p99_delta_pct) FILTER (WHERE p99_delta_pct IS NOT NULL AND status = 'completed') as avg_p99_delta
       FROM jobs WHERE COALESCE(tenant_id, 'default') = $1` 
       : `SELECT 
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as jobs_24h,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as jobs_7d,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as jobs_30d,
         AVG(p99_delta_pct) FILTER (WHERE p99_delta_pct IS NOT NULL AND status = 'completed') as avg_p99_delta
       FROM jobs`}`,
      throughputParams
    );

    return res.json({
      queue: queueCounts,
      jobsByStatus: statusRows.rows,
      aiProviders: providerRows.rows,
      deadLetterCount: deadLetterCount.rows[0]?.count || 0,
      throughput: throughputRows.rows.map(r => ({
        hour: r.hour,
        count: r.count,
      })),
      summary: summaryStats.rows[0],
      tenantId: tenantId || 'all',
      ts: new Date().toISOString(),
    });
  } catch (error) {
    logError('api_metrics_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load metrics' });
  }
});

app.get('/api/tenants', requireRole('viewer'), async (req, res) => {
  try {
    if (req.principal.role === 'admin') {
      const { rows } = await pg.query(
        'SELECT id, name, github_org, created_at FROM tenants ORDER BY created_at DESC'
      );
      return res.json(rows);
    }

    const { rows } = await pg.query(
      'SELECT id, name, github_org, created_at FROM tenants WHERE id = $1 LIMIT 1',
      [req.principal.tenantId || 'default']
    );

    return res.json(rows);
  } catch (error) {
    logError('api_tenants_query_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load tenants' });
  }
});

app.post('/api/tenants', requireRole('admin'), async (req, res) => {
  const validated = validateTenantPayload(req.body || {});
  if (!validated.ok) {
    return res.status(400).json({ error: 'Invalid tenant payload', details: validated.errors });
  }

  const id = `tenant_${nanoid(12)}`;

  try {
    const { rows } = await pg.query(
      `INSERT INTO tenants (id, name, github_org)
       VALUES ($1, $2, $3)
       RETURNING id, name, github_org, created_at`,
      [id, validated.value.name, validated.value.githubOrg]
    );

    auditLog('create', 'tenant', id, req.principal, true, { name: validated.value.name });

    return res.status(201).json(rows[0]);
  } catch (error) {
    auditLog('create', 'tenant', id, req.principal, false, { error: error.message });
    logError('api_tenant_create_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to create tenant' });
  }
});

app.delete('/api/tenants/:id', requireRole('admin'), async (req, res) => {
  const tenantId = req.params.id;
  
  if (tenantId === 'default') {
    return res.status(400).json({ error: 'Cannot delete default tenant' });
  }

  try {
    const { rows } = await pg.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await pg.query('DELETE FROM runners WHERE tenant_id = $1', [tenantId]);
    await pg.query('DELETE FROM runner_tokens WHERE tenant_id = $1', [tenantId]);
    await pg.query('DELETE FROM jobs WHERE tenant_id = $1', [tenantId]);
    await pg.query('DELETE FROM tenants WHERE id = $1', [tenantId]);

    auditLog('delete', 'tenant', tenantId, req.principal, true);

    return res.status(204).send();
  } catch (error) {
    auditLog('delete', 'tenant', tenantId, req.principal, false, { error: error.message });
    logError('api_tenant_delete_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to delete tenant' });
  }
});

app.get('/api/settings', requireRole('viewer'), async (_req, res) => {
  try {
    const { rows } = await pg.query('SELECT key, value, updated_at FROM settings');
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return res.json(settings);
  } catch (error) {
    logError('api_settings_query_failed', { error: error.message });
    return res.status(500).json({ error: 'Unable to load settings' });
  }
});

app.put('/api/settings/:key', requireRole('admin'), async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!key) {
    return res.status(400).json({ error: 'Setting key is required' });
  }

  const value = req.body?.value;
  if (value === undefined) {
    return res.status(400).json({ error: 'Setting value is required' });
  }

  try {
    const { rows } = await pg.query(
      `INSERT INTO settings (key, value, updated_at, updated_by)
       VALUES ($1, $2::jsonb, NOW(), $3)
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW(), updated_by = $3
       RETURNING key, value, updated_at`,
      [key, JSON.stringify(value), req.principal?.id || 'unknown']
    );
    return res.json(rows[0]);
  } catch (error) {
    logError('api_settings_update_failed', { key, error: error.message });
    return res.status(500).json({ error: 'Unable to update setting' });
  }
});

app.delete('/api/settings/:key', requireRole('admin'), async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!key) {
    return res.status(400).json({ error: 'Setting key is required' });
  }

  try {
    const { rows } = await pg.query('SELECT key FROM settings WHERE key = $1 LIMIT 1', [key]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    await pg.query('DELETE FROM settings WHERE key = $1', [key]);

    auditLog('delete', 'setting', key, req.principal, true);

    return res.status(204).send();
  } catch (error) {
    auditLog('delete', 'setting', key, req.principal, false, { error: error.message });
    logError('api_settings_delete_failed', { key, error: error.message });
    return res.status(500).json({ error: 'Unable to delete setting' });
  }
});

app.get('/api/config/rate-limits', requireRole('viewer'), async (_req, res) => {
  return res.json({
    webhook: {
      windowMs: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.WEBHOOK_RATE_LIMIT_MAX || 120),
    },
    api: {
      windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.API_RATE_LIMIT_MAX || 300),
    },
    auth: {
      windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
    },
  });
});

app.post('/api/tenants/:tenantId/runners/register-token', requireRole('admin'), async (req, res) => {
  const validated = validateRunnerTokenRequestPayload(req.body || {});
  const tenantId = String(req.params.tenantId || '').trim();

  if (!validated.ok) {
    return res.status(400).json({ error: 'Invalid payload', details: validated.errors });
  }

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  try {
    const tenant = await pg.query('SELECT id FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    if (!tenant.rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tokenId = nanoid(16);
    const rawToken = `rreg_${crypto.randomBytes(24).toString('base64url')}`;
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + validated.value.expiresInMinutes * 60_000);

    await pg.query(
      `INSERT INTO runner_tokens (token_id, tenant_id, token_hash, role, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [tokenId, tenantId, tokenHash, validated.value.role, expiresAt.toISOString()]
    );

    return res.status(201).json({
      tokenId,
      registrationToken: rawToken,
      role: validated.value.role,
      tenantId,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logError('api_runner_registration_token_failed', {
      requestId: req.requestId,
      error: error.message,
    });
    return res.status(500).json({ error: 'Unable to issue runner registration token' });
  }
});

app.post('/api/runners/register', authLimiter, async (req, res) => {
  const validated = validateRunnerRegistrationPayload(req.body || {});
  if (!validated.ok) {
    return res.status(400).json({ error: 'Invalid registration payload', details: validated.errors });
  }

  const tokenHash = hashToken(validated.value.registrationToken);

  try {
    const tokenRows = await pg.query(
      `SELECT token_id, tenant_id, role
       FROM runner_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (!tokenRows.rows.length) {
      return res.status(401).json({ error: 'Invalid or expired registration token' });
    }

    const tokenRecord = tokenRows.rows[0];
    const runnerId = `runner_${nanoid(12)}`;
    const runnerToken = `rrun_${crypto.randomBytes(32).toString('base64url')}`;
    const runnerTokenHash = hashToken(runnerToken);

    await pg.query('BEGIN');

    await pg.query(
      `INSERT INTO runners (id, tenant_id, name, token_hash, capabilities)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        runnerId,
        tokenRecord.tenant_id,
        validated.value.name,
        runnerTokenHash,
        JSON.stringify(validated.value.capabilities || {}),
      ]
    );

    await pg.query('UPDATE runner_tokens SET used_at = NOW() WHERE token_id = $1', [tokenRecord.token_id]);
    await pg.query('COMMIT');

    auditLog('create', 'runner', runnerId, { id: 'runner', role: tokenRecord.role, tenantId: tokenRecord.tenant_id }, true, { name: validated.value.name });

    return res.status(201).json({
      runnerId,
      runnerToken,
      tenantId: tokenRecord.tenant_id,
      role: tokenRecord.role,
    });
  } catch (error) {
    await pg.query('ROLLBACK').catch(() => {});
    auditLog('create', 'runner', runnerId, { id: 'runner' }, false, { error: error.message });
    logError('api_runner_register_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to register runner' });
  }
});

app.post('/api/runners/heartbeat', async (req, res) => {
  const runnerToken = req.header('x-runner-token') || req.body?.runnerToken;
  if (!runnerToken) {
    return res.status(401).json({ error: 'Missing runner token' });
  }

  const runnerTokenHash = hashToken(runnerToken);

  try {
    const { rows } = await pg.query(
      `UPDATE runners
       SET last_seen_at = NOW(),
           status = 'active'
       WHERE token_hash = $1
       RETURNING id, tenant_id, name, last_seen_at`,
      [runnerTokenHash]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid runner token' });
    }

    return res.json({ ok: true, runner: rows[0] });
  } catch (error) {
    logError('api_runner_heartbeat_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to update heartbeat' });
  }
});

app.get('/api/runners', requireRole('operator'), async (req, res) => {
  const tenantId = getScopedTenant(req);

  try {
    if (!tenantId) {
      const { rows } = await pg.query(
        `SELECT id, tenant_id, name, status, created_at, last_seen_at, capabilities
         FROM runners
         ORDER BY created_at DESC
         LIMIT 200`
      );
      return res.json(rows);
    }

    const { rows } = await pg.query(
      `SELECT id, tenant_id, name, status, created_at, last_seen_at, capabilities
       FROM runners
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [tenantId]
    );

    return res.json(rows);
  } catch (error) {
    logError('api_runners_query_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to load runners' });
  }
});

app.delete('/api/runners/:id', requireRole('admin'), async (req, res) => {
  const runnerId = req.params.id;
  
  try {
    const { rows } = await pg.query('SELECT id FROM runners WHERE id = $1 LIMIT 1', [runnerId]);
    
    if (!rows.length) {
      return res.status(404).json({ error: 'Runner not found' });
    }

    await pg.query('DELETE FROM runners WHERE id = $1', [runnerId]);

    auditLog('delete', 'runner', runnerId, req.principal, true);

    return res.status(204).send();
  } catch (error) {
    auditLog('delete', 'runner', runnerId, req.principal, false, { error: error.message });
    logError('api_runner_delete_failed', { requestId: req.requestId, error: error.message });
    return res.status(500).json({ error: 'Unable to delete runner' });
  }
});

// Global error handler - sanitize error responses
app.use((err, req, res, next) => {
  logError('unhandled_error', { 
    requestId: req.requestId, 
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  const message = process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'An unexpected error occurred';
  
  res.status(500).json({ error: message });
});

app.use(express.static(path.join(__dirname, '../flux-ui/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../flux-ui/dist/index.html'));
});

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    socket.destroy();
    return;
  }

  if (parsedUrl.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const wsToken = parsedUrl.searchParams.get('ws_token');
  const wsTokenVerification = verifyWsToken(wsToken, 'ui');
  const configuredKey = process.env.API_KEY;
  const headerKey = req.headers['x-api-key'];
  const apiKeyValid = typeof headerKey === 'string' && configuredKey && headerKey === configuredKey;
  const authRequired = Boolean(process.env.API_KEY || process.env.AUTH_JWT_SECRET || process.env.OIDC_ISSUER);

  if (authRequired && !(apiKeyValid || wsTokenVerification.ok)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    wss.emit('connection', client, req);
  });
});

async function start() {
  await ensureJobSchema();
  server.listen(port, () => {
    logInfo('server_started', { port, redisUrl });
  });
}

start().catch((error) => {
  logError('startup_failed', { error: error.message });
  process.exit(1);
});

async function shutdown(signal) {
  logInfo('shutdown_started', { signal, timeout: 30000 });
  
  // Stop accepting new connections by closing the server
  if (server) {
    await new Promise((resolve) => {
      server.close(() => {
        logInfo('server_closed');
        resolve();
      });
    });
  }

  // Wait for in-flight requests (max 30 seconds)
  const shutdownTimeout = 30000;
  const startTime = Date.now();
  
  // Close Redis subscription client
  try {
    await redisSub.quit();
    logInfo('redis_closed');
  } catch (err) {
    logError('redis_close_error', { error: err.message });
  }

  // Close Bull queue
  try {
    await queue.close();
    logInfo('queue_closed');
  } catch (err) {
    logError('queue_close_error', { error: err.message });
  }

  // Close PostgreSQL
  try {
    await pg.end();
    logInfo('database_closed');
  } catch (err) {
    logError('database_close_error', { error: err.message });
  }

  const elapsed = Date.now() - startTime;
  logInfo('shutdown_complete', { elapsedMs: elapsed });
  
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
