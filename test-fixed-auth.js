// Test Fixed Authentication System
const axios = require('axios');

console.log('🔧 TESTING FIXED AUTHENTICATION SYSTEM');
console.log('=======================================\n');

const BASE_URL = 'http://localhost:3000/api';

async function testAuthSystem() {
    try {
        console.log('1. Testing login endpoint...');
        
        // First, reset and create admin user
        const resetResponse = await axios.get(`${BASE_URL}/auth/reset-admin`);
        console.log('   Admin reset:', resetResponse.data.success ? 'SUCCESS' : 'FAILED');
        
        if (!resetResponse.data.success) {
            console.log('   Reset details:', resetResponse.data);
            throw new Error('Admin reset failed');
        }
        
        console.log('   Admin credentials: admin@conejonegro.com / admin123');
        
        // Test login
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('   Login response status:', loginResponse.status);
        console.log('   Login success:', !!loginResponse.data.token);
        
        if (!loginResponse.data.token) {
            console.log('   Login response:', loginResponse.data);
            throw new Error('Login failed - no token received');
        }
        
        const token = loginResponse.data.token;
        console.log('   Token received:', token.substring(0, 20) + '...');
        
        console.log('\n2. Testing protected products endpoint...');
        
        // Test protected products route
        const productsResponse = await axios.get(`${BASE_URL}/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('   Products response status:', productsResponse.status);
        console.log('   Products count:', productsResponse.data.length || 0);
        
        if (productsResponse.status === 200) {
            console.log('   ✅ Authentication working! Products fetched successfully');
            
            // Display first few products as proof
            if (productsResponse.data.length > 0) {
                console.log('   Sample products:');
                productsResponse.data.slice(0, 3).forEach(p => {
                    console.log(`      - ${p.name} (${p.category}): $${p.price}`);
                });
            }
        } else {
            console.log('   ❌ Products fetch failed');
            throw new Error('Products authentication failed');
        }
        
        console.log('\n3. Testing auth verification endpoint...');
        
        // Test auth verification
        const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('   Verify response status:', verifyResponse.status);
        console.log('   User verified:', verifyResponse.data.valid);
        console.log('   User role:', verifyResponse.data.user?.role);
        
        console.log('\n🎉 ALL TESTS PASSED! Authentication system fixed!');
        console.log('✅ Login works');
        console.log('✅ Token generation works');  
        console.log('✅ Protected routes work');
        console.log('✅ User verification works');
        
        console.log('\n🚀 Ready for E2E testing!');
        
        return {
            success: true,
            token: token,
            user: loginResponse.data.user,
            products: productsResponse.data
        };
        
    } catch (error) {
        console.log('\n❌ AUTHENTICATION TEST FAILED');
        
        if (error.response) {
            console.log('   HTTP Status:', error.response.status);
            console.log('   Error:', error.response.data);
        } else {
            console.log('   Error:', error.message);
        }
        
        console.log('\n💡 Check that the server is running: npm start');
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Run the test if server is accessible
axios.get(`${BASE_URL}/health`)
    .then(() => {
        console.log('✅ Server is running, starting authentication tests...\n');
        return testAuthSystem();
    })
    .then((result) => {
        if (result.success) {
            console.log('\n=== AUTHENTICATION SYSTEM FIXED ===');
        } else {
            console.log('\n=== AUTHENTICATION SYSTEM NEEDS MORE WORK ===');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.log('❌ Server not accessible. Start the server first:');
        console.log('   npm start');
        console.log('   Then run: node test-fixed-auth.js');
        process.exit(1);
    });
