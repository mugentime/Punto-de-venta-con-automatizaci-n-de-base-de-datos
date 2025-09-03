const fetch = require('node-fetch');

async function testClientRegistration() {
    const API_BASE = 'https://pos-conejonegro-production.up.railway.app/api';
    
    console.log('🧪 Testing Client Registration Process...\n');
    
    try {
        // 1. Test admin login
        console.log('1️⃣ Testing admin login...');
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@conejonegro.com',
                password: 'admin123'
            })
        });
        
        if (!loginResponse.ok) {
            const error = await loginResponse.text();
            console.error('❌ Login failed:', error);
            return false;
        }
        
        const loginData = await loginResponse.json();
        console.log('✅ Login successful');
        
        const authToken = loginData.token;
        
        // 2. Test client registration
        console.log('\n2️⃣ Testing client registration...');
        const clientData = {
            client: 'Test Client ' + Date.now(),
            service: 'cafeteria', 
            products: [{
                productId: '507f1f77bcf86cd799439011', // Example product ID
                quantity: 1
            }],
            payment: 'efectivo',
            notes: 'Test registration from automated script'
        };
        
        console.log('Sending client data:', JSON.stringify(clientData, null, 2));
        
        const registrationResponse = await fetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(clientData)
        });
        
        const responseText = await registrationResponse.text();
        console.log('Registration response status:', registrationResponse.status);
        console.log('Registration response:', responseText);
        
        if (registrationResponse.ok) {
            const result = JSON.parse(responseText);
            console.log('✅ Client registration successful!');
            console.log('📝 Record ID:', result.record?._id);
            return true;
        } else {
            console.log('❌ Client registration failed');
            return false;
        }
        
    } catch (error) {
        console.error('🚨 Test failed with error:', error.message);
        return false;
    }
}

testClientRegistration()
    .then(success => {
        console.log('\n' + '='.repeat(50));
        if (success) {
            console.log('🎉 CLIENT REGISTRATION IS WORKING!');
            console.log('✅ PostgreSQL connection successful');
            console.log('✅ Authentication working');
            console.log('✅ Record creation functional');
        } else {
            console.log('❌ CLIENT REGISTRATION STILL HAS ISSUES');
            console.log('Check the error messages above for details');
        }
        console.log('='.repeat(50));
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Fatal test error:', error);
        process.exit(1);
    });