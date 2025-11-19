#!/usr/bin/env node
/**
 * Database Migration Script - Fix idempotency_keys table schema
 *
 * This script ensures the idempotency_keys table has the correct schema
 * including the order_id column that was missing.
 *
 * Usage:
 *   railway run node scripts/fix-idempotency-keys-table.js
 *
 * The script will use the DATABASE_URL from your environment variables.
 * Make sure you have Railway CLI linked to your project.
 */

import pg from 'pg';
const { Pool } = pg;

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not found');
  console.error('Please run: railway run node scripts/fix-idempotency-keys-table.js');
  process.exit(1);
}

console.log('🔌 Connecting to Railway PostgreSQL database...\n');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const migrationSQL = `
-- Migration: Fix idempotency_keys table schema
-- Ensures the order_id column exists in the idempotency_keys table

BEGIN;

-- Drop existing table if it has incorrect schema
DROP TABLE IF EXISTS idempotency_keys CASCADE;

-- Recreate table with correct schema
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL DEFAULT 'order',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  response_data JSONB
);

-- Index for efficient expiration cleanup
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Index for querying by resource type and creation date
CREATE INDEX idx_idempotency_resource ON idempotency_keys(resource_type, created_at);

-- Index for querying by order_id
CREATE INDEX idx_idempotency_order ON idempotency_keys(order_id);

COMMIT;
`;

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('📝 Running idempotency_keys table migration...\n');

    // Execute the migration SQL
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify the table was created correctly
    console.log('🔍 Verifying table structure...\n');
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'idempotency_keys'
      ORDER BY ordinal_position;
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verification successful! Table structure:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
    } else {
      console.error('❌ Table not found or has no columns!');
      process.exit(1);
    }

    // Verify indexes
    console.log('\n🔍 Verifying indexes...\n');
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'idempotency_keys'
      ORDER BY indexname;
    `);

    if (indexResult.rows.length > 0) {
      console.log('✅ Indexes found:');
      indexResult.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
    }

    console.log('\n🎉 idempotency_keys table migration completed successfully!');
    console.log('✅ The table now includes the order_id column and all required indexes.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
