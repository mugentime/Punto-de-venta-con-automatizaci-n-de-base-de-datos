/**
 * Fix Admin User Creation for Production
 * Ensures admin@conejonegro.com can login with admin123
 */

const bcrypt = require('bcryptjs');
const databaseManager = require('./utils/databaseManager');

async function fixAdminUser() {
    console.log('🔧 FIXING ADMIN USER FOR PRODUCTION...');
    
    try {
        // Initialize database
        await databaseManager.initialize();
        console.log('✅ Database initialized');
        
        // Check if admin user exists
        const existingAdmin = await databaseManager.getUserByEmail('admin@conejonegro.com');
        
        if (existingAdmin) {
            console.log('🔍 Admin user exists, updating password hash...');
            
            // Hash the password properly with bcrypt
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            
            // Update the user with proper hashed password
            await databaseManager.updateUser(existingAdmin.id, {
                password: hashedPassword,
                isActive: true,
                role: 'admin'
            });
            
            console.log('✅ Admin user password updated with proper hash');
        } else {
            console.log('🆕 Creating new admin user...');
            
            // Hash the password properly
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash('admin123', saltRounds);
            
            // Create admin user with properly hashed password
            const adminUser = await databaseManager.createUser({
                name: 'Administrator',
                email: 'admin@conejonegro.com',
                password: hashedPassword, // Pre-hashed password
                role: 'admin',
                isActive: true,
                permissions: {
                    canManageInventory: true,
                    canRegisterClients: true,
                    canViewReports: true,
                    canManageUsers: true,
                    canExportData: true,
                    canDeleteRecords: true
                }
            });
            
            console.log('✅ New admin user created with proper hash');
        }
        
        // Verify the user can be found and password works
        const verifyUser = await databaseManager.getUserByEmail('admin@conejonegro.com');
        if (verifyUser) {
            const passwordMatch = await bcrypt.compare('admin123', verifyUser.password);
            console.log('🔑 Password verification:', passwordMatch ? '✅ SUCCESS' : '❌ FAILED');
            
            if (passwordMatch) {
                console.log('🎉 ADMIN USER FIX COMPLETED SUCCESSFULLY!');
                console.log('📧 Email: admin@conejonegro.com');
                console.log('🔐 Password: admin123');
                console.log('🌐 Ready for production login');
            } else {
                console.error('❌ Password verification failed - something is wrong');
            }
        } else {
            console.error('❌ Could not verify admin user creation');
        }
        
    } catch (error) {
        console.error('❌ ADMIN USER FIX FAILED:', error);
        throw error;
    }
}

// Run the fix if called directly
if (require.main === module) {
    fixAdminUser().then(() => {
        console.log('✅ Script completed');
        process.exit(0);
    }).catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });
}

module.exports = { fixAdminUser };
