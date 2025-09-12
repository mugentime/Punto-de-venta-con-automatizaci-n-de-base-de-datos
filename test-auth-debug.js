/**
 * Debug script para problemas de autenticación
 */

const fetch = require('node-fetch');

async function testAuth() {
    console.log('🔍 Debugging Authentication System...\n');
    
    const SERVER_URL = 'http://localhost:3000';
    
    // Test 1: Health check
    console.log('1. Testing server health...');
    try {
        const health = await fetch(`${SERVER_URL}/api/health`);
        const healthData = await health.json();
        console.log('✅ Server health:', healthData.status);
        console.log('   Database ready:', healthData.database?.ready);
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
        return;
    }
    
    // Test 2: Login endpoint
    console.log('\n2. Testing login endpoint...');
    try {
        const loginResponse = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@conejonegro.com',
                password: 'admin123'
            })
        });
        
        console.log('   Status:', loginResponse.status, loginResponse.statusText);
        console.log('   Headers:', Object.fromEntries(loginResponse.headers.entries()));
        
        const loginData = await loginResponse.json();
        console.log('   Response data:', JSON.stringify(loginData, null, 2));
        
        if (loginResponse.ok && loginData.token) {
            console.log('✅ Login successful! Token received.');
            
            // Test 3: Validate token
            console.log('\n3. Testing token validation...');
            const validateResponse = await fetch(`${SERVER_URL}/api/auth/validate`, {
                headers: {
                    'Authorization': `Bearer ${loginData.token}`
                }
            });
            
            if (validateResponse.ok) {
                console.log('✅ Token validation successful');
            } else {
                console.log('❌ Token validation failed:', validateResponse.status);
            }
            
        } else {
            console.log('❌ Login failed:', loginData.error || 'Unknown error');
        }
        
    } catch (error) {
        console.log('❌ Login test failed:', error.message);
    }
    
    // Test 4: Check if users exist
    console.log('\n4. Checking user database...');
    try {
        // This is a basic check - we'll try to see if the auth route exists
        const authCheck = await fetch(`${SERVER_URL}/api/auth/check`, {
            method: 'GET'
        });
        
        console.log('   Auth routes status:', authCheck.status);
    } catch (error) {
        console.log('   Auth routes check failed:', error.message);
    }
    
    console.log('\n🎯 Diagnosis complete!');
    console.log('\nRecommended actions:');
    console.log('1. Check browser console for JavaScript errors');
    console.log('2. Try clearing browser cache and localStorage');
    console.log('3. Ensure no browser extensions are blocking requests');
    console.log('4. Check network tab in browser dev tools');
}

testAuth().catch(error => {
    console.error('Test execution failed:', error);
});
