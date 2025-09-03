const https = require('https');

async function checkDeploymentStatus() {
    console.log('🔍 Checking Railway deployment status...\n');
    
    const endpoints = [
        { name: 'Health Check', path: '/api/health' },
        { name: 'Emergency Test', path: '/api/emergency-test' },
        { name: 'Home Page', path: '/' },
        { name: 'Online App', path: '/online' }
    ];
    
    const baseUrl = 'https://pos-conejonegro-production.up.railway.app';
    
    for (const endpoint of endpoints) {
        try {
            console.log(`📡 Testing ${endpoint.name}: ${baseUrl}${endpoint.path}`);
            
            const response = await fetch(`${baseUrl}${endpoint.path}`, {
                method: 'GET',
                timeout: 10000
            });
            
            const status = response.status;
            const responseText = await response.text();
            
            if (response.ok) {
                console.log(`✅ ${endpoint.name}: Status ${status} - OK`);
                if (endpoint.path === '/api/health') {
                    try {
                        const healthData = JSON.parse(responseText);
                        console.log(`   Database: ${healthData.database?.type || 'unknown'} (${healthData.database?.status || 'unknown'})`);
                        console.log(`   Environment: ${healthData.environment?.node_env || 'unknown'}`);
                    } catch (e) {
                        console.log(`   Response: ${responseText.substring(0, 100)}`);
                    }
                }
            } else {
                console.log(`❌ ${endpoint.name}: Status ${status} - FAILED`);
                console.log(`   Error: ${responseText.substring(0, 200)}`);
            }
            
        } catch (error) {
            console.log(`🚨 ${endpoint.name}: CONNECTION FAILED`);
            console.log(`   Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }
    
    // Test database-dependent endpoints
    console.log('🔐 Testing authenticated endpoints...');
    
    try {
        // Try admin login
        console.log('Attempting admin login...');
        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@conejonegro.com',
                password: 'admin123'
            })
        });
        
        if (loginResponse.ok) {
            console.log('✅ Admin login: SUCCESS');
            const loginData = await loginResponse.json();
            
            // Test products endpoint
            const productsResponse = await fetch(`${baseUrl}/api/products`, {
                headers: { 'Authorization': `Bearer ${loginData.token}` }
            });
            
            if (productsResponse.ok) {
                console.log('✅ Products endpoint: SUCCESS');
            } else {
                console.log(`❌ Products endpoint: Status ${productsResponse.status}`);
            }
            
        } else {
            console.log(`❌ Admin login: Status ${loginResponse.status}`);
            const errorText = await loginResponse.text();
            console.log(`   Error: ${errorText.substring(0, 200)}`);
        }
        
    } catch (error) {
        console.log(`🚨 Authentication test failed: ${error.message}`);
    }
}

// Use node-fetch if available, otherwise use native fetch
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    // Use native fetch (Node 18+)
    fetch = globalThis.fetch;
    if (!fetch) {
        console.error('❌ No fetch implementation available. Install node-fetch or use Node 18+');
        process.exit(1);
    }
}

checkDeploymentStatus()
    .then(() => {
        console.log('='.repeat(60));
        console.log('🔍 Deployment check completed');
        console.log('='.repeat(60));
    })
    .catch(error => {
        console.error('🚨 Deployment check failed:', error);
        process.exit(1);
    });