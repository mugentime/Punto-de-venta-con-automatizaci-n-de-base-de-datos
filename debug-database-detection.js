// Debug script to check database detection in Railway environment
const https = require('https');

async function debugDatabaseDetection() {
    console.log('🔍 Debugging Database Detection on Railway...\n');
    
    const baseUrl = 'https://pos-conejonegro-production.up.railway.app';
    
    try {
        // 1. Check health endpoint
        console.log('1️⃣ Checking health endpoint...');
        const healthResponse = await fetch(`${baseUrl}/api/health`);
        const healthData = await healthResponse.json();
        
        console.log('📊 Health Check Results:');
        console.log('   Database Type:', healthData.database?.type || 'undefined');
        console.log('   Database Path:', healthData.database?.path || 'undefined');
        console.log('   Environment:', healthData.environment?.node_env || 'undefined');
        console.log('   Railway:', healthData.environment?.railway || 'undefined');
        
        // 2. Test specific debugging endpoint
        console.log('\n2️⃣ Testing environment variables...');
        
        // Create a test request to see server logs
        const testResponse = await fetch(`${baseUrl}/api/emergency-test`).catch(() => null);
        
        console.log('\n🔍 Analysis:');
        if (healthData.database?.type === 'file-based') {
            console.log('❌ PROBLEM: App is using file-based storage');
            console.log('💡 Possible causes:');
            console.log('   - DATABASE_URL not reaching the app process');
            console.log('   - Railway environment variables not loaded');
            console.log('   - App not detecting Railway environment correctly');
        } else {
            console.log('✅ PostgreSQL detected successfully!');
        }
        
    } catch (error) {
        console.error('🚨 Debug failed:', error.message);
    }
}

// Use node-fetch if available, otherwise native fetch
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    fetch = globalThis.fetch;
    if (!fetch) {
        console.error('❌ No fetch implementation available');
        process.exit(1);
    }
}

debugDatabaseDetection();