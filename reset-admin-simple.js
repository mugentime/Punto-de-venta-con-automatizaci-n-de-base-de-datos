// Simple Admin Reset
const databaseManager = require('./utils/databaseManager');

console.log('🔄 SIMPLE ADMIN RESET');
console.log('====================\n');

async function resetAdmin() {
    try {
        await databaseManager.initialize();
        console.log('✅ Database initialized');
        
        // Create fresh admin with very simple credentials
        console.log('\n👤 Creating simple admin user...');
        
        const adminData = {
            name: 'Admin',
            email: 'admin@conejonegro.com',
            password: 'admin123',
            role: 'admin'
        };
        
        try {
            const admin = await databaseManager.createUser(adminData);
            console.log('✅ New admin created:', admin.name, admin.email);
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('ℹ️ Admin already exists, testing login...');
            } else {
                throw error;
            }
        }
        
        // Test login
        console.log('\n🔐 Testing login...');
        const user = await databaseManager.validateUserPassword('admin@conejonegro.com', 'admin123');
        
        if (user) {
            console.log('✅ Login test successful!');
            console.log('   User ID:', user._id);
            console.log('   Email:', user.email);
            console.log('   Role:', user.role);
            
            const token = databaseManager.generateToken(user);
            console.log('✅ Token generated successfully');
            
            console.log('\n🎯 CONFIRMED WORKING CREDENTIALS:');
            console.log('   Email: admin@conejonegro.com');
            console.log('   Password: admin123');
            
        } else {
            console.log('❌ Login test failed');
        }
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

resetAdmin();
