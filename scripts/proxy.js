require('dotenv').config();
const SmeeClient = require('smee-client');

const port = process.env.PORT || 3000;
const source = process.env.WEBHOOK_PROXY_URL;

if (!source) {
  console.error('[Proxy] Error: Missing WEBHOOK_PROXY_URL in environment');
  process.exit(1);
}

const target = `http://localhost:${port}/webhooks/github`;

const smee = new SmeeClient({
  source,
  target,
  logger: console
});

const events = smee.start();

console.log(`[Proxy] Started forwarding webhooks from ${source} to ${target}`);

// Gracefully stop forwarding when process is terminated
const shutdown = () => {
  console.log('[Proxy] Stopping webhook forwarding...');
  events.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
