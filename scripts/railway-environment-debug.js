// Advanced Railway environment debugging script
const https = require('https');

async function debugRailwayEnvironment() {
    console.log('🔍 Advanced Railway Environment Debugging...\n');
    
    const baseUrl = 'https://pos-conejonegro-production.up.railway.app';
    
    try {
        // Create a comprehensive debugging endpoint test
        console.log('1️⃣ Testing comprehensive environment debugging...');
        
        const debugPayload = JSON.stringify({
            action: 'debug_environment'
        });
        
        const options = {
            hostname: 'pos-conejonegro-production.up.railway.app',
            port: 443,
            path: '/api/emergency-test',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        // Test emergency endpoint
        const emergencyResponse = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
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
        
        console.log('🚨 Emergency endpoint response:', emergencyResponse);
        
        // Test health endpoint for detailed analysis
        console.log('\n2️⃣ Detailed health check analysis...');
        
        const healthOptions = {
            ...options,
            path: '/api/health'
        };
        
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
        
        console.log('📊 Health check results:');
        console.log('   Database Type:', healthResponse.database?.type);
        console.log('   Database Path:', healthResponse.database?.path);
        console.log('   Database Ready:', healthResponse.database?.ready);
        console.log('   Environment Railway:', healthResponse.environment?.railway);
        console.log('   Node Environment:', healthResponse.environment?.node_env);
        
        // Analysis and recommendations
        console.log('\n🔍 Analysis:');
        
        if (healthResponse.database?.type === 'file-based') {
            console.log('❌ CONFIRMED ISSUE: Application using file-based storage');
            console.log('💡 This means DATABASE_URL is not reaching the Node.js process');
            console.log('\n🎯 Next Steps Required:');
            console.log('   1. Check Railway dashboard for PostgreSQL service status');
            console.log('   2. Verify DATABASE_URL variable exists in Railway environment');
            console.log('   3. Check if Railway is properly injecting environment variables');
            console.log('   4. Consider manual Railway service restart');
        } else if (healthResponse.database?.path === 'postgresql') {
            console.log('✅ SUCCESS: PostgreSQL connection established!');
            console.log('🎉 Database migration successful');
        } else {
            console.log('⚠️ UNCLEAR: Unexpected database configuration');
            console.log('   Database type:', healthResponse.database?.type);
            console.log('   Database path:', healthResponse.database?.path);
        }
        
        // Check if we can create a test record
        console.log('\n3️⃣ Testing basic API functionality...');
        
        const testOptions = {
            ...options,
            path: '/api/emergency-test',
            method: 'GET'
        };
        
        const apiTest = await new Promise((resolve, reject) => {
            const req = https.request(testOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, error: 'Invalid JSON', raw: data });
                    }
                });
            });
            req.on('error', reject);
            req.end();
        });
        
        console.log('🔗 API Test Result:', apiTest.status === 200 ? '✅ Working' : '❌ Failed');
        console.log('📄 Response:', apiTest.data || apiTest.error);
        
        return {
            databaseType: healthResponse.database?.type,
            isPostgresql: healthResponse.database?.path === 'postgresql',
            apiWorking: apiTest.status === 200,
            railwayEnvironment: healthResponse.environment?.railway
        };
        
    } catch (error) {
        console.error('🚨 Environment debugging failed:', error.message);
        return { error: error.message };
    }
}

// Self-executing async function
(async () => {
    const result = await debugRailwayEnvironment();
    console.log('\n📊 Final Debug Results:', result);
    
    if (result.databaseType === 'file-based') {
        console.log('\n🚨 CRITICAL ACTION REQUIRED:');
        console.log('The PostgreSQL service exists but DATABASE_URL is not reaching the app.');
        console.log('Manual intervention needed in Railway Dashboard.');
    }
})();