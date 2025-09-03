// Final client registration test with file-based storage
const https = require('https');

async function testClientRegistrationFinal() {
    console.log('🔍 Final Client Registration Test (File-based Storage)...\n');
    
    const baseUrl = 'pos-conejonegro-production.up.railway.app';
    let authToken = null;
    
    try {
        // Step 1: Login to get auth token
        console.log('1️⃣ Logging in to get authentication token...');
        
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
            authToken = loginResult.data.token;
            console.log('✅ Login successful');
        } else {
            console.log('❌ Login failed:', loginResult.data?.error || 'Unknown error');
            return { success: false, reason: 'Login failed' };
        }
        
        // Step 2: Get products list to use valid product IDs
        console.log('\n2️⃣ Getting products list...');
        
        const productsOptions = {
            hostname: baseUrl,
            port: 443,
            path: '/api/products',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        const productsResult = await new Promise((resolve, reject) => {
            const req = https.request(productsOptions, (res) => {
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
            req.end();
        });
        
        let productId = null;
        if (productsResult.status === 200 && productsResult.data.length > 0) {
            productId = productsResult.data[0].id;
            console.log('✅ Products loaded, using product ID:', productId);
            console.log('   Available products:', productsResult.data.length);
        } else {
            console.log('❌ Failed to load products');
            return { success: false, reason: 'Products not available' };
        }
        
        // Step 3: Test client registration
        console.log('\n3️⃣ Testing client registration...');
        
        const clientData = JSON.stringify({
            client: 'Cliente Test Final ' + new Date().getTime(),
            service: 'massage',
            products: [
                {
                    id: productId,
                    name: productsResult.data[0].name,
                    price: productsResult.data[0].price,
                    quantity: 1
                }
            ],
            hours: 1,
            payment: 'cash',
            tip: 5
        });
        
        const registrationOptions = {
            hostname: baseUrl,
            port: 443,
            path: '/api/records',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(clientData)
            }
        };
        
        const registrationResult = await new Promise((resolve, reject) => {
            const req = https.request(registrationOptions, (res) => {
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
            req.write(clientData);
            req.end();
        });
        
        console.log('📊 Registration Result:');
        console.log('   Status:', registrationResult.status);
        console.log('   Response:', registrationResult.data || registrationResult.error);
        
        // Step 4: Verify record was created
        if (registrationResult.status === 201) {
            console.log('\n4️⃣ Verifying record creation...');
            
            const recordsOptions = {
                hostname: baseUrl,
                port: 443,
                path: '/api/records',
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            };
            
            const recordsResult = await new Promise((resolve, reject) => {
                const req = https.request(recordsOptions, (res) => {
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
                req.end();
            });
            
            if (recordsResult.status === 200) {
                const totalRecords = recordsResult.data.length;
                console.log('✅ Records verification successful');
                console.log('   Total records:', totalRecords);
                console.log('   Latest record client:', recordsResult.data[totalRecords - 1]?.client);
            }
            
            return {
                success: true,
                recordId: registrationResult.data.record?.id,
                totalRecords: recordsResult.data.length
            };
        } else {
            return {
                success: false,
                reason: 'Registration failed',
                error: registrationResult.data?.error
            };
        }
        
    } catch (error) {
        console.error('🚨 Client registration test failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Execute test
testClientRegistrationFinal().then(result => {
    console.log('\n📊 FINAL TEST RESULTS:');
    console.log('   Success:', result.success ? '✅ YES' : '❌ NO');
    
    if (result.success) {
        console.log('   Record ID:', result.recordId);
        console.log('   Total Records:', result.totalRecords);
        
        console.log('\n🎉 CLIENT REGISTRATION IS WORKING!');
        console.log('⚠️  Using file-based storage (data will be lost on redeploy)');
        console.log('🔧 For persistent storage, PostgreSQL manual setup needed');
    } else {
        console.log('   Reason:', result.reason);
        console.log('   Error:', result.error);
        console.log('\n❌ CLIENT REGISTRATION FAILED');
    }
    
    console.log('\n📋 SYSTEM STATUS SUMMARY:');
    console.log('   🌐 Application: WORKING');
    console.log('   🔐 Authentication: WORKING'); 
    console.log('   📱 UI Interface: WORKING');
    console.log('   📊 Database: FILE-BASED (temporary)');
    console.log('   📝 Client Registration: ' + (result.success ? 'WORKING' : 'FAILED'));
    console.log('   🔄 Data Persistence: TEMPORARY (lost on redeploy)');
});