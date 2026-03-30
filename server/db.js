const { Pool } = require('pg');

const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SCHEMA_PATCHES = [
  'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_id TEXT',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_delivery_id ON jobs(delivery_id) WHERE delivery_id IS NOT NULL',
  'CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_jobs_repo_pr_head_sha ON jobs(repo, pr_number, head_sha)',
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
