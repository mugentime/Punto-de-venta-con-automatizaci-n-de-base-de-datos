#!/usr/bin/env node

/**
 * EMERGENCY FIX: Create admin user immediately in production
 * This is a temporary solution to get the app working right away
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

async function emergencyCreateAdmin() {
    console.log('🚨 EMERGENCY ADMIN FIX');
    console.log('======================');
    console.log('Creating admin user for immediate production access...\n');
    
    try {
        // Initialize database manager (will use file-based in production without DATABASE_URL)
        const databaseManager = require('./utils/databaseManager');
        await databaseManager.initialize();
        
        const adminEmail = 'admin@conejonegro.com';
        const adminPassword = 'admin123';
        
        console.log(`📧 Admin Email: ${adminEmail}`);
        console.log(`🔑 Admin Password: ${adminPassword}`);
        
        // Check if admin already exists
        try {
            const existingAdmin = await databaseManager.getUserByEmail(adminEmail);
            if (existingAdmin) {
                console.log('✅ Admin user already exists!');
                console.log(`   ID: ${existingAdmin.id || existingAdmin._id}`);
                console.log(`   Role: ${existingAdmin.role}`);
                console.log(`   Active: ${existingAdmin.isActive}`);
                console.log('\n🎯 You can now login at: https://pos-conejo-negro.onrender.com/online');
                process.exit(0);
            }
        } catch (error) {
            console.log('👤 No existing admin found, creating new one...');
        }
        
        // Hash password
        console.log('🔒 Hashing password...');
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        console.log('✅ Password hashed successfully');
        
        // Create admin user
        console.log('👤 Creating admin user...');
        const adminUser = await databaseManager.createUser({
            name: 'Administrator',
            email: adminEmail,
            password: hashedPassword,
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
        
        console.log('✅ ADMIN USER CREATED SUCCESSFULLY!');
        console.log('=================================');
        console.log(`   ID: ${adminUser.id || adminUser._id}`);
        console.log(`   Name: ${adminUser.name}`);
        console.log(`   Email: ${adminUser.email}`);
        console.log(`   Role: ${adminUser.role}`);
        console.log(`   Password: ${adminPassword}`);
        console.log('');
        console.log('🎯 Login URL: https://pos-conejo-negro.onrender.com/online');
        console.log('📧 Use email: admin@conejonegro.com');
        console.log('🔑 Use password: admin123');
        console.log('');
        console.log('⚠️  IMPORTANT: Change this password after first login!');
        
        // Also log some system info
        console.log('\n📊 System Info:');
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Database: ${databaseManager.usePostgreSQL ? 'PostgreSQL' : 'File-based'}`);
        console.log(`   Render: ${!!process.env.RENDER}`);
        console.log(`   Railway: ${!!process.env.RAILWAY_ENVIRONMENT}`);
        
        console.log('\n🎉 Emergency fix complete! App should now accept login credentials.');
        
    } catch (error) {
        console.error('❌ Emergency fix failed:', error);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 Troubleshooting steps:');
        console.log('1. Check if database is properly initialized');
        console.log('2. Verify file write permissions');
        console.log('3. Check server logs for additional errors');
        
        process.exit(1);
    }
}

// Run the emergency fix
emergencyCreateAdmin();
