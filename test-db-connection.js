#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
    console.log('🔍 Checking DATABASE_URL:', process.env.DATABASE_URL ? '[REDACTED]' : 'not set');
    
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in environment');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔄 Attempting to connect to PostgreSQL...');
        const client = await pool.connect();
        console.log('✅ Connected successfully');
        
        console.log('🏷️ Testing query...');
        const result = await client.query('SELECT current_timestamp');
        console.log('✅ Query successful:', result.rows[0]);
        
        // Test table creation (if database allows)
        try {
            console.log('🔄 Testing table operations...');
            await client.query('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, test_time TIMESTAMP DEFAULT NOW())');
            await client.query('INSERT INTO connection_test DEFAULT VALUES');
            const testResult = await client.query('SELECT COUNT(*) as test_count FROM connection_test');
            console.log('✅ Table operations successful, test records:', testResult.rows[0].test_count);
            await client.query('DROP TABLE connection_test');
            console.log('✅ Cleanup successful');
        } catch (tableError) {
            console.log('⚠️ Table operations failed (might be permissions):', tableError.message);
        }
        
        client.release();
        await pool.end();
        
        console.log('✅ All tests passed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testConnection();
