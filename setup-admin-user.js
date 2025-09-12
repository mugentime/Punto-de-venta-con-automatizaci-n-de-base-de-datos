/**
 * Script para crear usuario admin en producción
 */

const fetch = require('node-fetch');

async function setupAdminUser() {
    const PRODUCTION_URL = 'https://pos-conejo-negro.onrender.com';
    
    console.log('🔧 Setting up admin user in production...\n');
    
    // Test 1: Check if setup endpoint exists
    console.log('1. Checking setup endpoint...');
    try {
        const setupResponse = await fetch(`${PRODUCTION_URL}/api/setup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('   Setup endpoint status:', setupResponse.status);
        
        if (setupResponse.ok) {
            const setupData = await setupResponse.json();
            console.log('✅ Setup completed:', setupData.message);
            console.log('   Setup result:', JSON.stringify(setupData, null, 2));
        } else {
            const errorData = await setupResponse.text();
            console.log('❌ Setup failed:', errorData);
        }
        
    } catch (error) {
        console.log('❌ Setup endpoint failed:', error.message);
    }
    
    // Test 2: Try to create user directly (if there's a user creation endpoint)
    console.log('\n2. Attempting direct user creation...');
    try {
        const createUserResponse = await fetch(`${PRODUCTION_URL}/api/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Administrator',
                email: 'admin@conejonegro.com',
                password: 'admin123',
                role: 'admin',
                permissions: {
                    canManageInventory: true,
                    canRegisterClients: true,
                    canViewReports: true,
                    canManageUsers: true,
                    canExportData: true,
                    canDeleteRecords: true
                }
            })
        });
        
        console.log('   User creation status:', createUserResponse.status);
        
        if (createUserResponse.ok) {
            const userData = await createUserResponse.json();
            console.log('✅ User created successfully:', userData.message);
        } else {
            const errorData = await createUserResponse.text();
            console.log('⚠️ User creation response:', errorData);
        }
        
    } catch (error) {
        console.log('⚠️ User creation failed:', error.message);
    }
    
    // Test 3: Test login with the credentials
    console.log('\n3. Testing login after setup...');
    try {
        const loginResponse = await fetch(`${PRODUCTION_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@conejonegro.com',
                password: 'admin123'
            })
        });
        
        console.log('   Login test status:', loginResponse.status);
        
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            console.log('✅ LOGIN NOW WORKS! Admin user is ready');
            console.log('   User details:', loginData.user.name, '-', loginData.user.email);
        } else {
            const errorData = await loginResponse.json();
            console.log('❌ Login still fails:', errorData.error);
            
            // Additional debugging
            console.log('\n🔍 Additional debugging needed...');
            console.log('   - Check database connection in production');
            console.log('   - Verify file-based database is working');
            console.log('   - Check if data directory exists');
        }
        
    } catch (error) {
        console.log('❌ Login test failed:', error.message);
    }
    
    console.log('\n🎯 Admin user setup complete!');
    console.log('\nIf login still fails, check:');
    console.log('1. Database initialization in production');
    console.log('2. File permissions on Render');
    console.log('3. Environment variables');
}

setupAdminUser().catch(console.error);
