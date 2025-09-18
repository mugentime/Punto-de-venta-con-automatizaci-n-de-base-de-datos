
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

// --- CONFIGURATION ---
let pool;
let useDb = false;
let ai = null; // AI client is now nullable
const initialProducts = [
    { id: '1', name: 'Espresso Americano', price: 35, cost: 12, stock: 100, description: 'Intenso y aromático, preparado con granos de especialidad.', imageUrl: 'https://picsum.photos/seed/americano/400', category: 'Cafetería' },
    { id: '2', name: 'Latte', price: 55, cost: 18, stock: 100, description: 'Cremoso y suave, con leche vaporizada a la perfección.', imageUrl: 'https://picsum.photos/seed/latte/400', category: 'Cafetería' },
    { id: '3', name: 'Croissant', price: 40, cost: 20, stock: 50, description: 'Hojaldrado y horneado diariamente.', imageUrl: 'https://picsum.photos/seed/croissant/400', category: 'Alimentos' },
    { id: '4', name: 'Jugo Prensado en Frío', price: 60, cost: 35, stock: 60, description: 'Mezcla de naranja, zanahoria y jengibre.', imageUrl: 'https://picsum.photos/seed/juice/400', category: 'Refrigerador' },
    { id: '5', name: 'Baguette de Pavo y Pesto', price: 95, cost: 55, stock: 30, description: 'Pavo, queso manchego, arúgula y pesto de la casa.', imageUrl: 'https://picsum.photos/seed/sandwich/400', category: 'Alimentos' },
    { id: '6', name: 'Matcha Latte', price: 65, cost: 25, stock: 80, description: 'Té verde matcha ceremonial con leche a elección.', imageUrl: 'https://picsum.photos/seed/matcha/400', category: 'Cafetería' },
    { id: '7', name: 'Pan de Elote', price: 50, cost: 22, stock: 45, description: 'Receta casera, dulce y esponjoso.', imageUrl: 'https://picsum.photos/seed/cornbread/400', category: 'Alimentos' },
];

// --- DATABASE & DATA STORE SETUP ---
async function setupAndGetDataStore() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        try {
            pool = new Pool({ connectionString: databaseUrl });
            const client = await pool.connect();
            console.log("Successfully connected to PostgreSQL.");

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
                total NUMERIC(10, 2) NOT NULL,
                "userId" VARCHAR(255),
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

    // --- GEMINI API SETUP ---
    const apiKey = process.env.API_KEY;
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
        console.log("Gemini AI client initialized successfully.");
    } else {
        console.warn("*******************************************************************");
        console.warn("*** WARNING: API_KEY is not set.                                ***");
        console.warn("*** AI-powered features (description/image generation) will be  ***");
        console.warn("*** disabled. Set the API_KEY environment variable to enable them.***");
        console.warn("*******************************************************************");
    }

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
                total: parseFloat(order.total),
                date: order.created_at,  // Map created_at to date for frontend compatibility
                totalCost: order.items ? order.items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
            })));
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    });

    app.post('/api/orders', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { clientName, serviceType, paymentMethod, items, subtotal, total, userId } = req.body;
            const id = `order-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO orders (id, "clientName", "serviceType", "paymentMethod", items, subtotal, total, "userId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [id, clientName, serviceType, paymentMethod, JSON.stringify(items), subtotal, total, userId]
            );
            const newOrder = result.rows[0];
            res.status(201).json({
                ...newOrder,
                subtotal: parseFloat(newOrder.subtotal),
                total: parseFloat(newOrder.total),
                date: newOrder.created_at,  // Map created_at to date for frontend compatibility
                totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
            });
        } catch (error) {
            console.error("Error creating order:", error);
            res.status(500).json({ error: 'Failed to create order' });
        }
    });

    // --- EXPENSES API ---
    app.get('/api/expenses', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT * FROM expenses ORDER BY created_at DESC');
            res.json(result.rows.map(expense => ({
                ...expense,
                amount: parseFloat(expense.amount)
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
                amount: parseFloat(newExpense.amount)
            });
        } catch (error) {
            console.error("Error creating expense:", error);
            res.status(500).json({ error: 'Failed to create expense' });
        }
    });

    app.put('/api/expenses/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { description, amount, category } = req.body;
            const result = await pool.query(
                'UPDATE expenses SET description = $1, amount = $2, category = $3 WHERE id = $4 RETURNING *',
                [description, amount, category, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }
            const updatedExpense = result.rows[0];
            res.json({
                ...updatedExpense,
                amount: parseFloat(updatedExpense.amount)
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
            const { endTime, duration, total, paymentMethod, status, consumedExtras } = req.body;
            const result = await pool.query(
                'UPDATE coworking_sessions SET "endTime" = $1, duration = $2, total = $3, "paymentMethod" = $4, status = $5, "consumedExtras" = $6 WHERE id = $7 RETURNING *',
                [endTime, duration, total, paymentMethod, status, JSON.stringify(consumedExtras || []), req.params.id]
            );
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

    // --- CASH SESSIONS API ---
    app.get('/api/cash-sessions', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT * FROM cash_sessions ORDER BY created_at DESC');
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

    // --- GEMINI ENDPOINTS ---
    app.post('/api/generate-description', async (req, res) => {
      if (!ai) {
        return res.status(503).json({ error: 'AI features are not configured on the server.' });
      }
      const { productName, keywords } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }
      const prompt = `Genera una descripción de producto atractiva y concisa para un sistema de punto de venta.
      Nombre del Producto: "${productName}"
      Palabras Clave: "${keywords || ''}"
      La descripción debe ser breve, impactante y adecuada para un catálogo de productos. No uses markdown. Solo texto plano. Limita la respuesta a 2 o 3 frases.`;
      try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.json({ description: response.text.trim() });
      } catch (error) {
        console.error("Error generating description with Gemini:", error);
        res.status(500).json({ error: 'Failed to generate description' });
      }
    });
    
    app.post('/api/generate-image', async (req, res) => {
      if (!ai) {
        return res.status(503).json({ error: 'AI features are not configured on the server.' });
      }
      const { productName } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }
      const prompt = `Dibujo minimalista de "${productName}". Estilo line art, con líneas limpias y simples. Sin texto, sin letras, sin palabras. Solo el producto centrado sobre un fondo sólido color #f3f4f6 (bg-gray-100 de Tailwind). Diseño limpio y minimalista.`;
      try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
        });
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
            res.json({ imageUrl });
        } else {
            console.warn("Gemini API did not return an image.");
            res.status(500).json({ error: 'Gemini API did not return an image.' });
        }
      } catch (error) {
        console.error("Error generating image with Gemini:", error);
        res.status(500).json({ error: 'Failed to generate image' });
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
