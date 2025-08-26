const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

class Database {
    constructor() {
        // Configurar conexión a PostgreSQL o fallback a archivos
        if (process.env.DATABASE_URL) {
            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });
            this.useDatabase = true;
        } else {
            this.useDatabase = false;
            // Fallback a sistema de archivos existente
            this.dataDir = path.join(__dirname, '..', 'data');
        }
        
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        if (this.useDatabase) {
            await this.initDatabase();
        } else {
            await this.initFileSystem();
        }
        
        this.initialized = true;
    }

    async initDatabase() {
        // Crear tablas si no existen
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                _id VARCHAR(24) UNIQUE NOT NULL,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'employee',
                permissions JSONB DEFAULT '{}',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                _id VARCHAR(24) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(50) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 0,
                cost DECIMAL(10,2) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                low_stock_alert INTEGER DEFAULT 5,
                description TEXT,
                barcode VARCHAR(255),
                is_active BOOLEAN DEFAULT true,
                created_by VARCHAR(24),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS records (
                id SERIAL PRIMARY KEY,
                _id VARCHAR(24) UNIQUE NOT NULL,
                client VARCHAR(255) NOT NULL,
                service VARCHAR(50) NOT NULL,
                products JSONB NOT NULL DEFAULT '[]',
                hours INTEGER DEFAULT 1,
                payment VARCHAR(50) NOT NULL,
                notes TEXT,
                subtotal DECIMAL(10,2) DEFAULT 0,
                service_charge DECIMAL(10,2) DEFAULT 0,
                tip DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) NOT NULL,
                cost DECIMAL(10,2) DEFAULT 0,
                drinks_cost DECIMAL(10,2) DEFAULT 0,
                profit DECIMAL(10,2) DEFAULT 0,
                date TIMESTAMP NOT NULL,
                is_deleted BOOLEAN DEFAULT false,
                created_by VARCHAR(24),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ PostgreSQL database initialized');
    }

    async initFileSystem() {
        // Crear directorio de datos si no existe
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
        }

        // Verificar archivos de datos
        const files = ['users.json', 'products.json', 'records.json'];
        for (const file of files) {
            const filePath = path.join(this.dataDir, file);
            try {
                await fs.access(filePath);
            } catch {
                await fs.writeFile(filePath, JSON.stringify([], null, 2));
            }
        }

        console.log('✅ File system initialized');
    }

    generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // USERS
    async getUsers() {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC');
            return result.rows.map(row => ({
                _id: row._id,
                username: row.username,
                password: row.password,
                role: row.role,
                permissions: row.permissions,
                isActive: row.is_active,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } else {
            const data = await fs.readFile(path.join(this.dataDir, 'users.json'), 'utf8');
            return JSON.parse(data);
        }
    }

    async createUser(userData) {
        const id = this.generateId();
        const user = {
            _id: id,
            ...userData,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (this.useDatabase) {
            await this.pool.query(`
                INSERT INTO users (_id, username, password, role, permissions, is_active, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [user._id, user.username, user.password, user.role, JSON.stringify(user.permissions), user.isActive, user.createdAt, user.updatedAt]);
        } else {
            const users = await this.getUsers();
            users.push(user);
            await fs.writeFile(path.join(this.dataDir, 'users.json'), JSON.stringify(users, null, 2));
        }

        return user;
    }

    async getUserByUsername(username) {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
            if (result.rows.length === 0) return null;
            const row = result.rows[0];
            return {
                _id: row._id,
                username: row.username,
                password: row.password,
                role: row.role,
                permissions: row.permissions,
                isActive: row.is_active,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } else {
            const users = await this.getUsers();
            return users.find(u => u.username === username && u.isActive);
        }
    }

    // PRODUCTS
    async getProducts() {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM products WHERE is_active = true ORDER BY category, name');
            return result.rows.map(row => ({
                _id: row._id,
                name: row.name,
                category: row.category,
                quantity: row.quantity,
                cost: parseFloat(row.cost),
                price: parseFloat(row.price),
                lowStockAlert: row.low_stock_alert,
                description: row.description,
                barcode: row.barcode,
                isActive: row.is_active,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } else {
            const data = await fs.readFile(path.join(this.dataDir, 'products.json'), 'utf8');
            return JSON.parse(data);
        }
    }

    async createProduct(productData) {
        const id = this.generateId();
        const product = {
            _id: id,
            ...productData,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (this.useDatabase) {
            await this.pool.query(`
                INSERT INTO products (_id, name, category, quantity, cost, price, low_stock_alert, description, barcode, is_active, created_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [product._id, product.name, product.category, product.quantity, product.cost, product.price, product.lowStockAlert, product.description, product.barcode, product.isActive, product.createdBy, product.createdAt, product.updatedAt]);
        } else {
            const products = await this.getProducts();
            products.push(product);
            await fs.writeFile(path.join(this.dataDir, 'products.json'), JSON.stringify(products, null, 2));
        }

        return product;
    }

    async updateProduct(id, updateData) {
        if (this.useDatabase) {
            const updates = [];
            const values = [];
            let valueIndex = 1;

            Object.keys(updateData).forEach(key => {
                if (key === 'lowStockAlert') {
                    updates.push(`low_stock_alert = $${valueIndex}`);
                    values.push(updateData[key]);
                } else if (key === 'isActive') {
                    updates.push(`is_active = $${valueIndex}`);
                    values.push(updateData[key]);
                } else if (key === 'createdBy') {
                    updates.push(`created_by = $${valueIndex}`);
                    values.push(updateData[key]);
                } else {
                    updates.push(`${key} = $${valueIndex}`);
                    values.push(updateData[key]);
                }
                valueIndex++;
            });

            updates.push(`updated_at = $${valueIndex}`);
            values.push(new Date());
            values.push(id);

            const result = await this.pool.query(`
                UPDATE products SET ${updates.join(', ')} WHERE _id = $${valueIndex + 1} RETURNING *
            `, values);

            if (result.rows.length === 0) {
                throw new Error('Product not found');
            }

            const row = result.rows[0];
            return {
                _id: row._id,
                name: row.name,
                category: row.category,
                quantity: row.quantity,
                cost: parseFloat(row.cost),
                price: parseFloat(row.price),
                lowStockAlert: row.low_stock_alert,
                description: row.description,
                barcode: row.barcode,
                isActive: row.is_active,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } else {
            const products = await this.getProducts();
            const productIndex = products.findIndex(p => p._id === id);
            if (productIndex === -1) {
                throw new Error('Product not found');
            }

            products[productIndex] = {
                ...products[productIndex],
                ...updateData,
                updatedAt: new Date()
            };

            await fs.writeFile(path.join(this.dataDir, 'products.json'), JSON.stringify(products, null, 2));
            return products[productIndex];
        }
    }

    // RECORDS
    async getRecords() {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM records WHERE is_deleted = false ORDER BY created_at DESC');
            return result.rows.map(row => ({
                _id: row._id,
                client: row.client,
                service: row.service,
                products: row.products,
                hours: row.hours,
                payment: row.payment,
                notes: row.notes,
                subtotal: parseFloat(row.subtotal),
                serviceCharge: parseFloat(row.service_charge),
                tip: parseFloat(row.tip),
                total: parseFloat(row.total),
                cost: parseFloat(row.cost),
                drinksCost: parseFloat(row.drinks_cost),
                profit: parseFloat(row.profit),
                date: row.date,
                isDeleted: row.is_deleted,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } else {
            const data = await fs.readFile(path.join(this.dataDir, 'records.json'), 'utf8');
            return JSON.parse(data);
        }
    }

    async createRecord(recordData) {
        const id = this.generateId();
        const record = {
            _id: id,
            ...recordData,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (this.useDatabase) {
            await this.pool.query(`
                INSERT INTO records (_id, client, service, products, hours, payment, notes, subtotal, service_charge, tip, total, cost, drinks_cost, profit, date, is_deleted, created_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            `, [record._id, record.client, record.service, JSON.stringify(record.products), record.hours, record.payment, record.notes, record.subtotal, record.serviceCharge, record.tip, record.total, record.cost, record.drinksCost, record.profit, record.date, record.isDeleted, record.createdBy, record.createdAt, record.updatedAt]);
        } else {
            const records = await this.getRecords();
            records.push(record);
            await fs.writeFile(path.join(this.dataDir, 'records.json'), JSON.stringify(records, null, 2));
        }

        return record;
    }

    async close() {
        if (this.useDatabase && this.pool) {
            await this.pool.end();
        }
    }
}

module.exports = new Database();