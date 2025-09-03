// Create test user for client registration testing
const https = require('https');

async function createTestUser() {
    console.log('🔑 Creating test user for authentication...\n');
    
    const baseUrl = 'pos-conejonegro-production.up.railway.app';
    
    try {
        // Try to register a new user
        console.log('1️⃣ Attempting user registration...');
        
        const userData = JSON.stringify({
            email: 'test@conejonegro.com',
            password: 'test123456',
            name: 'Test User',
            role: 'user'
        });
        
        const registerOptions = {
            hostname: baseUrl,
            port: 443,
            path: '/api/auth/register',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(userData)
            }
        };
        
        const registerResult = await new Promise((resolve, reject) => {
            const req = https.request(registerOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, data: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode, error: 'Invalid JSON', raw: data });
                    }
                });
            });
            req.on('error', reject);
            req.write(userData);
            req.end();
        });
        
        console.log('📊 Registration Result:', registerResult.status);
        
        if (registerResult.status === 201 || registerResult.status === 200) {
            console.log('✅ User registration successful');
            
            // Now try to login with the new user
            console.log('\n2️⃣ Testing login with new user...');
            
            const loginData = JSON.stringify({
                email: 'test@conejonegro.com',
                password: 'test123456'
            });
            
            const loginOptions = {
                hostname: baseUrl,
                port: 443,
                path: '/api/auth/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(loginData)
                }
            };
            
            const loginResult = await new Promise((resolve, reject) => {
                const req = https.request(loginOptions, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            resolve({ status: res.statusCode, error: 'Invalid JSON', raw: data });
                        }
                    });
                });
                req.on('error', reject);
                req.write(loginData);
                req.end();
            });
            
            console.log('📊 Login Result:', loginResult.status);
            
            if (loginResult.status === 200 && loginResult.data.token) {
                console.log('✅ Login successful with test user');
                console.log('🎯 Token obtained for testing');
                
                return {
                    success: true,
                    email: 'test@conejonegro.com',
                    password: 'test123456',
                    token: loginResult.data.token
                };
            } else {
                console.log('❌ Login failed:', loginResult.data?.error || 'Unknown error');
                return { success: false, reason: 'Login failed after registration' };
            }
            
        } else if (registerResult.status === 400 && registerResult.data?.error?.includes('already exists')) {
            console.log('ℹ️  User already exists, trying to login...');
            
            // Try to login with existing credentials
            const loginData = JSON.stringify({
                email: 'test@conejonegro.com',
                password: 'test123456'
            });
            
            const loginOptions = {
                hostname: baseUrl,
                port: 443,
                path: '/api/auth/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(loginData)
                }
            };
            
            const loginResult = await new Promise((resolve, reject) => {
                const req = https.request(loginOptions, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, data: JSON.parse(data) });
                        } catch (e) {
                            resolve({ status: res.statusCode, error: 'Invalid JSON', raw: data });
                        }
                    });
                });
                req.on('error', reject);
                req.write(loginData);
                req.end();
            });
            
            if (loginResult.status === 200 && loginResult.data.token) {
                console.log('✅ Login successful with existing user');
                return {
                    success: true,
                    email: 'test@conejonegro.com',
                    password: 'test123456',
                    token: loginResult.data.token
                };
            } else {
                return { success: false, reason: 'Existing user login failed' };
            }
        } else {
            console.log('❌ Registration failed:', registerResult.data?.error || 'Unknown error');
            return { success: false, reason: 'Registration failed', error: registerResult.data?.error };
        }
        
    } catch (error) {
        console.error('🚨 User creation failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute user creation
createTestUser().then(result => {
    console.log('\n📊 USER CREATION RESULTS:');
    
    if (result.success) {
        console.log('✅ Test user ready for client registration testing');
        console.log('   Email:', result.email);
        console.log('   Password:', result.password);
        console.log('   Token available:', !!result.token);
        
        console.log('\n🎯 Now you can run client registration test with:');
        console.log('   node scripts/test-client-registration-final.js');
    } else {
        console.log('❌ Test user creation failed');
        console.log('   Reason:', result.reason);
        console.log('   Error:', result.error);
    }
});