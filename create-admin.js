// Create Admin User for File-based System
const databaseManager = require('./utils/databaseManager');

console.log('👤 CREATING ADMIN USER');
console.log('======================\n');

async function createAdmin() {
    try {
        console.log('1. Initialize database manager...');
        await databaseManager.initialize();
        console.log('   ✅ Database manager ready');
        console.log('   Using PostgreSQL:', databaseManager.usePostgreSQL);
        
        console.log('\n2. Check if admin already exists...');
        const existingAdmin = await databaseManager.getUserByEmail('admin@conejonegro.com');
        
        if (existingAdmin) {
            console.log('   ✅ Admin user already exists');
            console.log('   Admin details:', {
                id: existingAdmin._id || existingAdmin.id,
                email: existingAdmin.email,
                role: existingAdmin.role,
                isActive: existingAdmin.isActive
            });
            
            // Test password
            console.log('\n3. Test admin login...');
            const user = await databaseManager.validateUserPassword('admin@conejonegro.com', 'admin123');
            if (user) {
                console.log('   ✅ Admin login works');
                
                // Test token generation
                const token = databaseManager.generateToken(user);
                console.log('   ✅ Token generation works');
                
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                console.log('   Token contents:', {
                    userId: decoded.userId,
                    email: decoded.email,
                    role: decoded.role
                });
                
                console.log('\n🎉 Admin user is ready and working!');
            } else {
                console.log('   ❌ Admin login failed - password issue');
            }
            return;
        }
        
        console.log('   Creating new admin user...');
        
        const adminData = {
            name: 'Administrator',
            email: 'admin@conejonegro.com',
            password: 'admin123',
            role: 'admin'
        };
        
        const newAdmin = await databaseManager.createUser(adminData);
        console.log('   ✅ Admin user created successfully');
        console.log('   Admin details:', {
            id: newAdmin._id || newAdmin.id,
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role
        });
        
        console.log('\n3. Test new admin login...');
        const user = await databaseManager.validateUserPassword('admin@conejonegro.com', 'admin123');
        
        if (user) {
            console.log('   ✅ Admin login successful');
            console.log('   User data:', {
                id: user._id || user.id,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            });
            
            // Test token generation
            const token = databaseManager.generateToken(user);
            console.log('   ✅ Token generated successfully');
            
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            console.log('   Token payload:', {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role
            });
            
            console.log('\n🎉 ADMIN USER READY!');
            console.log('📧 Email: admin@conejonegro.com');
            console.log('🔑 Password: admin123');
            console.log('✅ Authentication system should now work');
            
        } else {
            console.log('   ❌ Admin login failed after creation');
        }
        
    } catch (error) {
        console.log('\n❌ Failed to create admin:', error.message);
        console.log('   Stack:', error.stack);
    }
}

createAdmin();
