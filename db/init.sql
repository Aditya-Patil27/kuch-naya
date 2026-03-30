CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
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
