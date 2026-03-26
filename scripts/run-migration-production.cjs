const pg = require('pg');
const { Pool } = pg;
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client;

  try {
    console.log('🔌 Connecting to production database...');
    console.log('📍 Database URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');

    client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '006_fix_coworking_sessions.sql');
    console.log(`📄 Reading migration: ${migrationPath}`);
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    console.log('🚀 Running migration 006_fix_coworking_sessions.sql...\n');

    // Execute migration
    const result = await client.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Verification query results:');

    // Run verification query
    const verifyResult = await client.query(`
      SELECT
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE status = 'active') as active_sessions,
        COUNT(*) FILTER (WHERE start_time > CURRENT_TIMESTAMP) as future_start_times,
        COUNT(*) FILTER (WHERE end_time > CURRENT_TIMESTAMP) as future_end_times,
        MAX(start_time) as latest_start_time,
        MAX(end_time) as latest_end_time
      FROM coworking_sessions;
    `);

    console.table(verifyResult.rows);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

runMigration();
