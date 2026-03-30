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

async function processPullRequestEvent(payload, queue) {
  const action = payload.action;
  const allowed = new Set(['opened', 'synchronize', 'reopened']);
  if (!allowed.has(action)) return;

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

  const octokit = await getOctokit(installationId);
  const checkRunId = await createCheckRun(octokit, {
    owner,
    repo: repoName,
    sha: headSha,
  });

  const id = nanoid();

  await pg.query(
    `INSERT INTO jobs (
      id, pr_number, repo, head_sha, installation_id, status, check_run_id
    ) VALUES ($1, $2, $3, $4, $5, 'queued', $6)`,
    [id, prNumber, repo, headSha, String(installationId), checkRunId]
  );

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
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

function createWebhookHandler(queue) {
  return async (req, res) => {
    const rawBody = req.body;
    const event = req.header('x-github-event');
    const signature = req.header('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ error: 'Expected raw body buffer' });
    }

    if (!verifySignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    res.status(202).json({ accepted: true });

    setImmediate(async () => {
      try {
        if (event === 'pull_request') {
          await processPullRequestEvent(payload, queue);
        }
      } catch (error) {
        console.error('[webhook] async processing failed:', error.message);
      }
    });
  };
}

module.exports = { createWebhookHandler };
