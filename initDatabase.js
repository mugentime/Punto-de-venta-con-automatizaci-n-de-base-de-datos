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

        // Create default products
        const defaultProducts = [
            {
                name: "Espresso",
                category: "cafeteria",
                quantity: 50,
                cost: 10,
                price: 35,
                lowStockAlert: 10,
                description: "Café espresso tradicional"
            },
            {
                name: "Americano",
                category: "cafeteria", 
                quantity: 45,
                cost: 12,
                price: 40,
                lowStockAlert: 10,
                description: "Café americano suave"
            },
            {
                name: "Capuccino",
                category: "cafeteria",
                quantity: 40,
                cost: 15,
                price: 45,
                lowStockAlert: 10,
                description: "Capuccino cremoso"
            },
            {
                name: "Latte",
                category: "cafeteria",
                quantity: 35,
                cost: 12,
                price: 40,
                lowStockAlert: 10,
                description: "Latte con leche vaporizada"
            },
            {
                name: "Mokha",
                category: "cafeteria",
                quantity: 25,
                cost: 18,
                price: 50,
                lowStockAlert: 8,
                description: "Café mokha con chocolate"
            },
            {
                name: "Coca-Cola",
                category: "refrigerador",
                quantity: 24,
                cost: 15,
                price: 25,
                lowStockAlert: 6,
                description: "Refresco de cola 355ml"
            },
            {
                name: "Agua Mineral",
                category: "refrigerador",
                quantity: 30,
                cost: 8,
                price: 15,
                lowStockAlert: 10,
                description: "Agua mineral 500ml"
            },
            {
                name: "Pepsi",
                category: "refrigerador",
                quantity: 20,
                cost: 14,
                price: 25,
                lowStockAlert: 6,
                description: "Refresco de cola Pepsi 355ml"
            }
        ];

        console.log('📦 Creating default products...');
        for (const product of defaultProducts) {
            await database.createProduct(product);
            console.log(`✅ Created product: ${product.name}`);
        }

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