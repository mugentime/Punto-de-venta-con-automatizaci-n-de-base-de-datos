const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');

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

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS cashcuts (
                id SERIAL PRIMARY KEY,
                _id VARCHAR(24) UNIQUE NOT NULL,
                performed_by VARCHAR(24),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                status VARCHAR(20) DEFAULT 'closed',
                opening_amount DECIMAL(10,2) DEFAULT 0,
                closing_amount DECIMAL(10,2),
                expected_amount DECIMAL(10,2) DEFAULT 0,
                opened_by VARCHAR(24),
                opened_at TIMESTAMP,
                closed_by VARCHAR(24),
                closed_at TIMESTAMP,
                entries JSONB DEFAULT '[]',
                sales_summary JSONB DEFAULT '{}',
                product_summary JSONB DEFAULT '[]',
                totals JSONB DEFAULT '{}',
                expected_cash DECIMAL(10,2) DEFAULT 0,
                actual_cash DECIMAL(10,2) DEFAULT 0,
                difference DECIMAL(10,2) DEFAULT 0,
                notes TEXT,
                is_automatic BOOLEAN DEFAULT false,
                is_deleted BOOLEAN DEFAULT false,
                deleted_by VARCHAR(24),
                deleted_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add unique constraint to prevent multiple open cash cuts
        await this.pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_cashcut 
            ON cashcuts (status) 
            WHERE status = 'open' AND is_deleted = false
        `);

        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS coworking_sessions (
                id SERIAL PRIMARY KEY,
                _id VARCHAR(24) UNIQUE NOT NULL,
                client VARCHAR(255) NOT NULL,
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                status VARCHAR(20) DEFAULT 'active',
                hourly_rate DECIMAL(10,2) DEFAULT 58,
                products JSONB DEFAULT '[]',
                notes TEXT,
                subtotal DECIMAL(10,2) DEFAULT 0,
                time_charge DECIMAL(10,2) DEFAULT 0,
                total DECIMAL(10,2) DEFAULT 0,
                cost DECIMAL(10,2) DEFAULT 0,
                profit DECIMAL(10,2) DEFAULT 0,
                payment VARCHAR(50),
                created_by VARCHAR(24),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ PostgreSQL database initialized');
        
        // Create default admin user if no users exist
        await this.createDefaultAdminUser();
    }
    
    async createDefaultAdminUser() {
        if (this.useDatabase) {
            // Check if any users exist
            const result = await this.pool.query('SELECT COUNT(*) FROM users WHERE is_active = true');
            const userCount = parseInt(result.rows[0].count);
            console.log(`📊 Current user count in database: ${userCount}`);
            
            if (userCount === 0) {
                console.log('👤 Creating default admin user...');
                const bcrypt = require('bcryptjs');
                const hashedPassword = await bcrypt.hash('admin123', 12);
                console.log('🔒 Password hashed successfully');
                
                const adminUser = await this.createUser({
                    username: 'admin@conejonegro.com',
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
                console.log('✅ Created admin user:', { 
                    id: adminUser._id, 
                    username: adminUser.username, 
                    role: adminUser.role 
                });
                console.log('🔑 Admin login: admin@conejonegro.com / admin123');
            } else {
                console.log('👥 Users already exist, skipping admin creation');
            }
        }
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

    async getUserById(id) {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM users WHERE _id = $1 AND is_active = true', [id]);
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
            return users.find(u => u._id === id && u.isActive);
        }
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

    async updateRecord(id, updateData) {
        if (this.useDatabase) {
            const updates = [];
            const values = [];
            let valueIndex = 1;

            // Handle different field mappings
            Object.keys(updateData).forEach(key => {
                let dbKey = key;
                let value = updateData[key];

                // Convert camelCase to snake_case for database fields
                switch (key) {
                    case 'serviceCharge':
                        dbKey = 'service_charge';
                        break;
                    case 'drinksCost':
                        dbKey = 'drinks_cost';
                        break;
                    case 'createdBy':
                        dbKey = 'created_by';
                        break;
                    case 'isDeleted':
                        dbKey = 'is_deleted';
                        break;
                    case 'createdAt':
                        dbKey = 'created_at';
                        break;
                    case 'updatedAt':
                        dbKey = 'updated_at';
                        break;
                }

                // Special handling for products (JSON)
                if (key === 'products') {
                    value = JSON.stringify(value);
                }

                if (key !== 'createdAt') { // Don't update created_at
                    updates.push(`${dbKey} = $${valueIndex}`);
                    values.push(value);
                    valueIndex++;
                }
            });

            // Always update updated_at
            if (!updateData.updatedAt) {
                updates.push(`updated_at = $${valueIndex}`);
                values.push(new Date());
                valueIndex++;
            }

            values.push(id);

            const result = await this.pool.query(`
                UPDATE records SET ${updates.join(', ')} WHERE _id = $${valueIndex} RETURNING *
            `, values);

            if (result.rows.length === 0) {
                throw new Error('Record not found');
            }

            const row = result.rows[0];
            return {
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
                drinksCost: parseFloat(row.drinks_cost || 0),
                profit: parseFloat(row.profit),
                date: row.date,
                isDeleted: row.is_deleted,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } else {
            const records = await this.getRecords();
            const recordIndex = records.findIndex(r => r._id === id);
            
            if (recordIndex === -1) {
                throw new Error('Record not found');
            }

            records[recordIndex] = {
                ...records[recordIndex],
                ...updateData,
                updatedAt: new Date()
            };

            await fs.writeFile(path.join(this.dataDir, 'records.json'), JSON.stringify(records, null, 2));
            return records[recordIndex];
        }
    }

    // CASH CUTS
    async getCashCuts(limit = 50) {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM cashcuts WHERE is_deleted = false ORDER BY created_at DESC LIMIT $1', [limit]);
            return result.rows.map(row => ({
                _id: row._id,
                performedBy: row.performed_by,
                startDate: row.start_date,
                endDate: row.end_date,
                salesSummary: row.sales_summary,
                productSummary: row.product_summary,
                totals: row.totals,
                expectedCash: parseFloat(row.expected_cash),
                actualCash: parseFloat(row.actual_cash),
                difference: parseFloat(row.difference),
                notes: row.notes,
                isAutomatic: row.is_automatic,
                isDeleted: row.is_deleted,
                deletedBy: row.deleted_by,
                deletedAt: row.deleted_at,
                createdAt: row.created_at
            }));
        } else {
            const data = await fs.readFile(path.join(this.dataDir, 'cashcuts.json'), 'utf8').catch(() => '[]');
            const cashCuts = JSON.parse(data);
            return cashCuts.filter(c => !c.isDeleted).slice(0, limit);
        }
    }

    async createCashCut(cashCutData) {
        const id = this.generateId();
        const cashCut = {
            _id: id,
            ...cashCutData,
            isDeleted: false,
            createdAt: new Date()
        };

        if (this.useDatabase) {
            await this.pool.query(`
                INSERT INTO cashcuts (_id, performed_by, start_date, end_date, sales_summary, product_summary, totals, expected_cash, actual_cash, difference, notes, is_automatic, is_deleted, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [cashCut._id, cashCut.performedBy, cashCut.startDate, cashCut.endDate, JSON.stringify(cashCut.salesSummary), JSON.stringify(cashCut.productSummary), JSON.stringify(cashCut.totals), cashCut.expectedCash, cashCut.actualCash, cashCut.difference, cashCut.notes, cashCut.isAutomatic, cashCut.isDeleted, cashCut.createdAt]);
        } else {
            const cashCuts = await this.getCashCuts(1000);
            cashCuts.push(cashCut);
            await fs.writeFile(path.join(this.dataDir, 'cashcuts.json'), JSON.stringify(cashCuts, null, 2));
        }

        return cashCut;
    }

    async updateCashCut(id, updateData) {
        if (this.useDatabase) {
            const updates = [];
            const values = [];
            let valueIndex = 1;

            Object.keys(updateData).forEach(key => {
                const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                updates.push(`${dbKey} = $${valueIndex}`);
                values.push(updateData[key]);
                valueIndex++;
            });

            values.push(id);

            const result = await this.pool.query(`
                UPDATE cashcuts SET ${updates.join(', ')} WHERE _id = $${valueIndex} RETURNING *
            `, values);

            if (result.rows.length === 0) {
                throw new Error('Cash cut not found');
            }

            return result.rows[0];
        } else {
            const cashCuts = await this.getCashCuts(1000);
            const cashCutIndex = cashCuts.findIndex(c => c._id === id);
            if (cashCutIndex === -1) {
                throw new Error('Cash cut not found');
            }

            cashCuts[cashCutIndex] = {
                ...cashCuts[cashCutIndex],
                ...updateData
            };

            await fs.writeFile(path.join(this.dataDir, 'cashcuts.json'), JSON.stringify(cashCuts, null, 2));
            return cashCuts[cashCutIndex];
        }
    }

    // COWORKING SESSIONS
    async getCoworkingSessions() {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM coworking_sessions ORDER BY created_at DESC');
            return result.rows.map(row => ({
                _id: row._id,
                client: row.client,
                startTime: row.start_time,
                endTime: row.end_time,
                status: row.status,
                hourlyRate: parseFloat(row.hourly_rate),
                products: row.products,
                notes: row.notes,
                subtotal: parseFloat(row.subtotal),
                timeCharge: parseFloat(row.time_charge),
                total: parseFloat(row.total),
                cost: parseFloat(row.cost),
                profit: parseFloat(row.profit),
                payment: row.payment,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } else {
            const data = await fs.readFile(path.join(this.dataDir, 'coworking_sessions.json'), 'utf8').catch(() => '[]');
            return JSON.parse(data);
        }
    }

    async getActiveCoworkingSessions() {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM coworking_sessions WHERE status = $1 ORDER BY created_at DESC', ['active']);
            return result.rows.map(row => ({
                _id: row._id,
                client: row.client,
                startTime: row.start_time,
                endTime: row.end_time,
                status: row.status,
                hourlyRate: parseFloat(row.hourly_rate),
                products: row.products,
                notes: row.notes,
                subtotal: parseFloat(row.subtotal),
                timeCharge: parseFloat(row.time_charge),
                total: parseFloat(row.total),
                cost: parseFloat(row.cost),
                profit: parseFloat(row.profit),
                payment: row.payment,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } else {
            const sessions = await this.getCoworkingSessions();
            return sessions.filter(s => s.status === 'active');
        }
    }

    async getCoworkingSessionById(id) {
        if (this.useDatabase) {
            const result = await this.pool.query('SELECT * FROM coworking_sessions WHERE _id = $1', [id]);
            if (result.rows.length === 0) return null;
            const row = result.rows[0];
            return {
                _id: row._id,
                client: row.client,
                startTime: row.start_time,
                endTime: row.end_time,
                status: row.status,
                hourlyRate: parseFloat(row.hourly_rate),
                products: row.products,
                notes: row.notes,
                subtotal: parseFloat(row.subtotal),
                timeCharge: parseFloat(row.time_charge),
                total: parseFloat(row.total),
                cost: parseFloat(row.cost),
                profit: parseFloat(row.profit),
                payment: row.payment,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } else {
            const sessions = await this.getCoworkingSessions();
            return sessions.find(s => s._id === id);
        }
    }

    async createCoworkingSession(sessionData) {
        const id = this.generateId();
        const session = {
            _id: id,
            client: sessionData.client,
            startTime: sessionData.startTime || new Date(),
            endTime: sessionData.endTime || null,
            status: sessionData.status || 'active',
            hourlyRate: sessionData.hourlyRate || 58,
            products: sessionData.products || [],
            notes: sessionData.notes || '',
            subtotal: sessionData.subtotal || 0,
            timeCharge: sessionData.timeCharge || 0,
            total: sessionData.total || 0,
            cost: sessionData.cost || 0,
            profit: sessionData.profit || 0,
            payment: sessionData.payment || null,
            createdBy: sessionData.createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (this.useDatabase) {
            await this.pool.query(`
                INSERT INTO coworking_sessions (_id, client, start_time, end_time, status, hourly_rate, products, notes, subtotal, time_charge, total, cost, profit, payment, created_by, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `, [session._id, session.client, session.startTime, session.endTime, session.status, session.hourlyRate, JSON.stringify(session.products), session.notes, session.subtotal, session.timeCharge, session.total, session.cost, session.profit, session.payment, session.createdBy, session.createdAt, session.updatedAt]);
        } else {
            const sessions = await this.getCoworkingSessions();
            sessions.push(session);
            await fs.writeFile(path.join(this.dataDir, 'coworking_sessions.json'), JSON.stringify(sessions, null, 2));
        }

        return session;
    }

    async updateCoworkingSession(id, updateData) {
        if (this.useDatabase) {
            const updates = [];
            const values = [];
            let valueIndex = 1;

            Object.keys(updateData).forEach(key => {
                let dbKey = key;
                let value = updateData[key];

                // Convert camelCase to snake_case for database fields
                switch (key) {
                    case 'startTime':
                        dbKey = 'start_time';
                        break;
                    case 'endTime':
                        dbKey = 'end_time';
                        break;
                    case 'hourlyRate':
                        dbKey = 'hourly_rate';
                        break;
                    case 'timeCharge':
                        dbKey = 'time_charge';
                        break;
                    case 'createdBy':
                        dbKey = 'created_by';
                        break;
                    case 'createdAt':
                        dbKey = 'created_at';
                        break;
                    case 'updatedAt':
                        dbKey = 'updated_at';
                        break;
                }

                // Special handling for products (JSON)
                if (key === 'products') {
                    value = JSON.stringify(value);
                }

                if (key !== 'createdAt') { // Don't update created_at
                    updates.push(`${dbKey} = $${valueIndex}`);
                    values.push(value);
                    valueIndex++;
                }
            });

            // Always update updated_at
            if (!updateData.updatedAt) {
                updates.push(`updated_at = $${valueIndex}`);
                values.push(new Date());
                valueIndex++;
            }

            values.push(id);

            const result = await this.pool.query(`
                UPDATE coworking_sessions SET ${updates.join(', ')} WHERE _id = $${valueIndex} RETURNING *
            `, values);

            if (result.rows.length === 0) {
                throw new Error('Coworking session not found');
            }

            const row = result.rows[0];
            return {
                _id: row._id,
                client: row.client,
                startTime: row.start_time,
                endTime: row.end_time,
                status: row.status,
                hourlyRate: parseFloat(row.hourly_rate),
                products: row.products,
                notes: row.notes,
                subtotal: parseFloat(row.subtotal),
                timeCharge: parseFloat(row.time_charge),
                total: parseFloat(row.total),
                cost: parseFloat(row.cost),
                profit: parseFloat(row.profit),
                payment: row.payment,
                createdBy: row.created_by,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } else {
            const sessions = await this.getCoworkingSessions();
            const sessionIndex = sessions.findIndex(s => s._id === id);
            
            if (sessionIndex === -1) {
                throw new Error('Coworking session not found');
            }

            sessions[sessionIndex] = {
                ...sessions[sessionIndex],
                ...updateData,
                updatedAt: new Date()
            };

            await fs.writeFile(path.join(this.dataDir, 'coworking_sessions.json'), JSON.stringify(sessions, null, 2));
            return sessions[sessionIndex];
        }
    }

    async deleteCoworkingSession(id) {
        if (this.useDatabase) {
            const result = await this.pool.query('DELETE FROM coworking_sessions WHERE _id = $1 RETURNING *', [id]);
            if (result.rows.length === 0) {
                throw new Error('Coworking session not found');
            }
            return true;
        } else {
            const sessions = await this.getCoworkingSessions();
            const sessionIndex = sessions.findIndex(s => s._id === id);
            
            if (sessionIndex === -1) {
                throw new Error('Coworking session not found');
            }

            sessions.splice(sessionIndex, 1);
            await fs.writeFile(path.join(this.dataDir, 'coworking_sessions.json'), JSON.stringify(sessions, null, 2));
            return true;
        }
    }

    // JWT Token Methods
    generateToken(user) {
        // Use environment JWT_SECRET or fallback to hardcoded one for consistency
        const secret = process.env.JWT_SECRET || 'a3aa6a461b5ec2db6ace95b5a9612583d213a8d69df9bf1c1679bcbe8559a8fd';
        
        return jwt.sign(
            {
                userId: user._id,
                email: user.email || user.username,
                role: user.role,
                iat: Math.floor(Date.now() / 1000)
            },
            secret,
            { expiresIn: '7d' }
        );
    }

    verifyToken(token) {
        try {
            // Use environment JWT_SECRET or fallback to hardcoded one for consistency
            const secret = process.env.JWT_SECRET || 'a3aa6a461b5ec2db6ace95b5a9612583d213a8d69df9bf1c1679bcbe8559a8fd';
            return jwt.verify(token, secret);
        } catch (error) {
            return null;
        }
    }

    async close() {
        if (this.useDatabase && this.pool) {
            await this.pool.end();
        }
    }
}

module.exports = new Database();