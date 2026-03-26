// Auto-run pending migrations on server startup
const pg = require('pg');
const { Pool } = pg;
const fs = require('fs').promises;
const path = require('path');

async function runPendingMigrations() {
  // Only run in production with PostgreSQL
  if (!process.env.DATABASE_URL) {
    console.log('⏭️  Skipping migrations (no DATABASE_URL)');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  let client;

  try {
    console.log('🔄 Checking for pending migrations...');
    client = await pool.connect();

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if migration 006 has been run
    const result = await client.query(
      `SELECT * FROM schema_migrations WHERE migration_name = $1`,
      ['006_fix_coworking_sessions']
    );

    if (result.rows.length > 0) {
      console.log('✅ Migration 006_fix_coworking_sessions already applied');
      return;
    }

    console.log('🚀 Running migration 006_fix_coworking_sessions...');

    // Read and execute migration
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '006_fix_coworking_sessions.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    await client.query(migrationSQL);

    // Record migration as completed
    await client.query(
      `INSERT INTO schema_migrations (migration_name) VALUES ($1)`,
      ['006_fix_coworking_sessions']
    );

    console.log('✅ Migration 006_fix_coworking_sessions completed successfully!');

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    // Don't crash the server, just log the error
    console.error('⚠️  Server will continue without migration. Manual intervention may be required.');
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

module.exports = { runPendingMigrations };

// Run if called directly
if (require.main === module) {
  runPendingMigrations().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
