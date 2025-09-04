// Test HTTP Login Endpoint
const axios = require('axios');

console.log('🔐 TESTING HTTP LOGIN ENDPOINT');
console.log('==============================\n');

async function testHttpLogin() {
    try {
        console.log('Testing login with: admin@conejonegro.com / admin123');
        
        const response = await axios.post('http://localhost:3000/api/auth/login', {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('✅ Login successful!');
        console.log('Response:', response.data);
        
    } catch (error) {
        console.log('❌ Login failed');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data);
        
        // Try the reset-admin endpoint to ensure user exists
        console.log('\n🔄 Trying to reset admin user...');
        
        try {
            const resetResponse = await axios.get('http://localhost:3000/api/auth/reset-admin');
            console.log('Reset result:', resetResponse.data);
            
            // Try login again after reset
            console.log('\n🔄 Trying login again after reset...');
            const retryResponse = await axios.post('http://localhost:3000/api/auth/login', {
                email: 'admin@conejonegro.com',
                password: 'admin123'
            });
            
            console.log('✅ Login successful after reset!');
            console.log('Response:', retryResponse.data);
            
        } catch (resetError) {
            console.log('❌ Reset failed:', resetError.response?.data || resetError.message);
        }
    }
}

testHttpLogin();
