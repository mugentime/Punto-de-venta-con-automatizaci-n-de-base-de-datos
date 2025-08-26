const database = require('./database');
const fileDatabase = require('./fileDatabase');

class DatabaseManager {
    constructor() {
        this.usePostgreSQL = !!process.env.DATABASE_URL;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        if (this.usePostgreSQL) {
            console.log('🐘 Initializing PostgreSQL database...');
            await database.init();
            console.log('✅ PostgreSQL database ready');
        } else {
            console.log('📁 Initializing file-based database...');
            await fileDatabase.initialize();
            console.log('✅ File-based database ready');
        }

        this.initialized = true;
    }

    // USERS
    async getUsers() {
        if (this.usePostgreSQL) {
            return await database.getUsers();
        }
        return await fileDatabase.getUsers();
    }

    async getUserByEmail(email) {
        if (this.usePostgreSQL) {
            return await database.getUserByUsername(email); // Using username as email
        }
        return await fileDatabase.getUserByEmail(email);
    }

    async createUser(userData) {
        if (this.usePostgreSQL) {
            // Convert email to username for PostgreSQL
            return await database.createUser({
                ...userData,
                username: userData.email,
                permissions: fileDatabase.getPermissionsByRole(userData.role || 'employee')
            });
        }
        return await fileDatabase.createUser(userData);
    }

    async validateUserPassword(email, password) {
        if (this.usePostgreSQL) {
            // For PostgreSQL, we need to implement password validation
            const user = await database.getUserByUsername(email);
            if (!user) return null;
            
            const bcrypt = require('bcryptjs');
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) return null;
            
            // Return user without password
            const { password: _, ...safeUser } = user;
            return {
                ...safeUser,
                email: user.username // Map username back to email
            };
        }
        return await fileDatabase.validateUserPassword(email, password);
    }

    // PRODUCTS
    async getProducts() {
        if (this.usePostgreSQL) {
            return await database.getProducts();
        }
        return await fileDatabase.getProducts();
    }

    async getProductById(id) {
        if (this.usePostgreSQL) {
            const products = await database.getProducts();
            return products.find(p => p._id === id);
        }
        return await fileDatabase.getProductById(id);
    }

    async createProduct(productData) {
        if (this.usePostgreSQL) {
            return await database.createProduct(productData);
        }
        return await fileDatabase.createProduct(productData);
    }

    async updateProduct(id, updateData) {
        if (this.usePostgreSQL) {
            return await database.updateProduct(id, updateData);
        }
        return await fileDatabase.updateProduct(id, updateData);
    }

    async updateProductStock(id, quantity, operation = 'set') {
        if (this.usePostgreSQL) {
            // Implement stock update logic for PostgreSQL
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
                default: // set
                    newQuantity = Math.max(0, quantity);
            }
            
            return await database.updateProduct(id, { quantity: newQuantity });
        }
        return await fileDatabase.updateProductStock(id, quantity, operation);
    }

    async deleteProduct(id) {
        if (this.usePostgreSQL) {
            return await database.updateProduct(id, { isActive: false });
        }
        return await fileDatabase.deleteProduct(id);
    }

    // RECORDS
    async getRecords() {
        if (this.usePostgreSQL) {
            return await database.getRecords();
        }
        return await fileDatabase.getRecords();
    }

    async getRecordById(id) {
        if (this.usePostgreSQL) {
            const records = await database.getRecords();
            return records.find(r => r._id === id);
        }
        return await fileDatabase.getRecordById(id);
    }

    async createRecord(recordData) {
        if (this.usePostgreSQL) {
            // Process record data similar to fileDatabase logic
            const products = recordData.products || [];
            let totalCost = 0;
            let totalPrice = 0;
            
            for (const item of products) {
                totalCost += (item.cost * item.quantity);
                
                // Apply coworking logic for pricing
                if (recordData.service === 'coworking') {
                    // Only charge refrigerator items in coworking
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
            
            // Calculate drinks cost (only cafeteria items for coworking)
            let drinksCost = 0;
            if (recordData.service === 'coworking') {
                drinksCost = products.reduce((sum, item) => {
                    if (item.category === 'cafeteria') {
                        return sum + (item.cost * item.quantity);
                    }
                    return sum;
                }, 0);
            }

            const record = {
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
                date: new Date(),
                createdBy: recordData.createdBy
            };

            const createdRecord = await database.createRecord(record);
            
            // Update product stock
            for (const item of products) {
                await this.updateProductStock(item.productId, item.quantity, 'subtract');
            }
            
            return createdRecord;
        }
        return await fileDatabase.createRecord(recordData);
    }

    async deleteRecord(id, deletedBy) {
        if (this.usePostgreSQL) {
            const record = await this.getRecordById(id);
            if (!record) throw new Error('Record not found');
            
            // Mark as deleted (soft delete)
            // Note: This would need to be implemented in the database module
            // For now, we'll throw an error as this needs DB schema changes
            throw new Error('Soft delete not yet implemented for PostgreSQL');
        }
        return await fileDatabase.deleteRecord(id, deletedBy);
    }

    // UTILITIES
    generateToken(user) {
        return fileDatabase.generateToken(user);
    }

    verifyToken(token) {
        return fileDatabase.verifyToken(token);
    }

    getPermissionsByRole(role) {
        return fileDatabase.getPermissionsByRole(role);
    }

    generateId() {
        return fileDatabase.generateId();
    }

    async close() {
        if (this.usePostgreSQL) {
            await database.close();
        }
    }
}

// Export singleton instance
const databaseManager = new DatabaseManager();
module.exports = databaseManager;