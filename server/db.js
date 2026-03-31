const { Pool } = require('pg');

const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

const SCHEMA_PATCHES = [
  `CREATE TABLE IF NOT EXISTS jobs (
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
  )`,
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_id TEXT',
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tenant_id TEXT',
  "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0",
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_error TEXT',
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ',
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT',
  "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS run_mode TEXT NOT NULL DEFAULT 'single'",
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS shard_count INTEGER NOT NULL DEFAULT 1',
  "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb",
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    github_org TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `INSERT INTO tenants (id, name)
   VALUES ('default', 'Default Tenant')
   ON CONFLICT (id) DO NOTHING`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'jobs_tenant_id_fkey'
     ) THEN
       ALTER TABLE jobs
         ADD CONSTRAINT jobs_tenant_id_fkey
         FOREIGN KEY (tenant_id)
         REFERENCES tenants(id)
         ON DELETE SET NULL;
     END IF;
   END $$`,
  `CREATE TABLE IF NOT EXISTS runner_tokens (
    token_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS runners (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    capabilities JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS dead_letter_jobs (
    job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    payload JSONB,
    moved_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_delivery_id ON jobs(delivery_id) WHERE delivery_id IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_jobs_repo_pr_head_sha ON jobs(repo, pr_number, head_sha)',
  "CREATE INDEX IF NOT EXISTS idx_jobs_tenant_created_at ON jobs(COALESCE(tenant_id, 'default'), created_at DESC)",
  'CREATE INDEX IF NOT EXISTS idx_jobs_status_attempt_count ON jobs(status, attempt_count DESC)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_github_org_ci ON tenants(lower(github_org)) WHERE github_org IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_runner_tokens_tenant_id ON runner_tokens(tenant_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_runner_tokens_hash ON runner_tokens(token_hash)',
  'CREATE INDEX IF NOT EXISTS idx_runners_tenant_id ON runners(tenant_id, created_at DESC)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_runners_token_hash ON runners(token_hash)',
  'CREATE INDEX IF NOT EXISTS idx_dead_letter_moved_at ON dead_letter_jobs(moved_at DESC)',
];

async function ensureJobSchema() {
  for (const sql of SCHEMA_PATCHES) {
    await pg.query(sql);
  }
}

pg.on('error', (err) => {
  console.error('[db] pool error:', err.message);
});

module.exports = { pg, ensureJobSchema };
