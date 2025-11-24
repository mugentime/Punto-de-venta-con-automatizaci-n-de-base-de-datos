
import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

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
    { id: '10', name: 'Día de Coworking', price: 180, cost: 0, stock: 100, description: 'Acceso por un día completo al espacio de coworking con todas las facilidades.', imageUrl: 'https://picsum.photos/seed/coworking-day/400', category: 'Membresías' },
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

            await client.query(`
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

            await client.query(`
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

            await client.query(`
              CREATE TABLE IF NOT EXISTS expenses (
                id VARCHAR(255) PRIMARY KEY,
                description VARCHAR(255) NOT NULL,
                amount NUMERIC(10, 2) NOT NULL,
                category VARCHAR(255) NOT NULL,
                "userId" VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
              );
            `);

            await client.query(`
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

            await client.query(`
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

            await client.query(`
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

            await client.query(`
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

            await client.query(`
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

            await client.query(`
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
                await client.query(`
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
                const updateResult = await client.query(`
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
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_cash_sessions_created_at
                    ON cash_sessions(created_at DESC);
                `);
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_cash_sessions_status
                    ON cash_sessions(status);
                `);
                await client.query(`
                    CREATE INDEX IF NOT EXISTS idx_orders_created_at
                    ON orders(created_at DESC);
                `);
                console.log('✅ Performance indexes created successfully');
            } catch (indexError) {
                console.error('⚠️ Index creation warning:', indexError.message);
                // Don't fail startup if index creation has issues
            }

            const res = await client.query('SELECT COUNT(*) FROM products');
            if (res.rows[0].count === '0') {
                console.log('Seeding initial products into database...');
                const insertQuery = 'INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
                for (const p of initialProducts) {
                    await client.query(insertQuery, [p.id, p.name, p.price, p.cost, p.stock, p.description, p.imageUrl, p.category]);
                }
                console.log('Database seeded successfully.');
            }

            // Seed initial admin user
            const userRes = await client.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
            if (userRes.rows[0].count === '0') {
                console.log('Seeding initial admin user...');
                await client.query(
                    'INSERT INTO users (id, username, email, password, role, status) VALUES ($1, $2, $3, $4, $5, $6)',
                    ['admin-001', 'Admin1', 'je2alvarela@gmail.com', '1357', 'admin', 'approved']
                );
                console.log('Admin user seeded successfully.');
            }

            // Add consumedExtras column if it doesn't exist
            try {
                await client.query('ALTER TABLE coworking_sessions ADD COLUMN IF NOT EXISTS "consumedExtras" JSONB DEFAULT \'[]\'::jsonb');
                console.log('Added consumedExtras column to coworking_sessions if needed.');
            } catch (err) {
                console.log('consumedExtras column already exists or error:', err.message);
            }
            client.release();
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

    // --- API ENDPOINTS ---
    app.get('/api/products', async (req, res) => {
        try {
            const products = await productStore.getAll();
            res.json(products);
        } catch (error) {
            console.error("Error fetching products:", error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    });

    app.post('/api/products', async (req, res) => {
        try {
            const newProduct = await productStore.create(req.body);
            res.status(201).json(newProduct);
        } catch (error) {
            console.error("Error creating product:", error);
            res.status(500).json({ error: 'Failed to create product' });
        }
    });
    
    app.put('/api/products/:id', async (req, res) => {
        try {
            const updatedProduct = await productStore.update(req.params.id, req.body);
            if (updatedProduct) {
                res.json(updatedProduct);
            } else {
                res.status(404).json({ error: 'Product not found' });
            }
        } catch (error) {
            console.error(`Error updating product ${req.params.id}:`, error);
            res.status(500).json({ error: 'Failed to update product' });
        }
    });

    app.delete('/api/products/:id', async (req, res) => {
        try {
            await productStore.delete(req.params.id);
            res.status(204).send();
        } catch (error) {
            console.error(`Error deleting product ${req.params.id}:`, error);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    });

    app.post('/api/products/import', async (req, res) => {
        try {
            const fullProductList = await productStore.importBatch(req.body);
            res.status(200).json(fullProductList);
        } catch (error) {
            console.error("Error importing products:", error);
            res.status(500).json({ error: 'Failed to import products' });
        }
    });

    // --- ORDERS API ---
    app.get('/api/orders', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
            res.json(result.rows.map(order => ({
                ...order,
                subtotal: parseFloat(order.subtotal),
                discount: parseFloat(order.discount || 0),
                tip: parseFloat(order.tip || 0),
                total: parseFloat(order.total),
                date: order.created_at,  // Map created_at to date for frontend compatibility
                totalCost: order.items ? order.items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
            })));
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    });

    // FIX BUG 3: Store for idempotency checking (in-memory cache for recent orders)
    const recentOrderKeys = new Map(); // Map<idempotencyKey, orderId>
    const ORDER_KEY_TTL = 60000; // 1 minute TTL for idempotency keys

    app.post('/api/orders', async (req, res) => {
        try {
            const { clientName, serviceType, paymentMethod, items, subtotal, discount, tip, total, userId, customerId, idempotencyKey } = req.body;

            console.log('📦 Creating order:', { clientName, serviceType, paymentMethod, subtotal, discount: discount || 0, tip: tip || 0, total, userId, customerId, itemsCount: items?.length, idempotencyKey });

            // 🧪 IN-MEMORY MODE: Store orders in memory
            if (!useDb) {
                const id = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newOrder = {
                    id,
                    clientName,
                    serviceType,
                    paymentMethod,
                    items,
                    subtotal,
                    discount: discount || 0,
                    tip: tip || 0,
                    total,
                    userId,
                    customerId: customerId || null,
                    created_at: new Date().toISOString(),
                    date: new Date().toISOString(),
                    totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
                };
                console.log('✅ Order created in memory:', id);
                return res.status(201).json(newOrder);
            }

            // FIX BUG 3: Check idempotency key to prevent duplicate submissions
            if (idempotencyKey && recentOrderKeys.has(idempotencyKey)) {
                const existingOrderId = recentOrderKeys.get(idempotencyKey);
                console.log('⚠️ Duplicate order attempt detected via idempotency key:', idempotencyKey);

                // Return existing order
                const client = await pool.connect();
                try {
                    const result = await client.query('SELECT * FROM orders WHERE id = $1', [existingOrderId]);
                    if (result.rows.length > 0) {
                        const existingOrder = result.rows[0];
                        return res.status(200).json({
                            ...existingOrder,
                            subtotal: parseFloat(existingOrder.subtotal),
                            total: parseFloat(existingOrder.total),
                            date: existingOrder.created_at,
                            customerId: existingOrder.customerId,
                            totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0,
                            isDuplicate: true
                        });
                    }
                } finally {
                    client.release();
                }
            }

            const id = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Ensure customerId is properly null if not provided
                const cleanCustomerId = customerId && customerId !== '' ? customerId : null;

                console.log('💾 Inserting order into database...', { id, cleanCustomerId });

                // Insert order with discount and tip
                const result = await client.query(
                    'INSERT INTO orders (id, "clientName", "serviceType", "paymentMethod", items, subtotal, discount, tip, total, "userId", "customerId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
                    [id, clientName, serviceType, paymentMethod, JSON.stringify(items), subtotal, discount || 0, tip || 0, total, userId, cleanCustomerId]
                );
                const newOrder = result.rows[0];
                console.log('✅ Order inserted successfully:', newOrder.id, { discount: discount || 0, tip: tip || 0 });

                // FIX BUG 3: Store idempotency key
                if (idempotencyKey) {
                    recentOrderKeys.set(idempotencyKey, id);
                    setTimeout(() => recentOrderKeys.delete(idempotencyKey), ORDER_KEY_TTL);
                }

                // If it's a credit payment and customer exists, create credit record
                if (cleanCustomerId && (paymentMethod === 'Crédito' || paymentMethod === 'Fiado')) {
                    console.log('💳 Creating customer credit record...');
                    await client.query(
                        'INSERT INTO customer_credits (id, "customerId", "orderId", amount, type, status, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [`credit-${Date.now()}`, cleanCustomerId, id, total, 'charge', 'pending', `Orden #${id}`]
                    );
                    // Update customer's current credit
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" + $1 WHERE id = $2',
                        [total, cleanCustomerId]
                    );
                    console.log('✅ Customer credit updated');
                }

                await client.query('COMMIT');
                console.log('✅ Transaction committed successfully');

                res.status(201).json({
                    ...newOrder,
                    subtotal: parseFloat(newOrder.subtotal),
                    discount: parseFloat(newOrder.discount || 0),
                    tip: parseFloat(newOrder.tip || 0),
                    total: parseFloat(newOrder.total),
                    date: newOrder.created_at,
                    customerId: newOrder.customerId,
                    totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
                });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('❌ Database transaction error:', error.message, error.stack);
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("❌ Error creating order:", error.message);
            console.error("Stack trace:", error.stack);
            res.status(500).json({
                error: 'Failed to create order',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    app.delete('/api/orders/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });

            console.log('🗑️  Deleting order:', req.params.id);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // First, check if order has associated customer credit and remove it
                const creditCheck = await client.query(
                    'SELECT * FROM customer_credits WHERE "orderId" = $1',
                    [req.params.id]
                );

                if (creditCheck.rows.length > 0) {
                    const credit = creditCheck.rows[0];
                    console.log('💳 Reversing customer credit for order...');

                    // Reverse the credit from customer's balance
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" - $1 WHERE id = $2',
                        [credit.amount, credit.customerId]
                    );

                    // Delete the credit record
                    await client.query('DELETE FROM customer_credits WHERE "orderId" = $1', [req.params.id]);
                }

                // Delete the order
                const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Order not found' });
                }

                await client.query('COMMIT');
                console.log('✅ Order deleted successfully:', req.params.id);

                res.status(204).send();
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('❌ Database transaction error:', error.message);
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("❌ Error deleting order:", error.message);
            res.status(500).json({ error: 'Failed to delete order' });
        }
    });

    // 🧹 Cleanup duplicate orders from database
    app.post('/api/orders/cleanup-duplicates', async (req, res) => {
        if (!useDb) {
            return res.status(500).json({ error: 'Database mode only' });
        }

        try {
            const client = await pool.connect();

            // Find duplicates (same clientName, total, timestamp within same second)
            const findQuery = `
                WITH duplicates AS (
                    SELECT
                        id,
                        client_name,
                        total,
                        created_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY client_name, total, FLOOR(EXTRACT(EPOCH FROM created_at))
                            ORDER BY id ASC
                        ) as row_num
                    FROM orders
                )
                SELECT id, client_name, total, created_at
                FROM duplicates
                WHERE row_num > 1
                ORDER BY created_at DESC;
            `;

            const duplicates = await client.query(findQuery);
            console.log(`📊 Found ${duplicates.rows.length} duplicate orders`);

            if (duplicates.rows.length === 0) {
                client.release();
                return res.json({ message: 'No duplicates found', deleted: 0 });
            }

            // Delete duplicates (keep first occurrence by smallest ID)
            const deleteQuery = `
                WITH duplicates AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY client_name, total, FLOOR(EXTRACT(EPOCH FROM created_at))
                            ORDER BY id ASC
                        ) as row_num
                    FROM orders
                )
                DELETE FROM orders
                WHERE id IN (
                    SELECT id FROM duplicates WHERE row_num > 1
                )
                RETURNING id, client_name, total, created_at;
            `;

            const deleteResult = await client.query(deleteQuery);
            console.log(`✅ Deleted ${deleteResult.rows.length} duplicate orders`);

            client.release();
            res.json({
                message: `Successfully deleted ${deleteResult.rows.length} duplicate orders`,
                deleted: deleteResult.rows.length,
                duplicates: deleteResult.rows
            });
        } catch (err) {
            console.error('❌ Error cleaning up duplicates:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // --- EXPENSES API ---
    app.get('/api/expenses', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT * FROM expenses ORDER BY created_at DESC');
            res.json(result.rows.map(expense => ({
                ...expense,
                amount: parseFloat(expense.amount),
                date: expense.created_at  // Map created_at to date for frontend compatibility
            })));
        } catch (error) {
            console.error("Error fetching expenses:", error);
            res.status(500).json({ error: 'Failed to fetch expenses' });
        }
    });

    app.post('/api/expenses', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { description, amount, category, userId } = req.body;
            const id = `expense-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO expenses (id, description, amount, category, "userId") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, description, amount, category, userId]
            );
            const newExpense = result.rows[0];
            res.status(201).json({
                ...newExpense,
                amount: parseFloat(newExpense.amount),
                date: newExpense.created_at  // Map created_at to date for frontend compatibility
            });
        } catch (error) {
            console.error("Error creating expense:", error);
            res.status(500).json({ error: 'Failed to create expense' });
        }
    });

    app.put('/api/expenses/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { description, amount, category, date } = req.body;

            // Update with date if provided, otherwise keep existing date using COALESCE
            const result = await pool.query(
                'UPDATE expenses SET description = $1, amount = $2, category = $3, created_at = COALESCE($4, created_at) WHERE id = $5 RETURNING *',
                [description, amount, category, date || null, req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }
            const updatedExpense = result.rows[0];
            res.json({
                ...updatedExpense,
                amount: parseFloat(updatedExpense.amount),
                date: updatedExpense.created_at  // Map created_at to date for frontend compatibility
            });
        } catch (error) {
            console.error("Error updating expense:", error);
            res.status(500).json({ error: 'Failed to update expense' });
        }
    });

    app.delete('/api/expenses/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting expense:", error);
            res.status(500).json({ error: 'Failed to delete expense' });
        }
    });

    // --- COWORKING SESSIONS API ---
    app.get('/api/coworking-sessions', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT * FROM coworking_sessions ORDER BY created_at DESC');
            res.json(result.rows.map(session => ({
                ...session,
                hourlyRate: parseFloat(session.hourlyRate),
                total: parseFloat(session.total),
                consumedExtras: session.consumedExtras || []
            })));
        } catch (error) {
            console.error("Error fetching coworking sessions:", error);
            res.status(500).json({ error: 'Failed to fetch coworking sessions' });
        }
    });

    app.post('/api/coworking-sessions', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { clientName, startTime, hourlyRate } = req.body;
            const id = `coworking-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO coworking_sessions (id, "clientName", "startTime", "hourlyRate", "consumedExtras") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, clientName, startTime, hourlyRate || 50, JSON.stringify([])]
            );
            const newSession = result.rows[0];
            res.status(201).json({
                ...newSession,
                hourlyRate: parseFloat(newSession.hourlyRate),
                total: parseFloat(newSession.total),
                consumedExtras: newSession.consumedExtras || []
            });
        } catch (error) {
            console.error("Error creating coworking session:", error);
            res.status(500).json({ error: 'Failed to create coworking session' });
        }
    });

    app.put('/api/coworking-sessions/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });

            // Build dynamic update query based on provided fields
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (req.body.endTime !== undefined) {
                updates.push(`"endTime" = $${paramCount++}`);
                values.push(req.body.endTime);
            }
            if (req.body.duration !== undefined) {
                updates.push(`duration = $${paramCount++}`);
                values.push(req.body.duration);
            }
            if (req.body.total !== undefined) {
                updates.push(`total = $${paramCount++}`);
                values.push(req.body.total);
            }
            if (req.body.paymentMethod !== undefined) {
                updates.push(`"paymentMethod" = $${paramCount++}`);
                values.push(req.body.paymentMethod);
            }
            if (req.body.status !== undefined) {
                updates.push(`status = $${paramCount++}`);
                values.push(req.body.status);
            }
            if (req.body.consumedExtras !== undefined) {
                updates.push(`"consumedExtras" = $${paramCount++}`);
                values.push(JSON.stringify(req.body.consumedExtras));
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(req.params.id);
            const query = `UPDATE coworking_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Coworking session not found' });
            }
            const updatedSession = result.rows[0];
            res.json({
                ...updatedSession,
                hourlyRate: parseFloat(updatedSession.hourlyRate),
                total: parseFloat(updatedSession.total),
                consumedExtras: updatedSession.consumedExtras || []
            });
        } catch (error) {
            console.error("Error updating coworking session:", error);
            res.status(500).json({ error: 'Failed to update coworking session' });
        }
    });

    app.delete('/api/coworking-sessions/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });

            console.log('🗑️ Deleting coworking session:', req.params.id);

            const result = await pool.query('DELETE FROM coworking_sessions WHERE id = $1 RETURNING *', [req.params.id]);

            if (result.rows.length === 0) {
                console.log('❌ Coworking session not found:', req.params.id);
                return res.status(404).json({ error: 'Coworking session not found' });
            }

            console.log('✅ Coworking session deleted successfully:', req.params.id);
            res.status(204).send();
        } catch (error) {
            console.error('❌ Error deleting coworking session:', error);
            res.status(500).json({ error: 'Failed to delete coworking session' });
        }
    });

    // --- CASH SESSIONS API ---
    app.get('/api/cash-sessions', async (req, res) => {
        try {
            if (!useDb) return res.json([]);

            // 🚀 PERFORMANCE FIX: Add pagination with sensible defaults
            const limit = parseInt(req.query.limit) || 100; // Default: last 100 sessions
            const offset = parseInt(req.query.offset) || 0;
            const status = req.query.status; // Optional: filter by status ('active' or 'closed')

            // Build query with optional status filter
            let query = 'SELECT * FROM cash_sessions';
            let params = [];

            if (status) {
                query += ' WHERE status = $1';
                params.push(status);
                query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
                params.push(limit, offset);
            } else {
                query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
                params.push(limit, offset);
            }

            console.log(`📊 Fetching cash sessions (limit: ${limit}, offset: ${offset}, status: ${status || 'all'})`);
            const result = await pool.query(query, params);
            console.log(`✅ Retrieved ${result.rows.length} cash sessions`);

            res.json(result.rows.map(session => ({
                ...session,
                startAmount: parseFloat(session.startAmount),
                endAmount: session.endAmount ? parseFloat(session.endAmount) : null,
                totalSales: parseFloat(session.totalSales),
                totalExpenses: parseFloat(session.totalExpenses),
                expectedCash: parseFloat(session.expectedCash),
                difference: parseFloat(session.difference)
            })));
        } catch (error) {
            console.error("Error fetching cash sessions:", error);
            res.status(500).json({ error: 'Failed to fetch cash sessions' });
        }
    });

    app.post('/api/cash-sessions', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { startAmount, startTime, userId } = req.body;
            const id = `cash-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO cash_sessions (id, "startAmount", "startTime", "userId") VALUES ($1, $2, $3, $4) RETURNING *',
                [id, startAmount, startTime, userId]
            );
            const newSession = result.rows[0];
            res.status(201).json({
                ...newSession,
                startAmount: parseFloat(newSession.startAmount),
                endAmount: newSession.endAmount ? parseFloat(newSession.endAmount) : null,
                totalSales: parseFloat(newSession.totalSales),
                totalExpenses: parseFloat(newSession.totalExpenses),
                expectedCash: parseFloat(newSession.expectedCash),
                difference: parseFloat(newSession.difference)
            });
        } catch (error) {
            console.error("Error creating cash session:", error);
            res.status(500).json({ error: 'Failed to create cash session' });
        }
    });

    app.put('/api/cash-sessions/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { endAmount, endTime, totalSales, totalExpenses, expectedCash, difference, status } = req.body;
            const result = await pool.query(
                'UPDATE cash_sessions SET "endAmount" = $1, "endTime" = $2, "totalSales" = $3, "totalExpenses" = $4, "expectedCash" = $5, difference = $6, status = $7 WHERE id = $8 RETURNING *',
                [endAmount, endTime, totalSales, totalExpenses, expectedCash, difference, status, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Cash session not found' });
            }
            const updatedSession = result.rows[0];
            res.json({
                ...updatedSession,
                startAmount: parseFloat(updatedSession.startAmount),
                endAmount: updatedSession.endAmount ? parseFloat(updatedSession.endAmount) : null,
                totalSales: parseFloat(updatedSession.totalSales),
                totalExpenses: parseFloat(updatedSession.totalExpenses),
                expectedCash: parseFloat(updatedSession.expectedCash),
                difference: parseFloat(updatedSession.difference)
            });
        } catch (error) {
            console.error("Error updating cash session:", error);
            res.status(500).json({ error: 'Failed to update cash session' });
        }
    });

    // --- CASH WITHDRAWALS API ---
    app.get('/api/cash-withdrawals', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT * FROM cash_withdrawals ORDER BY withdrawn_at DESC');
            res.json(result.rows.map(withdrawal => ({
                ...withdrawal,
                amount: parseFloat(withdrawal.amount)
            })));
        } catch (error) {
            console.error("Error fetching cash withdrawals:", error);
            res.status(500).json({ error: 'Failed to fetch cash withdrawals' });
        }
    });

    app.get('/api/cash-withdrawals/session/:sessionId', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query(
                'SELECT * FROM cash_withdrawals WHERE cash_session_id = $1 ORDER BY withdrawn_at DESC',
                [req.params.sessionId]
            );
            res.json(result.rows.map(withdrawal => ({
                ...withdrawal,
                amount: parseFloat(withdrawal.amount)
            })));
        } catch (error) {
            console.error("Error fetching session withdrawals:", error);
            res.status(500).json({ error: 'Failed to fetch session withdrawals' });
        }
    });

    app.post('/api/cash-withdrawals', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { cashSessionId, amount, description, userId } = req.body;
            const id = `withdrawal-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO cash_withdrawals (id, cash_session_id, amount, description, withdrawn_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, cashSessionId, amount, description, userId]
            );
            const newWithdrawal = result.rows[0];
            res.status(201).json({
                ...newWithdrawal,
                amount: parseFloat(newWithdrawal.amount)
            });
        } catch (error) {
            console.error("Error creating cash withdrawal:", error);
            res.status(500).json({ error: 'Failed to create cash withdrawal' });
        }
    });

    app.delete('/api/cash-withdrawals/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM cash_withdrawals WHERE id = $1', [req.params.id]);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting cash withdrawal:", error);
            res.status(500).json({ error: 'Failed to delete cash withdrawal' });
        }
    });

    // --- USERS API ---
    app.get('/api/users', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    // --- LOGIN ENDPOINT ---
    app.post('/api/login', async (req, res) => {
        try {
            const { username, password } = req.body;

            // 🧪 IN-MEMORY MODE: Allow testing with default admin user
            if (!useDb) {
                const inMemoryUsers = [
                    { id: 'admin-001', username: 'Admin1', email: 'je2alvarela@gmail.com', password: '1357', role: 'admin', status: 'approved' }
                ];
                const user = inMemoryUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
                if (!user) {
                    return res.status(401).json({ error: 'Usuario no encontrado.' });
                }
                if (user.password !== password) {
                    return res.status(401).json({ error: 'Contraseña incorrecta.' });
                }
                if (user.status !== 'approved') {
                    return res.status(403).json({ error: 'Usuario pendiente de aprobación.' });
                }
                return res.json({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    status: user.status
                });
            }

            // Query database for user with password
            const result = await pool.query(
                'SELECT id, username, email, password, role, status FROM users WHERE LOWER(username) = LOWER($1)',
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Usuario no encontrado.' });
            }

            const user = result.rows[0];

            // Check password (in production, use bcrypt)
            if (user.password !== password) {
                return res.status(401).json({ error: 'Contraseña incorrecta.' });
            }

            // Check if user is approved
            if (user.status !== 'approved') {
                return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación.' });
            }

            // Return user data without password
            res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status
            });
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: 'Failed to login' });
        }
    });

    app.post('/api/users', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { username, email, password, role, status } = req.body;
            const id = `user-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO users (id, username, email, password, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, role, status, created_at',
                [id, username, email, password, role || 'user', status || 'pending']
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error("Error creating user:", error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    app.put('/api/users/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { username, email, role, status } = req.body;
            const result = await pool.query(
                'UPDATE users SET username = $1, email = $2, role = $3, status = $4 WHERE id = $5 RETURNING id, username, email, role, status, created_at',
                [username, email, role, status, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error updating user:", error);
            res.status(500).json({ error: 'Failed to update user' });
        }
    });

    app.delete('/api/users/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting user:", error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    app.post('/api/products/update-stock', async (req, res) => {
        try {
            await productStore.updateStockBatch(req.body.items);
            res.status(200).json({ message: 'Stock updated successfully' });
        } catch (error) {
            console.error("Error updating stock:", error);
            res.status(500).json({ error: 'Failed to update stock' });
        }
    });

    // --- CUSTOMERS ENDPOINTS ---
    app.get('/api/customers', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const result = await pool.query('SELECT * FROM customers ORDER BY name ASC');
            res.json(result.rows.map(c => ({
                ...c,
                discountPercentage: parseFloat(c.discountPercentage),
                creditLimit: parseFloat(c.creditLimit),
                currentCredit: parseFloat(c.currentCredit),
                createdAt: c.created_at
            })));
        } catch (error) {
            console.error("Error fetching customers:", error);
            res.status(500).json({ error: 'Failed to fetch customers' });
        }
    });

    app.post('/api/customers', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { name, email, phone, discountPercentage, creditLimit } = req.body;
            const id = `cust-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO customers (id, name, email, phone, "discountPercentage", "creditLimit") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [id, name, email || null, phone || null, discountPercentage || 0, creditLimit || 0]
            );
            const customer = result.rows[0];
            res.status(201).json({
                ...customer,
                discountPercentage: parseFloat(customer.discountPercentage),
                creditLimit: parseFloat(customer.creditLimit),
                currentCredit: parseFloat(customer.currentCredit),
                createdAt: customer.created_at
            });
        } catch (error) {
            console.error("Error creating customer:", error);
            res.status(500).json({ error: 'Failed to create customer' });
        }
    });

    app.put('/api/customers/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { name, email, phone, discountPercentage, creditLimit } = req.body;
            const result = await pool.query(
                'UPDATE customers SET name = $1, email = $2, phone = $3, "discountPercentage" = $4, "creditLimit" = $5 WHERE id = $6 RETURNING *',
                [name, email || null, phone || null, discountPercentage, creditLimit, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }
            const customer = result.rows[0];
            res.json({
                ...customer,
                discountPercentage: parseFloat(customer.discountPercentage),
                creditLimit: parseFloat(customer.creditLimit),
                currentCredit: parseFloat(customer.currentCredit),
                createdAt: customer.created_at
            });
        } catch (error) {
            console.error("Error updating customer:", error);
            res.status(500).json({ error: 'Failed to update customer' });
        }
    });

    app.delete('/api/customers/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting customer:", error);
            res.status(500).json({ error: 'Failed to delete customer' });
        }
    });

    // --- CUSTOMER CREDITS ENDPOINTS ---
    app.get('/api/customers/:id/credits', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const result = await pool.query(
                'SELECT * FROM customer_credits WHERE "customerId" = $1 ORDER BY created_at DESC',
                [req.params.id]
            );
            res.json(result.rows.map(c => ({
                ...c,
                amount: parseFloat(c.amount),
                customerId: c.customerId,
                orderId: c.orderId,
                createdAt: c.created_at
            })));
        } catch (error) {
            console.error("Error fetching customer credits:", error);
            res.status(500).json({ error: 'Failed to fetch customer credits' });
        }
    });

    app.post('/api/customers/:id/credits', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { amount, type, description, orderId } = req.body;
            const creditId = `credit-${Date.now()}`;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Insert credit record
                const creditResult = await client.query(
                    'INSERT INTO customer_credits (id, "customerId", "orderId", amount, type, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [creditId, req.params.id, orderId || null, amount, type, description || null, type === 'charge' ? 'pending' : 'paid']
                );

                // Update customer's current credit
                if (type === 'charge') {
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" + $1 WHERE id = $2',
                        [amount, req.params.id]
                    );
                } else if (type === 'payment') {
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" - $1 WHERE id = $2',
                        [amount, req.params.id]
                    );
                }

                await client.query('COMMIT');

                const credit = creditResult.rows[0];
                res.status(201).json({
                    ...credit,
                    amount: parseFloat(credit.amount),
                    customerId: credit.customerId,
                    orderId: credit.orderId,
                    createdAt: credit.created_at
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("Error creating customer credit:", error);
            res.status(500).json({ error: 'Failed to create customer credit' });
        }
    });

    app.put('/api/customer-credits/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { status } = req.body;
            const result = await pool.query(
                'UPDATE customer_credits SET status = $1 WHERE id = $2 RETURNING *',
                [status, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Credit record not found' });
            }
            const credit = result.rows[0];
            res.json({
                ...credit,
                amount: parseFloat(credit.amount),
                customerId: credit.customerId,
                orderId: credit.orderId,
                createdAt: credit.created_at
            });
        } catch (error) {
            console.error("Error updating customer credit:", error);
            res.status(500).json({ error: 'Failed to update customer credit' });
        }
    });

    // --- ADMIN FIX ENDPOINT ---
    app.post('/api/admin/fix-coworking-totals', async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        const calculateCoworkingCost = (startTime, endTime) => {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const durationMs = end.getTime() - start.getTime();
            const durationMinutes = Math.max(0, Math.ceil(durationMs / (1000 * 60)));

            // Apply 5-minute tolerance
            let adjustedMinutes = durationMinutes;
            const minutesOverHalfHour = durationMinutes % 30;
            if (minutesOverHalfHour > 0 && minutesOverHalfHour <= 5) {
                adjustedMinutes -= minutesOverHalfHour;
            }

            const durationHours = adjustedMinutes / 60;
            let cost = 0;

            if (adjustedMinutes > 0) {
                if (durationHours >= 3) {
                    cost = 180; // Day rate
                } else if (adjustedMinutes <= 60) {
                    cost = 58; // First hour
                } else {
                    const extraMinutes = adjustedMinutes - 60;
                    const halfHourBlocks = Math.ceil(extraMinutes / 30);
                    cost = 58 + (halfHourBlocks * 29);
                }
            }
            return { cost, minutes: adjustedMinutes };
        };

        try {
            const result = await pool.query(
                'SELECT id, "clientName", "startTime", "endTime", "consumedExtras", total FROM coworking_sessions WHERE status = $1',
                ['finished']
            );

            let updatedCount = 0;
            let skippedCount = 0;
            const updates = [];

            for (const session of result.rows) {
                const { id, clientName, startTime, endTime, consumedExtras, total: currentTotal } = session;

                if (!endTime) {
                    skippedCount++;
                    continue;
                }

                const { cost: baseCost, minutes: duration } = calculateCoworkingCost(startTime, endTime);
                const extras = consumedExtras || [];
                const extrasCost = extras.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 0)), 0);
                const calculatedTotal = baseCost + extrasCost;

                await pool.query(
                    'UPDATE coworking_sessions SET total = $1, duration = $2 WHERE id = $3',
                    [calculatedTotal, duration, id]
                );

                updates.push({
                    id,
                    clientName: clientName || 'Unknown',
                    oldTotal: parseFloat(currentTotal || 0),
                    newTotal: calculatedTotal,
                    duration
                });

                updatedCount++;
            }

            res.json({
                success: true,
                message: `Updated ${updatedCount} sessions, skipped ${skippedCount}`,
                updatedCount,
                skippedCount,
                updates
            });
        } catch (error) {
            console.error('Error fixing coworking totals:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // --- DATABASE OPTIMIZATION ENDPOINT ---
    app.post('/api/admin/optimize-database', async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        try {
            console.log('🚀 Starting database optimization...');
            const results = {
                fixedDates: 0,
                indexesCreated: 0,
                indexesExisted: 0
            };

            // Fix null dates in expenses
            console.log('📝 Fixing null dates in expenses...');
            const fixDatesResult = await pool.query(`
                UPDATE expenses
                SET created_at = CURRENT_TIMESTAMP
                WHERE created_at IS NULL
            `);
            results.fixedDates = fixDatesResult.rowCount;
            console.log(`✅ Fixed ${results.fixedDates} expenses with null dates`);

            // Add indexes for better performance
            console.log('🚀 Adding database indexes...');

            const indexes = [
                { name: 'idx_orders_created_at', table: 'orders', column: 'created_at DESC' },
                { name: 'idx_expenses_created_at', table: 'expenses', column: 'created_at DESC' },
                { name: 'idx_coworking_created_at', table: 'coworking_sessions', column: 'created_at DESC' },
                { name: 'idx_coworking_status', table: 'coworking_sessions', column: 'status' },
                { name: 'idx_customer_credits_customer', table: 'customer_credits', column: '"customerId"' }
            ];

            for (const idx of indexes) {
                try {
                    await pool.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`);
                    results.indexesCreated++;
                    console.log(`✅ Created index ${idx.name}`);
                } catch (e) {
                    results.indexesExisted++;
                    console.log(`ℹ️  Index ${idx.name} already exists`);
                }
            }

            res.json({
                success: true,
                message: 'Database optimization completed successfully',
                results
            });

        } catch (error) {
            console.error('❌ Optimization failed:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // --- TEMPORARY MIGRATION ENDPOINT ---
    app.post('/api/admin/add-customerId-column', async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        try {
            console.log('🔍 Checking if customerId column exists in orders table...');

            // Check if customerId column already exists
            const checkColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'orders'
                AND column_name = 'customerId'
            `);

            if (checkColumn.rows.length > 0) {
                console.log('ℹ️  Column customerId already exists in orders table');
                return res.json({
                    success: true,
                    message: 'Column customerId already exists',
                    alreadyExists: true
                });
            }

            console.log('📝 Adding customerId column to orders table...');
            await pool.query(`
                ALTER TABLE orders
                ADD COLUMN "customerId" VARCHAR(255)
            `);

            console.log('✅ Successfully added customerId column to orders table');

            res.json({
                success: true,
                message: 'Successfully added customerId column to orders table',
                alreadyExists: false
            });

        } catch (error) {
            console.error('❌ Migration failed:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // --- AI ENDPOINTS ---
    app.post('/api/generate-description', async (req, res) => {
      const { productName, keywords } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }

      try {
        console.log(`Generating description for product: ${productName} with keywords: ${keywords || 'none'}`);

        // Use HuggingFace Inference API (FREE, no API key needed for public models)
        const prompt = `Escribe una descripción de producto profesional y atractiva para: ${productName}${keywords ? `. Palabras clave: ${keywords}` : ''}. La descripción debe ser elegante, concisa (máximo 2-3 frases), enfocarse en beneficios y calidad. Responde SOLO con la descripción, sin comillas.`;

        const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 100,
              temperature: 0.7,
              top_p: 0.9,
              return_full_text: false
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HuggingFace API error: ${response.status}`);
        }

        const data = await response.json();
        let description = data[0]?.generated_text || '';

        // Clean up the description
        description = description
          .trim()
          .replace(/^["']|["']$/g, '') // Remove quotes
          .split('\n')[0] // Take first paragraph
          .substring(0, 300); // Limit length

        console.log(`Description generated successfully: ${description.substring(0, 100)}...`);
        res.json({ description });
      } catch (error) {
        console.error("Error generating description with HuggingFace:", error);
        console.error("Error details:", error.message);

        // Fallback to template-based description
        const category = keywords || 'calidad';
        const fallbackDescription = `${productName} de ${category} premium. Producto seleccionado con los más altos estándares de calidad para garantizar tu satisfacción.`;

        console.log('Using fallback description:', fallbackDescription);
        res.json({ description: fallbackDescription });
      }
    });
    
    app.post('/api/generate-image', async (req, res) => {
      const { productName, description } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }

      try {
        // Create detailed AI prompt from product name and description
        const aiPrompt = description
          ? `professional food photography of ${productName}, ${description}, high quality, detailed, appetizing, restaurant style`
          : `professional food photography of ${productName}, high quality, detailed, appetizing, restaurant style`;

        const encodedPrompt = encodeURIComponent(aiPrompt);

        console.log(`🎨 AI Image Generation for: "${productName}"`);
        console.log(`📝 Using description: "${description || 'none'}"`);
        console.log(`🤖 AI Prompt: "${aiPrompt}"`);

        let imageUrl = null;
        let serviceUsed = null;

        // 🎨 Service 1: Pollinations.ai (PRIMARY - Real AI image generation)
        try {
          const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=400&height=400&model=flux&nologo=true`;
          console.log(`🌸 Trying Pollinations.ai...`);

          // Do a partial GET request to verify there's actual content
          const testResponse = await fetch(pollinationsUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(30000) // 30 seconds for AI generation
          });

          if (testResponse.ok) {
            // Read first few bytes to verify there's content
            const reader = testResponse.body.getReader();
            const { value, done } = await reader.read();
            reader.releaseLock();

            if (value && value.length > 0) {
              imageUrl = pollinationsUrl;
              serviceUsed = 'Pollinations.ai (AI-generated)';
              console.log(`✅ AI Image generated via Pollinations.ai for: ${productName} (verified ${value.length} bytes)`);
            } else {
              console.log(`⚠️  Pollinations.ai returned empty response, falling back to next service...`);
            }
          }
        } catch (error) {
          console.log(`❌ Pollinations.ai failed (${error.message}), trying HuggingFace...`);
        }

        // 🤗 Service 2: HuggingFace Stable Diffusion (BACKUP - Real AI)
        if (!imageUrl) {
          try {
            console.log(`🤗 Trying HuggingFace Stable Diffusion...`);

            const hfResponse = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inputs: aiPrompt,
                parameters: {
                  width: 400,
                  height: 400,
                  num_inference_steps: 30
                }
              }),
              signal: AbortSignal.timeout(30000) // 30 seconds for AI generation
            });

            if (hfResponse.ok) {
              const blob = await hfResponse.blob();
              // Convert blob to base64 data URL
              const reader = new FileReader();
              const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              imageUrl = await base64Promise;
              serviceUsed = 'HuggingFace Stable Diffusion (AI-generated)';
              console.log(`✅ AI Image generated via HuggingFace for: ${productName}`);
            }
          } catch (error) {
            console.log(`❌ HuggingFace failed (${error.message}), trying Lexica...`);
          }
        }

        // 🎭 Service 3: Lexica.art API (AI art search - finds existing AI-generated images)
        if (!imageUrl) {
          try {
            console.log(`🎭 Trying Lexica.art AI search...`);

            const lexicaResponse = await fetch(`https://lexica.art/api/v1/search?q=${encodeURIComponent(productName)}`, {
              signal: AbortSignal.timeout(5000)
            });

            if (lexicaResponse.ok) {
              const lexicaData = await lexicaResponse.json();
              if (lexicaData.images && lexicaData.images.length > 0) {
                // Get the first result (most relevant)
                imageUrl = lexicaData.images[0].src;
                serviceUsed = 'Lexica.art (AI art search)';
                console.log(`✅ AI-generated image found via Lexica.art for: ${productName}`);
              }
            }
          } catch (error) {
            console.log(`❌ Lexica.art failed (${error.message}), using Picsum placeholder...`);
          }
        }

        // 🖼️ Service 4: Picsum placeholder (EMERGENCY FALLBACK - not AI)
        if (!imageUrl) {
          console.log(`⚠️  All AI services failed, using Picsum placeholder...`);
          // Create a hash from product name to get consistent but unique image
          let hash = 0;
          for (let i = 0; i < productName.length; i++) {
            hash = ((hash << 5) - hash) + productName.charCodeAt(i);
            hash = hash & hash;
          }
          const imageId = Math.abs(hash % 1000);

          imageUrl = `https://picsum.photos/id/${imageId}/400`;
          serviceUsed = 'Picsum placeholder (emergency fallback)';
          console.log(`⚠️  Using Picsum placeholder #${imageId} for: ${productName}`);
        }

        console.log(`🖼️  Image service used: ${serviceUsed}`);
        console.log(`🔗 Final image URL: ${imageUrl.substring(0, 100)}...`);

        res.json({
          imageUrl,
          service: serviceUsed,
          prompt: aiPrompt,
          isAiGenerated: serviceUsed.includes('AI') || serviceUsed.includes('Pollinations') || serviceUsed.includes('HuggingFace') || serviceUsed.includes('Lexica')
        });
      } catch (error) {
        console.error("❌ Error generating image:", error);
        // Emergency fallback with product name as text
        const placeholderText = encodeURIComponent(req.body.productName.substring(0, 30));
        res.json({
          imageUrl: `https://via.placeholder.com/400x400/dc2626/FFFFFF?text=${placeholderText}`,
          service: 'Emergency placeholder',
          error: error.message
        });
      }
    });

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
