const { Pool } = require('pg');

const pg = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pg.on('error', (err) => {
  console.error('[db] pool error:', err.message);
});

module.exports = { pg };
