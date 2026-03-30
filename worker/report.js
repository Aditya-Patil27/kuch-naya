const { completeCheckRun, postPRComment } = require('../server/github');

function buildPRComment({ payload, result, analysis }) {
  const verdictEmoji = result.verdict === 'PASS' ? '🟢' : result.verdict === 'WARN' ? '🟡' : '🔴';

  return [
    `## ${verdictEmoji} FLUX Chaos Review — ${result.verdict}`,
    '',
    `**Job:** \`${payload.id}\`  `,
    `**Repo:** \`${payload.repo}\`  `,
    `**PR:** #${payload.pr_number}`,
    '',
    '| Metric | Baseline | PR (Chaos) | Delta |',
    '|---|---:|---:|---:|',
    `| P95 Latency | ${result.baseline.p95.toFixed(2)}ms | ${result.chaos.p95.toFixed(2)}ms | ${((result.chaos.p95 - result.baseline.p95) / Math.max(result.baseline.p95, 1) * 100).toFixed(2)}% |`,
    `| P99 Latency | ${result.baseline.p99.toFixed(2)}ms | ${result.chaos.p99.toFixed(2)}ms | ${result.p99DeltaPct.toFixed(2)}% |`,
    `| RPS | ${result.baseline.rps.toFixed(2)} | ${result.chaos.rps.toFixed(2)} | ${(result.chaos.rps - result.baseline.rps).toFixed(2)} |`,
    `| Error Rate | ${result.baseline.errorRate.toFixed(2)}% | ${result.chaos.errorRate.toFixed(2)}% | ${(result.chaos.errorRate - result.baseline.errorRate).toFixed(2)}% |`,
    '',
    '### Mechanism',
    analysis.mechanism,
    '',
    '### Suggested Fix',
    '```',
    analysis.suggestedFix,
    '```',
    '',
    `**Confidence:** ${analysis.confidence}`,
    `**Summary:** ${analysis.summary}`,
  ].join('\n');
}

async function reportToGitHub({ payload, result, analysis }) {
  const octokit = await require('../server/github').getOctokit(payload.installation_id);
  const summary = `${result.verdict} | P99 delta ${result.p99DeltaPct.toFixed(2)}% | ${analysis.summary}`;

  await completeCheckRun(octokit, {
    owner: payload.owner,
    repo: payload.repoName,
    checkRunId: payload.check_run_id,
    verdict: result.verdict,
    summary,
  });

  const body = buildPRComment({ payload, result, analysis });

  await postPRComment(octokit, {
    owner: payload.owner,
    repo: payload.repoName,
    prNumber: payload.pr_number,
    body,
  });

  return body;
}

module.exports = { buildPRComment, reportToGitHub };
