// Debug User Token ID Mismatch
const axios = require('axios');
const jwt = require('jsonwebtoken');

console.log('🔍 DEBUGGING USER TOKEN ID MISMATCH');
console.log('====================================\n');

const BASE_URL = 'http://localhost:3000/api';

async function debugTokenIdMismatch() {
    try {
        console.log('1. Testing login to get token...');
        
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        if (!loginResponse.data.token) {
            console.log('❌ Login failed:', loginResponse.data);
            return;
        }
        
        const token = loginResponse.data.token;
        console.log('   ✅ Login successful');
        console.log('   Token preview:', token.substring(0, 30) + '...');
        console.log('   User from login:', {
            id: loginResponse.data.user?.id || loginResponse.data.user?._id,
            email: loginResponse.data.user?.email,
            role: loginResponse.data.user?.role
        });
        
        console.log('\n2. Decoding token manually...');
        
        // Decode token to see what's inside
        const decoded = jwt.decode(token);
        console.log('   Token payload:', {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
            iat: decoded.iat,
            exp: decoded.exp
        });
        
        console.log('\n3. Testing token debug endpoint...');
        
        // Try the debug-token endpoint to see what happens during validation
        try {
            const debugResponse = await axios.get(`${BASE_URL}/auth/debug-token`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('   Debug response:', debugResponse.data);
            
        } catch (debugError) {
            console.log('   Debug endpoint error:', debugError.response?.data || debugError.message);
        }
        
        console.log('\n4. Testing products endpoint...');
        
        try {
            const productsResponse = await axios.get(`${BASE_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            console.log('   ✅ Products endpoint works!');
            console.log('   Products count:', productsResponse.data.length);
            
        } catch (productsError) {
            console.log('   ❌ Products endpoint error:', productsError.response?.data);
            
            // This is where we expect the "User not found" error
            if (productsError.response?.data?.error?.includes('User not found')) {
                console.log('\n🎯 ISSUE CONFIRMED:');
                console.log('   - Token contains userId:', decoded.userId);
                console.log('   - But middleware cannot find user with that ID');
                console.log('   - This suggests ID format mismatch between systems');
            }
        }
        
        console.log('\n5. DIAGNOSIS:');
        console.log('   - Login works (token generation successful)');
        console.log('   - Token contains userId:', decoded.userId);
        console.log('   - Token validation fails during middleware getUserById lookup');
        console.log('   - This indicates file-based vs PostgreSQL ID format incompatibility');
        
        console.log('\n🔧 SOLUTION:');
        console.log('   Need to ensure consistent user ID format between:');
        console.log('   1. Token generation (in auth routes)');
        console.log('   2. User lookup (in auth middleware)');
        console.log('   3. User storage (in database)');
        
    } catch (error) {
        console.log('❌ Debug failed:', error.message);
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Data:', error.response.data);
        }
    }
}

// Run debug
axios.get(`${BASE_URL}/health`)
    .then(() => {
        console.log('✅ Server accessible, starting debug...\n');
        return debugTokenIdMismatch();
    })
    .catch(() => {
        console.log('❌ Server not accessible');
        console.log('Start server with: npm start');
    });
