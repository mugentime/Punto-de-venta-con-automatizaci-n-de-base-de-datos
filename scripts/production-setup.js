#!/usr/bin/env node
/**
 * Production Setup Script for POS Conejo Negro
 * This script initializes the database and creates admin user in production
 */

const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcryptjs');

// Define data paths
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function ensureDataDirectory() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('📁 Data directory created/verified');
    } catch (error) {
        console.log('⚠️ Data directory already exists or permission issue');
    }
}

async function loadUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.log('📝 No existing users.json found, will create new one');
        return [];
    }
}

async function saveUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('💾 Users data saved');
}

async function createAdminUser() {
    console.log('🔧 Starting production setup...\n');
    
    await ensureDataDirectory();
    
    const users = await loadUsers();
    
    // Check if admin already exists
    const existingAdmin = users.find(user => 
        user.email === 'admin@conejonegro.com' || 
        user.role === 'admin'
    );
    
    if (existingAdmin) {
        console.log('✅ Admin user already exists:', existingAdmin.email);
        console.log('   Name:', existingAdmin.name);
        console.log('   Role:', existingAdmin.role);
        console.log('   Active:', existingAdmin.isActive);
        return existingAdmin;
    }
    
    console.log('👤 Creating admin user...');
    
    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);
    
    // Create admin user
    const adminUser = {
        id: 'admin-' + Date.now(),
        name: 'Administrator',
        email: 'admin@conejonegro.com',
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
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    users.push(adminUser);
    await saveUsers(users);
    
    console.log('✅ Admin user created successfully!');
    console.log('   Email: admin@conejonegro.com');
    console.log('   Password: admin123');
    console.log('   Role: admin');
    
    return adminUser;
}

async function initializeDatabase() {
    console.log('🗃️ Initializing other database files...');
    
    const files = [
        { name: 'products.json', content: [] },
        { name: 'records.json', content: [] },
        { name: 'customers.json', content: [] },
        { name: 'expenses.json', content: [] },
        { name: 'cashcuts.json', content: [] },
        { name: 'backups.json', content: [] }
    ];
    
    for (const file of files) {
        const filePath = path.join(DATA_DIR, file.name);
        try {
            await fs.access(filePath);
            console.log('   ✓', file.name, 'exists');
        } catch (error) {
            await fs.writeFile(filePath, JSON.stringify(file.content, null, 2));
            console.log('   ✓', file.name, 'created');
        }
    }
}

async function verifySetup() {
    console.log('\n🧪 Verifying setup...');
    
    try {
        const users = await loadUsers();
        const admin = users.find(u => u.email === 'admin@conejonegro.com');
        
        if (!admin) {
            throw new Error('Admin user not found after creation');
        }
        
        // Test password verification
        const isPasswordValid = await bcrypt.compare('admin123', admin.password);
        if (!isPasswordValid) {
            throw new Error('Password verification failed');
        }
        
        console.log('✅ Setup verification successful!');
        console.log('   Admin user exists and password is correct');
        console.log('   Total users:', users.length);
        
        return true;
    } catch (error) {
        console.error('❌ Setup verification failed:', error.message);
        return false;
    }
}

async function main() {
    try {
        console.log('🚀 POS Conejo Negro - Production Setup');
        console.log('=====================================\n');
        
        await createAdminUser();
        await initializeDatabase();
        
        const isValid = await verifySetup();
        
        if (isValid) {
            console.log('\n🎉 Production setup completed successfully!');
            console.log('\n📋 Next steps:');
            console.log('1. Visit: https://pos-conejo-negro.onrender.com/online');
            console.log('2. Login with: admin@conejonegro.com / admin123');
            console.log('3. Change admin password immediately!');
        } else {
            console.log('\n❌ Setup completed with errors. Check logs above.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 Setup failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { createAdminUser, initializeDatabase, verifySetup };
