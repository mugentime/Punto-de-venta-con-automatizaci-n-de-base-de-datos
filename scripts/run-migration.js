#!/usr/bin/env node
/**
 * Database Migration Script - Add discount and tip columns
 *
 * This script adds the discount and tip columns to the orders table
 * in your Railway PostgreSQL database.
 *
 * Usage:
 *   node scripts/run-migration.js
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
  console.error('Please run: railway run node scripts/run-migration.js');
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
-- Add discount column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'orders' AND column_name = 'discount') THEN
        ALTER TABLE orders ADD COLUMN discount NUMERIC(10, 2) DEFAULT 0;
        RAISE NOTICE 'Added discount column to orders table';
    ELSE
        RAISE NOTICE 'discount column already exists';
    END IF;
END $$;

-- Add tip column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'orders' AND column_name = 'tip') THEN
        ALTER TABLE orders ADD COLUMN tip NUMERIC(10, 2) DEFAULT 0;
        RAISE NOTICE 'Added tip column to orders table';
    ELSE
        RAISE NOTICE 'tip column already exists';
    END IF;
END $$;

-- Update existing orders to set discount = 0 and tip = 0 if they are null
UPDATE orders SET discount = 0 WHERE discount IS NULL;
UPDATE orders SET tip = 0 WHERE tip IS NULL;
`;

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('📝 Running migration script...\n');

    // Execute the migration SQL
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify the columns were added
    console.log('🔍 Verifying columns...\n');
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name IN ('discount', 'tip')
      ORDER BY column_name;
    `);

    if (result.rows.length === 2) {
      console.log('✅ Verification successful! Columns found:');
      result.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
      });
    } else {
      console.warn('⚠️  Warning: Expected 2 columns but found:', result.rows.length);
    }

    // Show count of orders
    const countResult = await client.query('SELECT COUNT(*) as count FROM orders');
    console.log(`\n📊 Total orders in database: ${countResult.rows[0].count}`);

    console.log('\n🎉 Migration completed successfully!');

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
