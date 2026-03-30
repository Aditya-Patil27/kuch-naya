const http = require('http');
const express = require('express');
const Bull = require('bull');
const Redis = require('ioredis');
const dotenv = require('dotenv');

const { pg } = require('./db');
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

app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pg.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/api/jobs', async (_req, res) => {
  const { rows } = await pg.query(
    'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50'
  );

  res.json(rows);
});

app.get('/api/jobs/:id', async (req, res) => {
  const { rows } = await pg.query('SELECT * FROM jobs WHERE id = $1 LIMIT 1', [req.params.id]);

  if (!rows.length) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json(rows[0]);
});

const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (client) => {
    wss.emit('connection', client, req);
  });
});

server.listen(port, () => {
  console.log(`⚡ Flux server running on http://localhost:${port}`);
});

process.on('SIGINT', async () => {
  await redisSub.quit();
  await queue.close();
  await pg.end();
  process.exit(0);
});
