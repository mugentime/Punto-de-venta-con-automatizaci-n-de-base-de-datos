/**
 * @fileoverview Optimized Database Manager for Railway Deployment
 * @description Memory-efficient file-based database operations with connection pooling
 * @author Performance Optimization Team
 * @version 1.0.0
 * @created 2025-09-11
 */

const fs = require('fs').promises;
const path = require('path');
const { FileSystemOptimizer, RAILWAY_OPTIMIZATION } = require('../config/railway-optimization');

/**
 * Optimized Database Manager for Railway deployment
 * Focuses on memory efficiency and performance for file-based operations
 */
class OptimizedDatabaseManager {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.fsOptimizer = new FileSystemOptimizer();
        this.initialized = false;
        
        // Remove PostgreSQL dependencies completely
        console.log('🚀 Initializing optimized file-based database for Railway...');
        console.log('💾 Memory-efficient operations enabled');
        console.log('🔧 Connection pooling configured');
    }

    async initialize() {
        if (this.initialized) return;

        console.log('📁 Initializing optimized file system...');
        
        // Ensure data directory exists
        try {
            await fs.access(this.dataDir);
        } catch {
            await fs.mkdir(this.dataDir, { recursive: true });
            console.log('📂 Data directory created');
        }

        // Initialize data files with error handling
        const dataFiles = [
            'users.json',
            'products.json', 
            'records.json',
            'cashcuts.json',
            'coworking_sessions.json',
            'customers.json',
            'memberships.json',
            'expenses.json'
        ];

        for (const file of dataFiles) {
            const filePath = path.join(this.dataDir, file);
            try {
                await fs.access(filePath);
            } catch {
                await fs.writeFile(filePath, JSON.stringify([], null, 2));
                console.log(`📄 Created ${file}`);
            }
        }

        this.initialized = true;
        console.log('✅ Optimized database initialized');

        // Start automatic cache cleanup
        this.startCacheCleanup();
    }

    /**
     * Start automatic cache cleanup interval
     */
    startCacheCleanup() {
        setInterval(() => {
            this.fsOptimizer.cleanupCache();
        }, RAILWAY_OPTIMIZATION.FILE_SYSTEM.CACHE_TTL);
    }

    /**
     * Generate unique ID optimized for memory
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Read JSON file with connection pooling and caching
     */
    async readJsonFile(fileName, options = {}) {
        const filePath = path.join(this.dataDir, fileName);
        const connection = await this.fsOptimizer.acquireConnection();
        
        try {
            const data = await connection.readFile(filePath, options);
            return JSON.parse(data || '[]');
        } catch (error) {
            console.error(`Error reading ${fileName}:`, error.message);
            return [];
        }
    }

    /**
     * Write JSON file with connection pooling
     */
    async writeJsonFile(fileName, data, options = {}) {
        const filePath = path.join(this.dataDir, fileName);
        const connection = await this.fsOptimizer.acquireConnection();
        
        try {
            const jsonData = JSON.stringify(data, null, 2);
            await connection.writeFile(filePath, jsonData, options);
        } catch (error) {
            console.error(`Error writing ${fileName}:`, error.message);
            throw error;
        }
    }

    /**
     * Get paginated data to reduce memory usage
     */
    async getPaginatedData(fileName, limit = 50, offset = 0) {
        const allData = await this.readJsonFile(fileName);
        const totalCount = allData.length;
        const paginatedData = allData.slice(offset, offset + limit);
        
        return {
            data: paginatedData,
            pagination: {
                limit,
                offset,
                total: totalCount,
                hasMore: offset + limit < totalCount
            }
        };
    }

    // ============================
    // USER OPERATIONS (Optimized)
    // ============================

    async getUsers(limit, offset) {
        if (limit !== undefined) {
            return this.getPaginatedData('users.json', limit, offset);
        }
        return this.readJsonFile('users.json');
    }

    async getUserById(id) {
        const users = await this.readJsonFile('users.json');
        return users.find(user => user._id === id && user.isActive !== false);
    }

    async getUserByEmail(email) {
        const users = await this.readJsonFile('users.json');
        return users.find(user => user.email === email && user.isActive !== false);
    }

    async createUser(userData) {
        const users = await this.readJsonFile('users.json');
        
        const user = {
            _id: this.generateId(),
            ...userData,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        users.push(user);
        await this.writeJsonFile('users.json', users);
        
        console.log(`👤 Created user: ${user.email || user.username}`);
        return user;
    }

    async updateUser(id, updateData) {
        const users = await this.readJsonFile('users.json');
        const userIndex = users.findIndex(user => user._id === id);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }

        users[userIndex] = {
            ...users[userIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile('users.json', users);
        return users[userIndex];
    }

    async validateUserPassword(email, password) {
        const user = await this.getUserByEmail(email);
        if (!user) return null;

        const bcrypt = require('bcryptjs');
        const isValid = await bcrypt.compare(password, user.password);
        
        if (isValid) {
            // Don't return password
            const { password: _, ...safeUser } = user;
            return safeUser;
        }
        
        return null;
    }

    // ===============================
    // PRODUCT OPERATIONS (Optimized)
    // ===============================

    async getProducts(limit, offset) {
        if (limit !== undefined) {
            return this.getPaginatedData('products.json', limit, offset);
        }
        const products = await this.readJsonFile('products.json');
        return products.filter(product => product.isActive !== false);
    }

    async getProductById(id) {
        const products = await this.readJsonFile('products.json');
        return products.find(product => product._id === id && product.isActive !== false);
    }

    async createProduct(productData) {
        const products = await this.readJsonFile('products.json');
        
        const product = {
            _id: this.generateId(),
            ...productData,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        products.push(product);
        await this.writeJsonFile('products.json', products);
        
        console.log(`📦 Created product: ${product.name}`);
        return product;
    }

    async updateProduct(id, updateData) {
        const products = await this.readJsonFile('products.json');
        const productIndex = products.findIndex(product => product._id === id);
        
        if (productIndex === -1) {
            throw new Error('Product not found');
        }

        products[productIndex] = {
            ...products[productIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile('products.json', products);
        return products[productIndex];
    }

    async updateProductStock(id, quantity, operation = 'set') {
        const product = await this.getProductById(id);
        if (!product) throw new Error('Product not found');

        let newQuantity;
        switch (operation) {
            case 'add':
                newQuantity = product.quantity + quantity;
                break;
            case 'subtract':
                newQuantity = Math.max(0, product.quantity - quantity);
                break;
            default:
                newQuantity = Math.max(0, quantity);
        }

        return this.updateProduct(id, { quantity: newQuantity });
    }

    async deleteProduct(id) {
        return this.updateProduct(id, { isActive: false });
    }

    // ==============================
    // RECORD OPERATIONS (Optimized)
    // ==============================

    async getRecords(limit, offset) {
        if (limit !== undefined) {
            return this.getPaginatedData('records.json', limit, offset);
        }
        const records = await this.readJsonFile('records.json');
        return records.filter(record => record.isDeleted !== true);
    }

    async getRecordById(id) {
        const records = await this.readJsonFile('records.json');
        return records.find(record => record._id === id && record.isDeleted !== true);
    }

    async createRecord(recordData) {
        const records = await this.readJsonFile('records.json');

        // Calculate totals
        const products = recordData.products || [];
        let totalCost = 0;
        let totalPrice = 0;

        for (const item of products) {
            totalCost += (item.cost * item.quantity);
            
            if (recordData.service === 'coworking') {
                if (item.category === 'refrigerador') {
                    totalPrice += (item.price * item.quantity);
                }
            } else {
                totalPrice += (item.price * item.quantity);
            }
        }

        let subtotal = totalPrice;
        let serviceCharge = 0;

        if (recordData.service === 'coworking') {
            const coworkingRate = 58;
            serviceCharge = coworkingRate * (recordData.hours || 1);
        }

        const tip = parseFloat(recordData.tip) || 0;
        const total = subtotal + serviceCharge + tip;

        const drinksCost = recordData.service === 'coworking' 
            ? products.reduce((sum, item) => {
                return item.category === 'cafeteria' 
                    ? sum + (item.cost * item.quantity) 
                    : sum;
              }, 0)
            : 0;

        const record = {
            _id: this.generateId(),
            client: recordData.client,
            service: recordData.service,
            products: products,
            hours: recordData.hours || 1,
            payment: recordData.payment,
            notes: recordData.notes || '',
            subtotal: subtotal,
            serviceCharge: serviceCharge,
            tip: tip,
            total: total,
            cost: totalCost,
            drinksCost: drinksCost,
            profit: total - totalCost,
            date: recordData.historicalDate || new Date(),
            isDeleted: false,
            createdBy: recordData.createdBy,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        records.push(record);
        await this.writeJsonFile('records.json', records);

        // Update product stock
        for (const item of products) {
            try {
                await this.updateProductStock(item.productId, item.quantity, 'subtract');
            } catch (error) {
                console.error(`Failed to update stock for ${item.productId}:`, error.message);
            }
        }

        console.log(`📝 Created record for ${record.client}: $${record.total}`);
        return record;
    }

    async updateRecord(id, updateData) {
        const records = await this.readJsonFile('records.json');
        const recordIndex = records.findIndex(record => record._id === id);
        
        if (recordIndex === -1) {
            throw new Error('Record not found');
        }

        records[recordIndex] = {
            ...records[recordIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile('records.json', records);
        return records[recordIndex];
    }

    async deleteRecord(id, deletedBy) {
        return this.updateRecord(id, {
            isDeleted: true,
            deletedBy: deletedBy,
            deletedAt: new Date().toISOString()
        });
    }

    // ===============================
    // JWT TOKEN METHODS (Optimized)
    // ===============================

    generateToken(user) {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
        
        const jwt = require('jsonwebtoken');
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
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error('JWT_SECRET environment variable not set');
                return null;
            }
            const jwt = require('jsonwebtoken');
            return jwt.verify(token, secret);
        } catch (error) {
            return null;
        }
    }

    // ================================
    // PERFORMANCE MONITORING METHODS
    // ================================

    /**
     * Get database performance statistics
     */
    getPerformanceStats() {
        return {
            fileSystemPool: this.fsOptimizer.getPoolStats(),
            cacheHitRate: this.calculateCacheHitRate(),
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }

    /**
     * Calculate cache hit rate
     */
    calculateCacheHitRate() {
        // This would need to be implemented with actual hit/miss tracking
        return {
            hits: 0,
            misses: 0,
            ratio: 0
        };
    }

    /**
     * Get file system health status
     */
    async getHealthStatus() {
        try {
            await fs.access(this.dataDir);
            const stats = this.getPerformanceStats();
            
            return {
                status: 'healthy',
                dataDirectory: this.dataDir,
                filesystemOptimized: true,
                connectionPooling: true,
                caching: true,
                performance: stats
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Close database connections and cleanup
     */
    async close() {
        // File-based system doesn't need connection closing
        // but we can cleanup cache and pools
        this.fsOptimizer.cache.clear();
        console.log('🔒 Optimized database manager closed');
    }
}

// Export singleton instance
const optimizedDatabaseManager = new OptimizedDatabaseManager();
module.exports = optimizedDatabaseManager;