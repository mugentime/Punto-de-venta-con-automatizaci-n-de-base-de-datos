const database = require('./utils/database');

async function initializeWithSampleData() {
    try {
        console.log('🔄 Initializing database...');
        await database.init();

        // Check if products already exist
        const existingProducts = await database.getProducts();
        if (existingProducts.length > 0) {
            console.log('✅ Products already exist, skipping initialization');
            return;
        }

        // NO crear productos por defecto - el usuario los agregará manualmente
        console.log('📦 Skipping default products creation - user will add their own');

        // Create default admin user
        const existingUsers = await database.getUsers();
        if (existingUsers.length === 0) {
            console.log('👤 Creating default admin user...');
            await database.createUser({
                username: 'admin',
                password: '$2a$10$N7FHlmDmTpzB5wQZLsJH3e0Y8TQY.PqEy.8cF4H5LJ7G8KhYaE9YW', // password: admin123
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
            console.log('✅ Created admin user (username: admin, password: admin123)');
        }

        console.log('🎉 Database initialization complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

initializeWithSampleData();