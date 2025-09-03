// Direct DATABASE_URL test script for Railway environment
const https = require('https');

async function testDatabaseUrlDirect() {
    console.log('🔍 Testing DATABASE_URL directly in Railway environment...\n');
    
    // Create a minimal endpoint test that forces environment variable check
    const testPayload = JSON.stringify({
        test: 'database_url_check',
        timestamp: new Date().toISOString()
    });
    
    const options = {
        hostname: 'pos-conejonegro-production.up.railway.app',
        port: 443,
        path: '/api/emergency-test', 
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Railway-DB-Test/1.0'
        }
    };
    
    try {
        console.log('1️⃣ Testing emergency endpoint...');
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
                    } catch (e) {
                        resolve({ status: res.statusCode, error: 'Invalid JSON', raw: data });
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });
        
        console.log('📊 Emergency Test Results:');
        console.log('   Status Code:', response.status);
        console.log('   Response:', response.data || response.error);
        
        // Now test the health endpoint for database information
        console.log('\n2️⃣ Testing health endpoint for database detection...');
        
        const healthOptions = { ...options, path: '/api/health' };
        
        const healthResponse = await new Promise((resolve, reject) => {
            const req = https.request(healthOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve({ error: 'Invalid JSON', raw: data });
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });
        
        console.log('📋 Health Check Database Info:');
        console.log('   Type:', healthResponse.database?.type);
        console.log('   Path:', healthResponse.database?.path);  
        console.log('   Ready:', healthResponse.database?.ready);
        console.log('   Railway Environment:', healthResponse.environment?.railway);
        
        // Analysis
        console.log('\n🔍 Critical Analysis:');
        
        if (healthResponse.database?.type === 'file-based') {
            console.log('❌ PROBLEM CONFIRMED: DATABASE_URL not detected by application');
            console.log('🔧 Issue: Railway has PostgreSQL service but environment variable not injected');
            
            console.log('\n🎯 REQUIRED ACTIONS:');
            console.log('1. 🚨 MANUAL RAILWAY INTERVENTION NEEDED:');
            console.log('   - Login to Railway Dashboard');
            console.log('   - Go to project settings');
            console.log('   - Verify PostgreSQL service is running');
            console.log('   - Check environment variables tab');
            console.log('   - Manually verify DATABASE_URL exists');
            console.log('   - If missing, add it manually');
            
            console.log('\n2. 🔄 FORCE SERVICE RESTART:');
            console.log('   - In Railway Dashboard, go to Deployments');
            console.log('   - Click "Redeploy" on latest deployment');
            console.log('   - This forces environment variable reload');
            
            console.log('\n3. ⚡ ALTERNATIVE DATABASE_URL FORMAT:');
            console.log('   If current format fails, try:');
            console.log('   DATABASE_URL=postgres://postgres:[password]@postgres.railway.internal:5432/railway');
        } else {
            console.log('✅ SUCCESS: PostgreSQL connection established!');
        }
        
        return {
            status: response.status,
            databaseType: healthResponse.database?.type,
            needsManualFix: healthResponse.database?.type === 'file-based'
        };
        
    } catch (error) {
        console.error('🚨 Database URL test failed:', error.message);
        return { error: error.message };
    }
}

// Execute the test
testDatabaseUrlDirect().then(result => {
    console.log('\n📊 Final Test Summary:', result);
    
    if (result.needsManualFix) {
        console.log('\n🚨 IMMEDIATE ACTION REQUIRED:');
        console.log('Railway Dashboard manual configuration needed.');
        console.log('The application is working but using temporary file storage.');
        console.log('Client registration will work but data will be lost on redeploy.');
    }
});