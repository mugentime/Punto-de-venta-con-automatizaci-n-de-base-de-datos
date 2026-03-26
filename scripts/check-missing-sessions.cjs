// Check for sessions between March 20-25, 2026
const pg = require('pg');
const { Pool } = pg;
require('dotenv').config();

async function checkMissingSessions() {
  console.log('🔍 Checking for sessions between March 20-25, 2026...\n');

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: No DATABASE_URL found in .env file');
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

    // Query for sessions between March 20-25
    const result = await client.query(`
      SELECT
        id,
        "clientName" as client,
        "startTime" as start_time,
        "endTime" as end_time,
        status,
        total,
        "hourlyRate" as hourly_rate,
        created_at,
        updated_at
      FROM coworking_sessions
      WHERE
        "startTime" >= '2026-03-20T00:00:00.000Z'
        AND "startTime" <= '2026-03-25T23:59:59.999Z'
      ORDER BY "startTime" DESC
    `);

    console.log(`📊 Found ${result.rows.length} sessions between March 20-25, 2026\n`);

    if (result.rows.length === 0) {
      console.log('❌ No sessions found in this date range in the database.');
      console.log('\nThis means the sessions were likely never saved to the database.');
      console.log('Possible causes:');
      console.log('1. API errors during session creation');
      console.log('2. Sessions only stored in browser cache');
      console.log('3. Network issues prevented saving');
      return;
    }

    // Group by date
    const byDate = {};
    result.rows.forEach(session => {
      const date = new Date(session.start_time).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = [];
      }
      byDate[date].push(session);
    });

    console.log('📅 Sessions by date:\n');
    Object.keys(byDate).sort().forEach(date => {
      const sessions = byDate[date];
      console.log(`\n${date} (${sessions.length} sessions):`);
      sessions.forEach((s, i) => {
        const startTime = new Date(s.start_time).toLocaleString('es-MX');
        const endTime = s.end_time ? new Date(s.end_time).toLocaleString('es-MX') : 'N/A';
        console.log(`  ${i + 1}. ${s.client || 'Sin nombre'}`);
        console.log(`     Start: ${startTime}`);
        console.log(`     End: ${endTime}`);
        console.log(`     Status: ${s.status}`);
        console.log(`     Total: $${s.total || 0}`);
        console.log(`     ID: ${s.id}`);
      });
    });

    // Check for dates with no sessions
    console.log('\n\n🔍 Checking for missing dates...\n');
    const allDates = ['2026-03-20', '2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24', '2026-03-25'];
    const datesWithSessions = Object.keys(byDate);
    const missingDates = allDates.filter(d => !datesWithSessions.includes(d));

    if (missingDates.length > 0) {
      console.log('⚠️  No sessions found on these dates:');
      missingDates.forEach(d => console.log(`   - ${d}`));
      console.log('\nThese sessions were likely never saved to the database.');
    } else {
      console.log('✅ All dates have sessions recorded.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n⚠️  DATABASE_URL credentials are outdated');
      console.log('\n📝 To get current credentials:');
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

checkMissingSessions();
