
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { registerClient, broadcastDataChange } from './src/services/sseService.js';
import { runPendingMigrations } from './scripts/auto-run-migrations.js';
import { createSimpleRateLimiter, requireAdminKey } from './middleware/security.js';
import { createHealthRouter } from './routes/health.js';
import { createProductsRouter } from './routes/products.js';
import { createOrdersRouter } from './routes/orders.js';
import { createExpensesRouter } from './routes/expenses.js';
import { createCoworkingSessionsRouter } from './routes/coworkingSessions.js';
import { createCoworkingSessionsRepository } from './repositories/coworkingSessions.js';
import { createCashSessionsRouter } from './routes/cashSessions.js';
import { createCashWithdrawalsRouter } from './routes/cashWithdrawals.js';
import { createUsersRouter } from './routes/users.js';
import { createAuthRouter } from './routes/auth.js';
import { createCustomersRouter } from './routes/customers.js';
import { createAdminRouter } from './routes/admin.js';
import { createAiRouter } from './routes/ai.js';

const { Pool } = pg;

// --- CONFIGURATION ---
let pool;
let useDb = false;
const initialProducts = [
    { id: '1', name: 'Espresso Americano', price: 35, cost: 12, stock: 100, description: 'Intenso y aromático, preparado con granos de especialidad.', imageUrl: 'https://picsum.photos/seed/americano/400', category: 'Cafetería' },
    { id: '2', name: 'Latte', price: 55, cost: 18, stock: 100, description: 'Cremoso y suave, con leche vaporizada a la perfección.', imageUrl: 'https://picsum.photos/seed/latte/400', category: 'Cafetería' },
    { id: '3', name: 'Croissant', price: 40, cost: 20, stock: 50, description: 'Hojaldrado y horneado diariamente.', imageUrl: 'https://picsum.photos/seed/croissant/400', category: 'Alimentos' },
    { id: '4', name: 'Jugo Prensado en Frío', price: 60, cost: 35, stock: 60, description: 'Mezcla de naranja, zanahoria y jengibre.', imageUrl: 'https://picsum.photos/seed/juice/400', category: 'Refrigerador' },
    { id: '5', name: 'Baguette de Pavo y Pesto', price: 95, cost: 55, stock: 30, description: 'Pavo, queso manchego, arúgula y pesto de la casa.', imageUrl: 'https://picsum.photos/seed/sandwich/400', category: 'Alimentos' },
    { id: '6', name: 'Matcha Latte', price: 65, cost: 25, stock: 80, description: 'Té verde matcha ceremonial con leche a elección.', imageUrl: 'https://picsum.photos/seed/matcha/400', category: 'Cafetería' },
    { id: '8', name: 'Membresía Básica', price: 500, cost: 0, stock: 100, description: 'Acceso mensual al espacio de coworking. Incluye escritorio compartido y conexión WiFi de alta velocidad.', imageUrl: 'https://picsum.photos/seed/coworking-basic/400', category: 'Membresías' },
    { id: '9', name: 'Membresía Premium', price: 800, cost: 0, stock: 100, description: 'Acceso ilimitado con escritorio fijo, sala de juntas y locker personal. Incluye todos los beneficios básicos.', imageUrl: 'https://picsum.photos/seed/coworking-premium/400', category: 'Membresías' },
    { id: '10', name: 'Día de Coworking', price: 225, cost: 0, stock: 100, description: 'Acceso por un día completo al espacio de coworking con todas las facilidades.', imageUrl: 'https://picsum.photos/seed/coworking-day/400', category: 'Membresías' },
    { id: '7', name: 'Pan de Elote', price: 50, cost: 22, stock: 45, description: 'Receta casera, dulce y esponjoso.', imageUrl: 'https://picsum.photos/seed/cornbread/400', category: 'Alimentos' },
];

