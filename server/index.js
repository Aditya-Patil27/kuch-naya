const http = require('http');
const express = require('express');
const Bull = require('bull');
const Redis = require('ioredis');
const dotenv = require('dotenv');

const { pg, ensureJobSchema } = require('./db');
const { wss, broadcastJob } = require('./ws');
const { createWebhookHandler } = require('./webhook');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const queue = new Bull('flux-jobs', redisUrl);

const redisSub = new Redis(redisUrl);
redisSub.subscribe('flux:events').catch((err) => {
  console.error('[redis-sub] subscribe failed:', err.message);
});

redisSub.on('error', (error) => {
  console.error('[redis-sub] connection error:', error.message);
});

redisSub.on('message', (_channel, message) => {
  try {
    const parsed = JSON.parse(message);
    if (parsed?.event) {
      broadcastJob(parsed.event, parsed.data || {});
    }
  } catch (error) {
    console.error('[redis-sub] invalid message:', error.message);
  }
});

app.post('/webhooks/github', express.raw({ type: 'application/json' }), createWebhookHandler(queue));

app.use((req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '1mb' }));

function requireApiKey(req, res, next) {
  const configuredKey = process.env.API_KEY;
  if (!configuredKey) return next();

  const headerKey = req.header('x-api-key');
  const queryKey = req.query?.api_key;

  if (headerKey === configuredKey || queryKey === configuredKey) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/api/health', async (_req, res) => {
  try {
    await pg.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[health] check failed:', error.message);
    res.status(500).json({ status: 'error' });
  }
});

app.get('/api/jobs', requireApiKey, async (_req, res) => {
  try {
    const { rows } = await pg.query(
      'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50'
    );

    res.json(rows);
  } catch (error) {
    console.error('[api/jobs] query failed:', error.message);
    res.status(500).json({ error: 'Unable to load jobs' });
  }
});

app.get('/api/jobs/:id', requireApiKey, async (req, res) => {
  try {
    const { rows } = await pg.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error('[api/jobs/:id] query failed:', error.message);
    return res.status(500).json({ error: 'Unable to load job' });
  }
});

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (parsedUrl.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const configuredKey = process.env.API_KEY;
  if (configuredKey) {
    const headerKey = req.headers['x-api-key'];
    const queryKey = parsedUrl.searchParams.get('api_key');
    const isValid = headerKey === configuredKey || queryKey === configuredKey;

    if (!isValid) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    wss.emit('connection', client, req);
  });
});

async function start() {
  await ensureJobSchema();
  server.listen(port, () => {
    console.log(`⚡ Flux server running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('[startup] failed:', error.message);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await redisSub.quit();
  await queue.close();
  await pg.end();
  process.exit(0);
});
