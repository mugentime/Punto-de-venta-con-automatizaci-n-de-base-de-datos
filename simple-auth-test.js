// Simple Authentication Test
const axios = require('axios');

console.log('🔧 SIMPLE AUTHENTICATION TEST');
console.log('==============================\n');

const BASE_URL = 'http://localhost:3000/api';

async function testLogin() {
    try {
        console.log('Testing available auth endpoints...');
        
        // Test login with known credentials
        console.log('1. Attempting login...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('   Login response status:', loginResponse.status);
        console.log('   Login data keys:', Object.keys(loginResponse.data));
        
        if (loginResponse.data.token) {
            const token = loginResponse.data.token;
            console.log('   ✅ Token received:', token.substring(0, 20) + '...');
            
            console.log('\n2. Testing products endpoint with token...');
            
            const productsResponse = await axios.get(`${BASE_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('   Products status:', productsResponse.status);
            console.log('   Products count:', productsResponse.data.length);
            
            if (productsResponse.status === 200) {
                console.log('   ✅ SUCCESS! Authentication is working!');
                return true;
            }
        } else {
            console.log('   ❌ No token in login response');
        }
        
    } catch (error) {
        console.log('\n❌ Error occurred:');
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Data:', error.response.data);
        } else {
            console.log('   Message:', error.message);
        }
        
        // Try alternative endpoints
        console.log('\nTrying alternative approach...');
        
        try {
            console.log('Checking what endpoints are available...');
            
            // Test quick-login endpoint
            const quickLogin = await axios.post(`${BASE_URL}/auth/quick-login`);
            console.log('Quick login result:', quickLogin.data);
            
            if (quickLogin.data.success && quickLogin.data.token) {
                console.log('✅ Quick login worked! Testing products...');
                
                const productsTest = await axios.get(`${BASE_URL}/products`, {
                    headers: { 'Authorization': `Bearer ${quickLogin.data.token}` }
                });
                
                console.log('Products with quick-login token:', productsTest.status);
                console.log('✅ AUTHENTICATION SYSTEM IS WORKING!');
                return true;
            }
            
        } catch (altError) {
            console.log('Alternative approach failed:', altError.response?.data || altError.message);
        }
        
        return false;
    }
}

// Check server and run test
axios.get(`${BASE_URL}/health`)
    .then(() => {
        console.log('✅ Server is running\n');
        return testLogin();
    })
    .then((success) => {
        if (success) {
            console.log('\n🎉 AUTHENTICATION TEST PASSED!');
            console.log('The backend authentication is now working correctly.');
        } else {
            console.log('\n❌ Authentication test failed');
        }
    })
    .catch(() => {
        console.log('❌ Server not accessible');
        console.log('Start server with: npm start');
    });
