#!/usr/bin/env node

/**
 * Simple PostgreSQL Connection Test
 * Tests the exact connection logic used by the application
 */

const { Pool } = require('pg');
require('dotenv').config();

console.log('🔍 Simple PostgreSQL Connection Test');
console.log('=====================================');

// Environment variables check
console.log('Environment Check:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('- RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || 'undefined');
console.log('- DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('- DATABASE_URL value (masked):', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') : 'undefined');

// Test the exact configuration from utils/database.js
if (process.env.DATABASE_URL) {
    console.log('\n🧪 Testing with application configuration...');
    
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    (async () => {
        try {
            console.log('🔌 Attempting connection...');
            const client = await pool.connect();
            console.log('✅ Connection successful!');
            
            console.log('📋 Testing basic query...');
            const result = await client.query('SELECT NOW() as current_time, version() as version');
            console.log('✅ Query successful!');
            console.log('- Current time:', result.rows[0].current_time);
            console.log('- PostgreSQL version:', result.rows[0].version.substring(0, 50) + '...');
            
            console.log('🏗️ Testing table creation...');
            await client.query('CREATE TABLE IF NOT EXISTS connection_test_simple (id SERIAL PRIMARY KEY, test_time TIMESTAMP DEFAULT NOW())');
            console.log('✅ Table creation successful!');
            
            console.log('📝 Testing data insertion...');
            await client.query('INSERT INTO connection_test_simple DEFAULT VALUES');
            const countResult = await client.query('SELECT COUNT(*) as count FROM connection_test_simple');
            console.log('✅ Data insertion successful!');
            console.log('- Test records count:', countResult.rows[0].count);
            
            console.log('🧹 Cleaning up test table...');
            await client.query('DROP TABLE connection_test_simple');
            console.log('✅ Cleanup successful!');
            
            client.release();
            console.log('\n🎉 ALL TESTS PASSED! PostgreSQL connection is working properly.');
            
        } catch (error) {
            console.error('\n❌ Connection or query failed:');
            console.error('- Error message:', error.message);
            console.error('- Error code:', error.code || 'undefined');
            console.error('- Error details:', error.detail || 'undefined');
            console.error('- Error hint:', error.hint || 'undefined');
            
            // Additional debugging
            console.error('\n🔍 Connection debugging:');
            console.error('- SSL requirement:', process.env.NODE_ENV === 'production' ? 'Required (rejectUnauthorized: false)' : 'Disabled');
            console.error('- Connection timeout:', pool.options?.connectionTimeoutMillis || 'default');
            
        } finally {
            await pool.end();
            console.log('🔌 Connection pool closed.');
        }
    })();
} else {
    console.log('\n⚠️ DATABASE_URL not found in environment variables');
    console.log('This means the application will fallback to file-based storage');
    console.log('\nTo fix PostgreSQL connection:');
    console.log('1. Ensure Railway PostgreSQL addon is installed');
    console.log('2. Check that DATABASE_URL is set in Railway environment variables');
    console.log('3. Redeploy the application after setting the variable');
}