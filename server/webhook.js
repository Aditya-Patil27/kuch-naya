const crypto = require('crypto');
const { nanoid } = require('nanoid');
const { getOctokit, createCheckRun } = require('./github');
const { pg } = require('./db');
const { broadcastJob } = require('./ws');

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const digest = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')}`;

  const a = Buffer.from(digest);
  const b = Buffer.from(signatureHeader);

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function processPullRequestEvent(payload, queue, deliveryId) {
  const action = payload.action;
  const allowed = new Set(['opened', 'synchronize', 'reopened']);
  if (!allowed.has(action)) {
    return { status: 'ignored', reason: `action:${action || 'unknown'}` };
  }

  const installationId = payload.installation?.id;
  const prNumber = payload.pull_request?.number;
  const owner = payload.repository?.owner?.login;
  const repoName = payload.repository?.name;
  const repo = `${owner}/${repoName}`;
  const headSha = payload.pull_request?.head?.sha;
  const diffUrl = payload.pull_request?.diff_url;

  if (!installationId || !prNumber || !owner || !repoName || !headSha || !diffUrl) {
    throw new Error('Webhook payload missing required pull_request fields');
  }

  const existing = await pg.query(
    'SELECT id FROM jobs WHERE delivery_id = $1 LIMIT 1',
    [deliveryId]
  );
  if (existing.rows.length) {
    return { status: 'duplicate', id: existing.rows[0].id };
  }

  let id;
  let checkRunId;
  try {
    id = nanoid();

    const inserted = await pg.query(
      `INSERT INTO jobs (
        id, delivery_id, pr_number, repo, head_sha, installation_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'queued')
      ON CONFLICT (delivery_id) DO NOTHING
      RETURNING id`,
      [id, deliveryId, prNumber, repo, headSha, String(installationId)]
    );

    if (!inserted.rows.length) {
      const duplicate = await pg.query(
        'SELECT id FROM jobs WHERE delivery_id = $1 LIMIT 1',
        [deliveryId]
      );
      return { status: 'duplicate', id: duplicate.rows[0]?.id || null };
    }

    const octokit = await getOctokit(installationId);
    checkRunId = await createCheckRun(octokit, {
      owner,
      repo: repoName,
      sha: headSha,
    });

    await pg.query('UPDATE jobs SET check_run_id = $2 WHERE id = $1', [id, checkRunId]);

    const queuedPayload = {
      id,
      pr_number: prNumber,
      repo,
      head_sha: headSha,
      installation_id: String(installationId),
      status: 'queued',
      check_run_id: checkRunId,
      stage: 0,
      progress: 5,
      diff_url: diffUrl,
    };

    broadcastJob('job:queued', queuedPayload);

    await queue.add(
      {
        ...queuedPayload,
        owner,
        repoName,
      },
      {
        jobId: deliveryId,
        attempts: parsePositiveInt(process.env.JOB_MAX_ATTEMPTS, 3),
        backoff: {
          type: 'exponential',
          delay: parsePositiveInt(process.env.JOB_RETRY_DELAY_MS, 5000),
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    return { status: 'accepted', id };
  } catch (error) {
    if (id && !checkRunId) {
      await pg
        .query('DELETE FROM jobs WHERE id = $1 AND check_run_id IS NULL', [id])
        .catch(() => {});
    }
    throw error;
  }
}

function getDeliveryId(req) {
  const header = req.header('x-github-delivery');
  if (!header || typeof header !== 'string') return null;
  const trimmed = header.trim();
  return trimmed.length ? trimmed : null;
}

function createWebhookHandler(queue) {
  return async (req, res) => {
    const rawBody = req.body;
    const event = req.header('x-github-event');
    const signature = req.header('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const deliveryId = getDeliveryId(req);

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ error: 'Expected raw body buffer' });
    }

    if (!secret) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!verifySignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (!deliveryId) {
      return res.status(400).json({ error: 'Missing x-github-delivery header' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    if (event !== 'pull_request') {
      return res.status(202).json({ ignored: true, reason: `event:${event || 'unknown'}` });
    }

    try {
      const result = await processPullRequestEvent(payload, queue, deliveryId);

      if (result.status === 'ignored') {
        return res.status(202).json({ ignored: true, reason: result.reason });
      }

      if (result.status === 'duplicate') {
        return res.status(200).json({ duplicate: true, id: result.id });
      }

      return res.status(202).json({ accepted: true, id: result.id });
    } catch (error) {
      console.error('[webhook] processing failed:', error.message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  };
}

module.exports = { createWebhookHandler };
