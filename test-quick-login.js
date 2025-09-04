// Test Quick Login Endpoint
const axios = require('axios');
const jwt = require('jsonwebtoken');

console.log('🚀 TESTING QUICK LOGIN vs REGULAR LOGIN');
console.log('==========================================\n');

const BASE_URL = 'http://localhost:3000/api';

async function compareLogins() {
    try {
        console.log('1. Testing regular login endpoint...');
        const regularLogin = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('   Regular login status:', regularLogin.status);
        console.log('   Regular login data keys:', Object.keys(regularLogin.data));
        console.log('   Regular login user:', regularLogin.data.user);
        
        if (regularLogin.data.token) {
            const regularDecoded = jwt.decode(regularLogin.data.token);
            console.log('   Regular token payload:', {
                userId: regularDecoded.userId,
                email: regularDecoded.email,
                role: regularDecoded.role
            });
        }
        
        console.log('\n2. Testing quick-login endpoint...');
        const quickLogin = await axios.post(`${BASE_URL}/auth/quick-login`);
        
        console.log('   Quick login status:', quickLogin.status);
        console.log('   Quick login success:', quickLogin.data.success);
        console.log('   Quick login user:', quickLogin.data.user);
        
        if (quickLogin.data.token) {
            const quickDecoded = jwt.decode(quickLogin.data.token);
            console.log('   Quick token payload:', {
                userId: quickDecoded.userId,
                email: quickDecoded.email,
                role: quickDecoded.role
            });
            
            console.log('\n3. Testing products endpoint with quick-login token...');
            
            try {
                const productsResponse = await axios.get(`${BASE_URL}/products`, {
                    headers: { 'Authorization': `Bearer ${quickLogin.data.token}` }
                });
                
                console.log('   ✅ Products endpoint works with quick-login token!');
                console.log('   Products count:', productsResponse.data.length);
                
                console.log('\n🔧 COMPARISON:');
                console.log('   Regular login user ID:', regularLogin.data.user?._id || regularLogin.data.user?.id || 'UNDEFINED');
                console.log('   Quick login user ID:', quickLogin.data.user?._id || quickLogin.data.user?.id || 'UNDEFINED');
                console.log('   Regular token userId:', regularDecoded?.userId || 'UNDEFINED');
                console.log('   Quick token userId:', quickDecoded?.userId || 'UNDEFINED');
                
                if (quickDecoded.userId && !regularDecoded.userId) {
                    console.log('\n🎯 ISSUE FOUND:');
                    console.log('   Quick-login generates proper tokens but regular login does not');
                    console.log('   The issue is in the regular login endpoint, not the token system');
                }
                
            } catch (error) {
                console.log('   ❌ Products failed with quick-login token:', error.response?.data);
            }
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Data:', error.response.data);
        }
    }
}

// Run comparison
axios.get(`${BASE_URL}/health`)
    .then(() => compareLogins())
    .catch(() => console.log('❌ Server not accessible'));
