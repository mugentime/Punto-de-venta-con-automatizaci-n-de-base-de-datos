// Auto-run pending migrations on server startup (ES Module version)
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runPendingMigrations() {
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

    // Get list of executed migrations
    const executedResult = await client.query(
      `SELECT migration_name FROM schema_migrations ORDER BY migration_name`
    );
    const executedMigrations = new Set(executedResult.rows.map(r => r.migration_name));

    // Read all migration files from migrations directory
    const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
    const files = await fs.readdir(migrationsDir);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    console.log(`📂 Found ${migrationFiles.length} migration files`);

    let ranCount = 0;
    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');

      if (executedMigrations.has(migrationName)) {
        console.log(`⏭️  Skipping ${migrationName} (already applied)`);
        continue;
      }

      console.log(`🚀 Running migration: ${migrationName}...`);

      try {
        // Read and execute migration
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = await fs.readFile(migrationPath, 'utf8');

        await client.query(migrationSQL);

        // Record migration as completed
        await client.query(
          `INSERT INTO schema_migrations (migration_name) VALUES ($1)`,
          [migrationName]
        );

        console.log(`✅ Migration ${migrationName} completed successfully!`);
        ranCount++;
      } catch (migrationError) {
        console.error(`❌ Error running migration ${migrationName}:`, migrationError.message);
        // Continue with other migrations
      }
    }

    if (ranCount === 0) {
      console.log('✅ All migrations up to date');
    } else {
      console.log(`✅ Ran ${ranCount} new migration(s)`);
    }

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
