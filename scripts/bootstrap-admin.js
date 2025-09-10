#!/usr/bin/env node

/**
 * Bootstrap Admin User Script
 * Creates or ensures admin user exists in production database
 */

const bcrypt = require('bcryptjs');

async function bootstrapAdmin() {
    console.log('🔧 TaskMaster: Bootstrap Admin User');
    console.log('=====================================');
    
    // Load environment
    require('dotenv').config();
    
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@conejonegro.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (!process.env.DATABASE_URL) {
        console.log('⚠️  No DATABASE_URL found - using file-based database');
        console.log('   For production, set DATABASE_URL to PostgreSQL connection string');
        
        // Use file-based database
        const databaseManager = require('../utils/databaseManager');
        
        try {
            await databaseManager.initialize();
            console.log('✅ File database initialized');
            
            // Check if admin exists
            const existingAdmin = await databaseManager.getUserByEmail(adminEmail);
            
            if (existingAdmin) {
                console.log(`✅ Admin user already exists: ${existingAdmin.email}`);
                console.log(`   Role: ${existingAdmin.role}`);
                console.log(`   Name: ${existingAdmin.name}`);
                return true;
            }
            
            // Create admin user
            console.log(`👤 Creating admin user: ${adminEmail}`);
            
            const hashedPassword = await bcrypt.hash(adminPassword, 12);
            
            const adminUser = await databaseManager.createUser({
                name: 'Administrator',
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                permissions: {
                    canManageInventory: true,
                    canRegisterClients: true,
                    canViewReports: true,
                    canManageUsers: true,
                    canExportData: true,
                    canDeleteRecords: true
                }
            });
            
            console.log('✅ Admin user created successfully!');
            console.log(`   ID: ${adminUser.id || adminUser._id}`);
            console.log(`   Email: ${adminUser.email}`);
            console.log(`   Role: ${adminUser.role}`);
            console.log(`   Password: ${adminPassword}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ File database bootstrap failed:', error.message);
            return false;
        }
    }
    
    // Use PostgreSQL database
    console.log('🐘 Using PostgreSQL database');
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);
    
    const database = require('../utils/database');
    
    try {
        await database.init();
        console.log('✅ PostgreSQL database initialized');
        
        // Check if admin exists
        const existingAdmin = await database.getUserByUsername(adminEmail);
        
        if (existingAdmin) {
            console.log(`✅ Admin user already exists: ${existingAdmin.username}`);
            console.log(`   Role: ${existingAdmin.role}`);
            console.log(`   ID: ${existingAdmin._id}`);
            return true;
        }
        
        // Create admin user
        console.log(`👤 Creating admin user: ${adminEmail}`);
        
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        
        const adminUser = await database.createUser({
            username: adminEmail,
            password: hashedPassword,
            role: 'admin',
            permissions: {
                canManageInventory: true,
                canRegisterClients: true,
                canViewReports: true,
                canManageUsers: true,
                canExportData: true,
                canDeleteRecords: true
            }
        });
        
        console.log('✅ Admin user created successfully!');
        console.log(`   ID: ${adminUser._id}`);
        console.log(`   Username: ${adminUser.username}`);
        console.log(`   Role: ${adminUser.role}`);
        console.log(`   Password: ${adminPassword}`);
        
        await database.close();
        return true;
        
    } catch (error) {
        console.error('❌ PostgreSQL bootstrap failed:', error.message);
        await database.close();
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    bootstrapAdmin()
        .then(success => {
            if (success) {
                console.log('\n🎉 Admin bootstrap completed successfully!');
                console.log('📋 Next steps:');
                console.log('   1. Test login on the website');
                console.log('   2. Change admin password after first login');
                console.log('   3. Create additional users as needed');
                process.exit(0);
            } else {
                console.log('\n❌ Admin bootstrap failed');
                console.log('   Check the error messages above');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Bootstrap script error:', error);
            process.exit(1);
        });
}

module.exports = bootstrapAdmin;
