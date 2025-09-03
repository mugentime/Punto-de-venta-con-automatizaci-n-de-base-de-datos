const { Pool } = require('pg');

async function testDatabaseConnection() {
    console.log('🔍 Testing database connection...');
    
    // Check environment variable
    const dbUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL present:', !!dbUrl);
    
    if (!dbUrl) {
        console.log('❌ DATABASE_URL not found. Sistema usará archivos.');
        return false;
    }
    
    // Mask password in log
    const maskedUrl = dbUrl.replace(/(postgresql:\/\/[^:]+:)[^@]+(@.+)/, '$1***$2');
    console.log('Connection string:', maskedUrl);
    
    try {
        const pool = new Pool({
            connectionString: dbUrl,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000
        });
        
        console.log('🔌 Attempting database connection...');
        const client = await pool.connect();
        
        console.log('✅ Connected! Testing query...');
        const result = await client.query('SELECT NOW() as current_time');
        console.log('✅ Query successful:', result.rows[0].current_time);
        
        client.release();
        await pool.end();
        
        console.log('🎉 Database connection successful!');
        return true;
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Error code:', error.code);
        
        if (error.code === 'ENOTFOUND') {
            console.log('💡 DNS resolution failed - Check network connection');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Connection refused - Database may be down');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('💡 Connection timeout - Network issues or firewall');
        }
        
        return false;
    }
}

// Set the actual DATABASE_URL for testing
process.env.DATABASE_URL = 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@caboose.proxy.rlwy.net:27640/railway';

testDatabaseConnection()
    .then(success => {
        if (success) {
            console.log('\n🚀 Database is ready for production!');
        } else {
            console.log('\n⚠️  Will fallback to file-based storage');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });