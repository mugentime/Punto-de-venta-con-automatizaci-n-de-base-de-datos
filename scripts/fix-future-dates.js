#!/usr/bin/env node
/**
 * Script to fix future dates in the database
 * Connects to Railway PostgreSQL and runs the migration
 */

import { Pool } from 'pg';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixFutureDates() {
  const client = await pool.connect();

  try {
    console.log('🔍 Connecting to database...');

    // Read the migration SQL
    const migrationPath = join(__dirname, '..', 'database', 'migrations', '005_fix_future_dates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📊 Checking for records with future dates...');

    // Check affected records first
    const checkResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE date > CURRENT_TIMESTAMP) as future_count,
        MAX(date) as latest_date
      FROM records
      WHERE date > CURRENT_TIMESTAMP
    `);

    const { future_count, latest_date } = checkResult.rows[0];

    if (future_count === '0') {
      console.log('✅ No records with future dates found. Database is clean.');
      return;
    }

    console.log(`⚠️  Found ${future_count} record(s) with future dates`);
    console.log(`   Latest date found: ${latest_date}`);
    console.log('');

    // Show examples
    console.log('📋 Example records with future dates:');
    const examplesResult = await client.query(`
      SELECT _id, client, date, service, total
      FROM records
      WHERE date > CURRENT_TIMESTAMP
      ORDER BY date DESC
      LIMIT 5
    `);

    examplesResult.rows.forEach(row => {
      console.log(`   - ${row.client} | ${new Date(row.date).toLocaleDateString('es-MX')} | $${row.total}`);
    });

    console.log('');
    console.log('🔧 Fixing future dates...');

    // Execute the fix
    await client.query(`
      UPDATE records
      SET
        date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE date > CURRENT_TIMESTAMP
    `);

    console.log('✅ Successfully updated records with future dates to current date');

    // Verify the fix
    const verifyResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE date > CURRENT_TIMESTAMP) as future_count,
        MAX(date) as latest_date
      FROM records
    `);

    const afterFix = verifyResult.rows[0];

    console.log('');
    console.log('📊 Verification Results:');
    console.log(`   Total records: ${afterFix.total}`);
    console.log(`   Records with future dates: ${afterFix.future_count}`);
    console.log(`   Latest date: ${new Date(afterFix.latest_date).toLocaleDateString('es-MX')}`);

    if (afterFix.future_count === '0') {
      console.log('');
      console.log('✅ SUCCESS: All future dates have been fixed!');
    } else {
      console.log('');
      console.log('⚠️  WARNING: Some future dates still exist. Please investigate.');
    }

  } catch (error) {
    console.error('❌ Error fixing future dates:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
console.log('');
console.log('🚀 Starting future dates fix...');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

fixFutureDates()
  .then(() => {
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  });
