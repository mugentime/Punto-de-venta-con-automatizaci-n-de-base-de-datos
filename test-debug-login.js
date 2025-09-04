// Test Debug Login Endpoint
const axios = require('axios');

console.log('🔍 TESTING DEBUG LOGIN ENDPOINT');
console.log('===============================\n');

const BASE_URL = 'http://localhost:3000/api';

async function testDebugLogin() {
    try {
        console.log('Testing debug-login endpoint...');
        
        const response = await axios.post(`${BASE_URL}/auth/debug-login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n✅ Debug login successful');
            console.log('Key findings:');
            console.log('  - Original user ID:', response.data.debug.originalUserId);
            console.log('  - Token user ID:', response.data.debug.tokenUserId);
            console.log('  - Original email:', response.data.debug.originalEmail);
            console.log('  - Token email:', response.data.debug.tokenEmail);
            
            if (response.data.debug.originalUserId && !response.data.debug.tokenUserId) {
                console.log('\n🎯 ISSUE CONFIRMED:');
                console.log('  User object has ID but token generation fails to use it');
            }
            
            if (response.data.debug.tokenUserId) {
                console.log('\n🎉 TOKEN GENERATION WORKING CORRECTLY');
            }
        }
        
    } catch (error) {
        console.log('❌ Debug test failed:', error.response?.data || error.message);
    }
}

testDebugLogin();
