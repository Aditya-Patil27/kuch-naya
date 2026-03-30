CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  delivery_id TEXT UNIQUE,
  pr_number INTEGER,
  repo TEXT,
  head_sha TEXT,
  installation_id TEXT,
  status TEXT DEFAULT 'queued',
  verdict TEXT,
  p99_baseline REAL,
  p99_pr REAL,
  p99_delta_pct REAL,
  findings JSONB,
  check_run_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_repo_pr_head_sha ON jobs(repo, pr_number, head_sha);
