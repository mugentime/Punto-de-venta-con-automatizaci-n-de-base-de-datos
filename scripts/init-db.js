import pg from 'pg';

const { Pool } = pg;

const initialProducts = [
    { id: '1', name: 'Espresso Americano', price: 35, cost: 12, stock: 100, description: 'Intenso y aromático, preparado con granos de especialidad.', imageUrl: 'https://picsum.photos/seed/americano/400', category: 'Cafetería' },
    { id: '2', name: 'Latte', price: 55, cost: 18, stock: 100, description: 'Cremoso y suave, con leche vaporizada a la perfección.', imageUrl: 'https://picsum.photos/seed/latte/400', category: 'Cafetería' },
    { id: '3', name: 'Croissant', price: 40, cost: 20, stock: 50, description: 'Hojaldrado y horneado diariamente.', imageUrl: 'https://picsum.photos/seed/croissant/400', category: 'Alimentos' },
    { id: '4', name: 'Jugo Prensado en Frío', price: 60, cost: 35, stock: 60, description: 'Mezcla de naranja, zanahoria y jengibre.', imageUrl: 'https://picsum.photos/seed/juice/400', category: 'Refrigerador' },
    { id: '5', name: 'Baguette de Pavo y Pesto', price: 95, cost: 55, stock: 30, description: 'Pavo, queso manchego, arúgula y pesto de la casa.', imageUrl: 'https://picsum.photos/seed/sandwich/400', category: 'Alimentos' },
    { id: '6', name: 'Matcha Latte', price: 65, cost: 25, stock: 80, description: 'Té verde matcha ceremonial con leche a elección.', imageUrl: 'https://picsum.photos/seed/matcha/400', category: 'Cafetería' },
    { id: '7', name: 'Pan de Elote', price: 50, cost: 22, stock: 45, description: 'Receta casera, dulce y esponjoso.', imageUrl: 'https://picsum.photos/seed/cornbread/400', category: 'Alimentos' },
];

async function initializeDatabase() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.log('❌ DATABASE_URL not found. Skipping database initialization.');
        process.exit(0);
    }

    try {
        const pool = new Pool({ connectionString: databaseUrl });
        const client = await pool.connect();

        console.log('🔗 Connected to PostgreSQL database');

        // Create products table
        await client.query(`
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                price NUMERIC(10, 2) NOT NULL,
                cost NUMERIC(10, 2) NOT NULL,
                stock INTEGER NOT NULL,
                description TEXT,
                "imageUrl" TEXT,
                category VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Products table created successfully');

        // Check if products already exist
        const existingProducts = await client.query('SELECT COUNT(*) FROM products');
        const productCount = parseInt(existingProducts.rows[0].count);

        if (productCount === 0) {
            console.log('📦 Seeding initial products...');

            const insertQuery = `
                INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;

            for (const product of initialProducts) {
                await client.query(insertQuery, [
                    product.id,
                    product.name,
                    product.price,
                    product.cost,
                    product.stock,
                    product.description,
                    product.imageUrl,
                    product.category
                ]);
            }

            console.log(`✅ Successfully seeded ${initialProducts.length} products`);
        } else {
            console.log(`ℹ️  Database already contains ${productCount} products. Skipping seed.`);
        }

        client.release();
        await pool.end();
        console.log('🎉 Database initialization completed successfully!');

    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        process.exit(1);
    }
}

initializeDatabase();