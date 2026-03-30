const fs = require('fs');
const path = require('path');

function mapConclusion(verdict) {
  if (verdict === 'PASS') return 'success';
  if (verdict === 'WARN') return 'neutral';
  return 'failure';
}

function loadPrivateKey() {
  const keyPath = process.env.GITHUB_PRIVATE_KEY_PATH || './private-key.pem';
  const absolutePath = path.isAbsolute(keyPath)
    ? keyPath
    : path.resolve(process.cwd(), keyPath);

  return fs.readFileSync(absolutePath, 'utf8');
}

let ghAppPromise;

async function getGitHubApp() {
  if (!ghAppPromise) {
    ghAppPromise = import('@octokit/app').then(({ App }) => {
      return new App({
        appId: process.env.GITHUB_APP_ID,
        privateKey: loadPrivateKey(),
      });
    });
  }

  return ghAppPromise;
}

async function getOctokit(installationId) {
  const ghApp = await getGitHubApp();
  return ghApp.getInstallationOctokit(Number(installationId));
}

async function createCheckRun(octokit, { owner, repo, sha }) {
  const { data } = await octokit.checks.create({
    owner,
    repo,
    name: 'flux/chaos-review',
    head_sha: sha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    output: {
      title: 'FLUX chaos review started',
      summary: 'Queued for baseline + chaos verification.',
    },
  });

  return data.id;
}

async function completeCheckRun(octokit, { owner, repo, checkRunId, verdict, summary }) {
  await octokit.checks.update({
    owner,
    repo,
    check_run_id: Number(checkRunId),
    status: 'completed',
    completed_at: new Date().toISOString(),
    conclusion: mapConclusion(verdict),
    output: {
      title: `FLUX verdict: ${verdict}`,
      summary,
    },
  });
}

async function postPRComment(octokit, { owner, repo, prNumber, body }) {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: Number(prNumber),
    body,
  });
}

module.exports = {
  getOctokit,
  createCheckRun,
  completeCheckRun,
  postPRComment,
};