// --- DATABASE & DATA STORE SETUP ---
async function setupAndGetDataStore() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        try {
            pool = new Pool({
                connectionString: databaseUrl,
                max: 20, // Increase max connections for better performance
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 10000,
            });
            const client = await pool.connect();
            console.log("Successfully connected to PostgreSQL with optimized pool (max: 20 connections).");

            // Run pending migrations
            client.release(); // Release client before running migrations
            await runPendingMigrations();

            // Reconnect for schema setup
            const schemaClient = await pool.connect();

            await schemaClient.query(`
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

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(255) PRIMARY KEY,
                "clientName" VARCHAR(255) NOT NULL,
                "serviceType" VARCHAR(50) NOT NULL,
                "paymentMethod" VARCHAR(50) NOT NULL,
                items JSONB NOT NULL,
                subtotal NUMERIC(10, 2) NOT NULL,
                discount NUMERIC(10, 2) DEFAULT 0,
                tip NUMERIC(10, 2) DEFAULT 0,
                total NUMERIC(10, 2) NOT NULL,
                "userId" VARCHAR(255),
                "customerId" VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS expenses (
                id VARCHAR(255) PRIMARY KEY,
                description VARCHAR(255) NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                category VARCHAR(255) NOT NULL,
                "userId" VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS coworking_sessions (
                id VARCHAR(255) PRIMARY KEY,
                "clientName" VARCHAR(255) NOT NULL,
                "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endTime" TIMESTAMP WITH TIME ZONE,
                duration INTEGER DEFAULT 0,
                "hourlyRate" NUMERIC(10, 2) DEFAULT 50,
                total NUMERIC(10, 2) DEFAULT 0,
                "paymentMethod" VARCHAR(50),
                status VARCHAR(50) DEFAULT 'active',
                "consumedExtras" JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS cash_sessions (
                id VARCHAR(255) PRIMARY KEY,
                "startAmount" NUMERIC(10, 2) NOT NULL,
                "endAmount" NUMERIC(10, 2),
                "startTime" TIMESTAMP WITH TIME ZONE NOT NULL,
                "endTime" TIMESTAMP WITH TIME ZONE,
                "totalSales" NUMERIC(10, 2) DEFAULT 0,
                "totalExpenses" NUMERIC(10, 2) DEFAULT 0,
                "expectedCash" NUMERIC(10, 2) DEFAULT 0,
                difference NUMERIC(10, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'active',
                "userId" VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS customers (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50),
                "discountPercentage" NUMERIC(5, 2) DEFAULT 0,
                "creditLimit" NUMERIC(10, 2) DEFAULT 0,
                "currentCredit" NUMERIC(10, 2) DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS customer_credits (
                id VARCHAR(255) PRIMARY KEY,
                "customerId" VARCHAR(255) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                "orderId" VARCHAR(255),
                amount NUMERIC(10, 2) NOT NULL,
                type VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS cash_registry (
                id VARCHAR(255) PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                "openingBalance" NUMERIC(10, 2) NOT NULL DEFAULT 0,
                "closingBalance" NUMERIC(10, 2),
                "expectedBalance" NUMERIC(10, 2),
                difference NUMERIC(10, 2),
                "totalSales" NUMERIC(10, 2) DEFAULT 0,
                "totalExpenses" NUMERIC(10, 2) DEFAULT 0,
                "totalCashPayments" NUMERIC(10, 2) DEFAULT 0,
                "totalCardPayments" NUMERIC(10, 2) DEFAULT 0,
                "sessionCount" INTEGER DEFAULT 0,
                notes TEXT,
                status VARCHAR(50) DEFAULT 'open',
                "openedBy" VARCHAR(255) REFERENCES users(id),
                "closedBy" VARCHAR(255) REFERENCES users(id),
                "openedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "closedAt" TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await schemaClient.query(`
              CREATE TABLE IF NOT EXISTS cash_withdrawals (
                id VARCHAR(255) PRIMARY KEY,
                cash_session_id VARCHAR(255) NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                description TEXT NOT NULL,
                withdrawn_by VARCHAR(255),
                withdrawn_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_cash_session
                    FOREIGN KEY (cash_session_id)
                    REFERENCES cash_sessions(id)
                    ON DELETE CASCADE,
                CONSTRAINT fk_withdrawn_by
                    FOREIGN KEY (withdrawn_by)
                    REFERENCES users(id)
                    ON DELETE SET NULL,
                CONSTRAINT check_positive_amount CHECK (amount > 0)
              );
            `);

            // AUTO-MIGRATION: Add discount and tip columns if they don't exist
            console.log('🔄 Running auto-migrations...');
            try {
                await schemaClient.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                      WHERE table_name = 'orders' AND column_name = 'discount') THEN
                            ALTER TABLE orders ADD COLUMN discount NUMERIC(10, 2) DEFAULT 0;
                            RAISE NOTICE 'Added discount column to orders table';
                        END IF;

                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                      WHERE table_name = 'orders' AND column_name = 'tip') THEN
                            ALTER TABLE orders ADD COLUMN tip NUMERIC(10, 2) DEFAULT 0;
                            RAISE NOTICE 'Added tip column to orders table';
                        END IF;
                    END $$;
                `);
                console.log('✅ Auto-migrations completed successfully');

                // Update existing orders with NULL discount/tip to default 0
                console.log('🔄 Updating existing orders with NULL discount/tip...');
                const updateResult = await schemaClient.query(`
                    UPDATE orders
                    SET discount = COALESCE(discount, 0),
                        tip = COALESCE(tip, 0)
                    WHERE discount IS NULL OR tip IS NULL
                `);
                if (updateResult.rowCount > 0) {
                    console.log(`✅ Updated ${updateResult.rowCount} order(s) with default discount/tip values`);
                } else {
                    console.log('✅ All orders already have discount/tip values');
                }
            } catch (migrationError) {
                console.error('⚠️ Auto-migration warning:', migrationError.message);
                // Don't fail startup if migration has issues
            }

            // 🚀 PERFORMANCE FIX: Create indexes for frequently queried columns
            console.log('🔄 Creating performance indexes...');
            try {
                await schemaClient.query(`
                    CREATE INDEX IF NOT EXISTS idx_cash_sessions_created_at
                    ON cash_sessions(created_at DESC);
                `);
                await schemaClient.query(`
                    CREATE INDEX IF NOT EXISTS idx_cash_sessions_status
                    ON cash_sessions(status);
                `);
                await schemaClient.query(`
                    CREATE INDEX IF NOT EXISTS idx_orders_created_at
                    ON orders(created_at DESC);
                `);
                console.log('✅ Performance indexes created successfully');
            } catch (indexError) {
                console.error('⚠️ Index creation warning:', indexError.message);
                // Don't fail startup if index creation has issues
            }

            const res = await schemaClient.query('SELECT COUNT(*) FROM products');
            if (res.rows[0].count === '0') {
                console.log('Seeding initial products into database...');
                const insertQuery = 'INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
                for (const p of initialProducts) {
                    await schemaClient.query(insertQuery, [p.id, p.name, p.price, p.cost, p.stock, p.description, p.imageUrl, p.category]);
                }
                console.log('Database seeded successfully.');
            }

            // Seed initial admin user, configured via env vars only (no hardcoded credentials).
            // If ADMIN_SEED_* aren't set, skip seeding rather than creating a default account.
            const userRes = await schemaClient.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
            if (userRes.rows[0].count === '0') {
                const seedUsername = process.env.ADMIN_SEED_USERNAME;
                const seedPassword = process.env.ADMIN_SEED_PASSWORD;
                const seedEmail = process.env.ADMIN_SEED_EMAIL;
                if (seedUsername && seedPassword && seedEmail) {
                    console.log('Seeding initial admin user from ADMIN_SEED_* env vars...');
                    await schemaClient.query(
                        'INSERT INTO users (id, username, email, password, role, status) VALUES ($1, $2, $3, $4, $5, $6)',
                        [`admin-${Date.now()}`, seedUsername, seedEmail, seedPassword, 'admin', 'approved']
                    );
                    console.log('Admin user seeded successfully.');
                } else {
                    console.warn('⚠️  No admin user exists and ADMIN_SEED_USERNAME/PASSWORD/EMAIL are not set — skipping admin seed. Set them in the environment to create the first admin account.');
                }
            }

            // Add consumedExtras column if it doesn't exist
            try {
                await schemaClient.query('ALTER TABLE coworking_sessions ADD COLUMN IF NOT EXISTS "consumedExtras" JSONB DEFAULT \'[]\'::jsonb');
                console.log('Added consumedExtras column to coworking_sessions if needed.');
            } catch (err) {
                console.log('consumedExtras column already exists or error:', err.message);
            }

            // AUTO-MIGRATION: Add paymentSource and type columns to expenses table
            console.log('🔄 Running expenses table migrations...');
            try {
                await schemaClient.query(`
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                      WHERE table_name = 'expenses' AND column_name = 'paymentSource') THEN
                            ALTER TABLE expenses ADD COLUMN "paymentSource" VARCHAR(50) DEFAULT 'transferencia';
                            RAISE NOTICE 'Added paymentSource column to expenses table';
                        END IF;

                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                                      WHERE table_name = 'expenses' AND column_name = 'type') THEN
                            ALTER TABLE expenses ADD COLUMN type VARCHAR(50) DEFAULT 'Emergente';
                            RAISE NOTICE 'Added type column to expenses table';
                        END IF;
                    END $$;
                `);
                console.log('✅ Expenses table migrations completed successfully');
            } catch (expenseMigrationError) {
                console.error('⚠️ Expenses migration warning:', expenseMigrationError.message);
            }
            schemaClient.release();
            useDb = true;
            console.log("Running in Database Mode.");
        } catch (err) {
            console.error('*******************************************************************');
            console.error('*** ERROR: Database connection failed.                            ***');
            console.error(`*** Details: ${err.message}`);
            console.error('*** Switching to in-memory mode for development.              ***');
            console.error('*******************************************************************');
            pool = null;
            useDb = false;
        }
    }

    if (!useDb) {
        console.warn("*******************************************************************");
        console.warn("*** WARNING: Running in in-memory mode.                         ***");
        console.warn("*** Data will not be persisted. Set a valid DATABASE_URL        ***");
        console.warn("*** environment variable to connect to a PostgreSQL database.   ***");
        console.warn("*******************************************************************");
    }

    const productStore = {
        async getAll() {
            if (!useDb) return initialProducts;
            const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
            return result.rows.map(product => ({
                ...product,
                price: parseFloat(product.price),
                cost: parseFloat(product.cost),
                stock: parseInt(product.stock)
            }));
        },
        async create(productData) {
            if (!useDb) {
                const newProduct = { ...productData, id: `prod-${Date.now()}` };
                initialProducts.push(newProduct);
                return newProduct;
            }
            const { name, price, cost, stock, description, imageUrl, category } = productData;
            const id = `prod-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [id, name, price, cost, stock, description, imageUrl, category]
            );
            const newProduct = result.rows[0];
            return {
                ...newProduct,
                price: parseFloat(newProduct.price),
                cost: parseFloat(newProduct.cost),
                stock: parseInt(newProduct.stock)
            };
        },
        async update(id, productData) {
            if (!useDb) {
                const index = initialProducts.findIndex(p => p.id === id);
                if (index > -1) {
                    initialProducts[index] = { ...initialProducts[index], ...productData, id };
                    return initialProducts[index];
                }
                return null;
            }
            const { name, price, cost, stock, description, imageUrl, category } = productData;
            const result = await pool.query(
                'UPDATE products SET name = $1, price = $2, cost = $3, stock = $4, description = $5, "imageUrl" = $6, category = $7 WHERE id = $8 RETURNING *',
                [name, price, cost, stock, description, imageUrl, category, id]
            );
            const updatedProduct = result.rows[0];
            return {
                ...updatedProduct,
                price: parseFloat(updatedProduct.price),
                cost: parseFloat(updatedProduct.cost),
                stock: parseInt(updatedProduct.stock)
            };
        },
        async delete(id) {
            if (!useDb) {
                const index = initialProducts.findIndex(p => p.id === id);
                if (index > -1) {
                    initialProducts.splice(index, 1);
                }
                return;
            }
            await pool.query('DELETE FROM products WHERE id = $1', [id]);
        },
        async importBatch(productsToImport) {
            if (!useDb) {
                 productsToImport.forEach(p_new => {
                    const index = initialProducts.findIndex(p_old => p_old.name === p_new.name);
                    if (index > -1) {
                        initialProducts[index] = {...initialProducts[index], ...p_new};
                    } else {
                        initialProducts.push({...p_new, id: `prod-${Date.now()}-${Math.random()}`});
                    }
                });
                return initialProducts;
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const product of productsToImport) {
                    const query = `
                        INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (name) DO UPDATE SET
                            price = EXCLUDED.price,
                            cost = EXCLUDED.cost,
                            stock = EXCLUDED.stock,
                            description = EXCLUDED.description,
                            "imageUrl" = EXCLUDED."imageUrl",
                            category = EXCLUDED.category;
                    `;
                    await client.query(query, [`prod-${Date.now()}-${Math.random()}`, product.name, product.price, product.cost, product.stock, product.description, product.imageUrl, product.category]);
                }
                await client.query('COMMIT');
                const allProducts = await client.query('SELECT * FROM products ORDER BY name ASC');
                return allProducts.rows;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },
        async updateStockBatch(items) {
            if (!useDb) {
                items.forEach(item => {
                    const product = initialProducts.find(p => p.id === item.id);
                    if (product) {
                        product.stock -= item.quantity;
                    }
                });
                return;
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const item of items) {
                    await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
                }
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },
    };

    return productStore;
}

async function startServer() {
    const productStore = await setupAndGetDataStore();

    // --- EXPRESS APP SETUP ---
    const app = express();
    const port = process.env.PORT || 3001;
    app.use(express.json({ limit: '50mb' }));

    // --- INITIALIZE FILE-BASED DATABASE MANAGER ---
    let dbManager;
    if (!useDb) {
        console.log('📁 Initializing file-based database manager...');
        // Dynamically import CommonJS module
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const dbManagerModule = require('./utils/databaseManager.cjs');
        // databaseManager.cjs exports a single instance, not a class
        dbManager = dbManagerModule;
        await dbManager.initialize();
        console.log('✅ File-based database ready');
    }

    // --- AI SETUP ---
    console.log("*******************************************************************");
    console.log("*** AI Configuration (100% FREE):                               ***");
    console.log("*** - Image generation: Multi-service fallback system          ***");
    console.log("***   1. Pollinations.ai (primary)                             ***");
    console.log("***   2. HuggingFace Stable Diffusion (backup)                 ***");
    console.log("***   3. Lexica.art search (backup)                            ***");
    console.log("***   4. Picsum placeholder (emergency fallback)               ***");
    console.log("*** - Text generation: HuggingFace Mistral-7B (FREE)           ***");
    console.log("*******************************************************************");

    // --- SECURITY HELPERS --- (moved to middleware/security.js)
    const loginRateLimiter = createSimpleRateLimiter(5,  15 * 60 * 1000); // 5 attempts per 15 min
    const aiRateLimiter    = createSimpleRateLimiter(10, 60 * 60 * 1000); // 10 per hour

    // --- MOUNT ROUTERS --- (moved out of server.js verbatim; see routes/ and middleware/)
    app.use(createHealthRouter({ pool, useDb }));
    app.use(createProductsRouter({ productStore, pool, useDb }));
    app.use(createOrdersRouter({ pool, useDb, broadcastDataChange }));
    app.use(createExpensesRouter({ pool, useDb, broadcastDataChange }));
    const coworkingSessions = createCoworkingSessionsRepository({ useDb, pool, dbManager });
    app.use(createCoworkingSessionsRouter({ coworkingSessions, broadcastDataChange }));
    app.use(createCashSessionsRouter({ pool, useDb, broadcastDataChange }));
    app.use(createCashWithdrawalsRouter({ pool, useDb, broadcastDataChange }));
    app.use(createUsersRouter({ pool, useDb }));
    app.use(createAuthRouter({ pool, useDb, loginRateLimiter }));
    app.use(createCustomersRouter({ pool, useDb, broadcastDataChange }));
    app.use(createAdminRouter({ pool, useDb, requireAdminKey }));
    app.use(createAiRouter({ aiRateLimiter }));

    // --- SERVE STATIC FILES ---
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });

    // --- START SERVER ---
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

startServer();
