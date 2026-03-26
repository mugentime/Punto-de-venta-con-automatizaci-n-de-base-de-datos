// Script to recover coworking sessions from production database
const pg = require('pg');
const { Pool } = pg;
const fs = require('fs').promises;
require('dotenv').config();

async function recoverSessions() {
  console.log('🔍 Checking production database for recent coworking sessions...\n');

  // You need to update DATABASE_URL in .env with current Railway credentials
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: No DATABASE_URL found in .env file');
    console.log('\n📝 To recover sessions, you need to:');
    console.log('1. Go to Railway Dashboard');
    console.log('2. Click on PostgreSQL service');
    console.log('3. Go to "Variables" tab');
    console.log('4. Copy the DATABASE_URL value');
    console.log('5. Update .env file with the current DATABASE_URL');
    console.log('\nThen run this script again.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Connected to production database\n');

    // Get sessions from last 30 days (wider range to be safe)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await client.query(`
      SELECT *
      FROM coworking_sessions
      WHERE created_at >= $1
      ORDER BY created_at DESC
    `, [thirtyDaysAgo]);

    console.log(`📊 Found ${result.rows.length} sessions from last 30 days\n`);

    if (result.rows.length === 0) {
      console.log('❌ No recent sessions found in production database');
      console.log('\nPossible reasons:');
      console.log('1. Sessions were not saved (API error)');
      console.log('2. Sessions are in browser cache but not persisted');
      console.log('3. Different database/environment being used');
      return;
    }

    // Analyze by date
    const now = new Date();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    const last5Days = result.rows.filter(s => new Date(s.created_at) >= fiveDaysAgo);
    const older = result.rows.filter(s => new Date(s.created_at) < fiveDaysAgo);

    console.log('📅 BREAKDOWN:');
    console.log(`   Last 5 days: ${last5Days.length} sessions`);
    console.log(`   6-30 days ago: ${older.length} sessions`);
    console.log('');

    if (last5Days.length > 0) {
      console.log('✅ FOUND SESSIONS FROM LAST 5 DAYS:\n');
      last5Days.forEach((session, index) => {
        const created = new Date(session.created_at);
        const daysAgo = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        console.log(`${index + 1}. ${session.clientName || session.client}`);
        console.log(`   Created: ${created.toISOString()} (${daysAgo} days ago)`);
        console.log(`   Status: ${session.status}`);
        console.log(`   Total: $${session.total || 0}`);
        console.log(`   ID: ${session.id}`);
        console.log('');
      });

      // Ask if user wants to export
      console.log('💾 Export options:');
      console.log('1. Save to local file: data/recovered_sessions.json');
      console.log('2. Show full JSON output');
      console.log('\nTo export, modify this script and uncomment the export section.');

      // Uncomment to export:
      /*
      await fs.writeFile(
        'data/recovered_sessions.json',
        JSON.stringify(last5Days, null, 2)
      );
      console.log('✅ Exported to data/recovered_sessions.json');
      */
    } else {
      console.log('❌ No sessions found in the last 5 days');

      if (older.length > 0) {
        console.log('\nMost recent session:');
        const mostRecent = older[0];
        console.log(`   Client: ${mostRecent.clientName || mostRecent.client}`);
        console.log(`   Created: ${new Date(mostRecent.created_at).toISOString()}`);
        console.log(`   Status: ${mostRecent.status}`);
      }
    }

    // Also check for recent orders
    console.log('\n🔍 Checking for recent orders (coworking might have been recorded as orders)...\n');

    const ordersResult = await client.query(`
      SELECT *
      FROM orders
      WHERE created_at >= $1
        AND (items::text ILIKE '%coworking%' OR "clientName" IS NOT NULL)
      ORDER BY created_at DESC
    `, [fiveDaysAgo]);

    if (ordersResult.rows.length > 0) {
      console.log(`📋 Found ${ordersResult.rows.length} recent orders:`);
      ordersResult.rows.forEach((order, index) => {
        console.log(`\n${index + 1}. ${order.clientName}`);
        console.log(`   Date: ${new Date(order.created_at).toISOString()}`);
        console.log(`   Total: $${order.total}`);
        console.log(`   Service: ${order.serviceType}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n⚠️  DATABASE_URL credentials are outdated');
      console.log('\n📝 To fix:');
      console.log('1. Go to Railway Dashboard > PostgreSQL > Variables');
      console.log('2. Copy current DATABASE_URL');
      console.log('3. Update .env file');
      console.log('4. Run this script again');
    }
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

recoverSessions();
