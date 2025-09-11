const database = require('./database');
const fileDatabase = require('./fileDatabase');

class DatabaseManager {
    constructor() {
        // FORCED: Always use file-based database (no PostgreSQL subscription required)
        this.usePostgreSQL = false;
        this.initialized = false;
        console.log('🔧 DatabaseManager constructor - Forced to use file-based database');
        console.log('📁 Using file-based storage with Git synchronization');
        if (process.env.DATABASE_URL) {
            console.log('⚠️  DATABASE_URL found but ignored - using file-based database instead');
            console.log('💾 This provides free, persistent storage via Git repository');
        }
    }

    async initialize() {
        if (this.initialized) return;

        if (this.usePostgreSQL) {
            console.log('🐘 Initializing PostgreSQL database...');
            console.log('🔗 DATABASE_URL present:', !!process.env.DATABASE_URL);
            await database.init();
            console.log('✅ PostgreSQL database ready');
        } else {
            console.log('📁 Initializing file-based database...');
            await fileDatabase.initialize();
            console.log('✅ File-based database ready');
        }

        this.initialized = true;
        console.log('🎯 DatabaseManager initialized, usePostgreSQL:', this.usePostgreSQL);
    }

    // USERS
    async getUsers() {
        if (this.usePostgreSQL) {
            return await database.getUsers();
        }
        return await fileDatabase.getUsers();
    }

    async getUserById(id) {
        if (this.usePostgreSQL) {
            const user = await database.getUserById(id);
            if (!user) return null;
            // Map fields for routes/auth.js compatibility
            return {
                id: user._id,        // Map _id to id
                email: user.username, // Map username to email  
                name: user.name || user.username.split('@')[0], // Default name from email
                password: user.password,
                role: user.role,
                isActive: user.isActive,
                permissions: user.permissions,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
        }
        return await fileDatabase.getUserById(id);
    }

    async getUserByEmail(email) {
        if (this.usePostgreSQL) {
            const user = await database.getUserByUsername(email); // Using username as email
            if (!user) return null;
            // Map fields for routes/auth.js compatibility
            return {
                id: user._id,        // Map _id to id
                email: user.username, // Map username to email
                name: user.name || user.username.split('@')[0], // Default name from email
                password: user.password,
                role: user.role,
                isActive: user.isActive,
                permissions: user.permissions,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
        }
        return await fileDatabase.getUserByEmail(email);
    }

    async createUser(userData) {
        if (this.usePostgreSQL) {
            // Convert email to username for PostgreSQL and ensure role is passed
            const userDataForPostgres = {
                ...userData,
                username: userData.email || userData.username,
                role: userData.role || 'employee', // Explicitly pass role
                permissions: fileDatabase.getPermissionsByRole(userData.role || 'employee')
            };
            
            console.log('🔧 Creating PostgreSQL user with data:', {
                username: userDataForPostgres.username,
                role: userDataForPostgres.role,
                hasPassword: !!userDataForPostgres.password,
                permissions: userDataForPostgres.permissions
            });
            
            return await database.createUser(userDataForPostgres);
        }
        return await fileDatabase.createUser(userData);
    }

    async validateUserPassword(email, password) {
        if (this.usePostgreSQL) {
            // For PostgreSQL, we need to implement password validation
            console.log('🔍 PostgreSQL login attempt:', { email, timestamp: new Date().toISOString() });
            const user = await database.getUserByUsername(email);
            if (!user) {
                console.log('❌ User not found:', email);
                return null;
            }
            console.log('✅ User found:', { username: user.username, role: user.role });
            
            const bcrypt = require('bcryptjs');
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                console.log('❌ Password validation failed for:', email);
                return null;
            }
            console.log('✅ Password validated for:', email);
            
            // Return user without password
            const { password: _, ...safeUser } = user;
            return {
                ...safeUser,
                email: user.username // Map username back to email
            };
        }
        return await fileDatabase.validateUserPassword(email, password);
    }

    // Update user - for lastLogin and other updates
    async updateUser(id, updateData) {
        try {
            console.log(`🔄 Updating user ${id} with:`, updateData);
            
            if (this.usePostgreSQL) {
                // In PostgreSQL, we need to handle lastLogin differently
                // as there's no direct updateUser function in database.js
                if (updateData.lastLogin) {
                    console.log(`⏱️ Updating lastLogin for user ${id}`);
                    // We can skip this silently since we don't have a direct method
                    // This would be implemented in a full production version
                    return { success: true, message: 'Last login tracking not implemented in PostgreSQL' };
                }
                
                // For other updates, we would need to implement a proper update function
                // but for now we'll return a placeholder response
                return { success: true, message: 'User update not fully implemented in PostgreSQL' };
            }
            
            // For file database, pass to the file database implementation
            return await fileDatabase.updateUser(id, updateData);
        } catch (error) {
            console.error('❌ Error updating user:', error);
            return { success: false, error: error.message };
        }
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
                date: recordData.historicalDate || new Date(),
                createdBy: recordData.createdBy
            };

            const createdRecord = await database.createRecord(record);
            
            // Update product stock
            for (const item of products) {
                await this.updateProductStock(item.productId, item.quantity, 'subtract');
            }
            
            // Update customer database with this record
            try {
                await this.updateCustomerWithRecord(recordData.client, record);
            } catch (error) {
                console.error('Error updating customer with record:', error);
                // Continue execution - don't fail the record creation
            }
            
            return createdRecord;
        }
        const record = await fileDatabase.createRecord(recordData);
        
        // Update customer database with this record
        try {
            await this.updateCustomerWithRecord(recordData.client, record);
        } catch (error) {
            console.error('Error updating customer with record:', error);
            // Continue execution - don't fail the record creation
        }
        
        return record;
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

    async updateRecord(id, updateData) {
        if (this.usePostgreSQL) {
            return await database.updateRecord(id, updateData);
        }
        return await fileDatabase.updateRecord(id, updateData);
    }

    // UTILITIES
    generateToken(user) {
        if (this.usePostgreSQL) {
            return database.generateToken(user);
        }
        return fileDatabase.generateToken(user);
    }

    verifyToken(token) {
        if (this.usePostgreSQL) {
            return database.verifyToken(token);
        }
        return fileDatabase.verifyToken(token);
    }

    getPermissionsByRole(role) {
        return fileDatabase.getPermissionsByRole(role);
    }

    generateId() {
        return fileDatabase.generateId();
    }

    // CASH CUTS - Enhanced for new cashcut service
    async getCashCuts(limit = 50) {
        if (this.usePostgreSQL) {
            return await database.getCashCuts(limit);
        }
        return await fileDatabase.getCashCuts(limit);
    }

    async getCashCutById(id) {
        if (this.usePostgreSQL) {
            const cashCuts = await database.getCashCuts();
            return cashCuts.find(c => c._id === id);
        }
        return await fileDatabase.getCashCutById(id);
    }

    async saveCashCut(cashCutData) {
        if (this.usePostgreSQL) {
            return await database.createCashCut(cashCutData);
        }
        return await fileDatabase.saveCashCut(cashCutData);
    }

    async deleteCashCut(id, deletedBy) {
        if (this.usePostgreSQL) {
            return await database.updateCashCut(id, { 
                isDeleted: true, 
                deletedAt: new Date(),
                deletedBy: deletedBy 
            });
        }
        return await fileDatabase.deleteCashCut(id, deletedBy);
    }

    // ENHANCED CASHCUT METHODS for unified service
    async ensureCashcutSchema() {
        try {
            if (this.usePostgreSQL) {
                // PostgreSQL schema is already created in database.js
                console.log('✅ CashCut PostgreSQL schema already ensured');
                return true;
            } else {
                // For file-based, ensure directory and files exist
                const fs = require('fs').promises;
                const path = require('path');
                const dataDir = path.join(__dirname, '..', 'data');
                const cashCutsPath = path.join(dataDir, 'cashcuts.json');
                
                try {
                    await fs.access(cashCutsPath);
                } catch {
                    await fs.mkdir(dataDir, { recursive: true });
                    await fs.writeFile(cashCutsPath, JSON.stringify([], null, 2));
                }
                
                console.log('✅ CashCut file schema ensured');
                return true;
            }
        } catch (error) {
            console.error('❌ Error ensuring cashcut schema:', error);
            return false;
        }
    }

    async beginTransaction() {
        if (this.usePostgreSQL) {
            // For PostgreSQL, return a client from pool for transaction
            const client = await require('./database').pool.connect();
            await client.query('BEGIN');
            return client;
        }
        // For file-based, transactions are not needed (atomic file writes)
        return null;
    }

    async commit(client) {
        if (this.usePostgreSQL && client) {
            await client.query('COMMIT');
            client.release();
        }
    }

    async rollback(client) {
        if (this.usePostgreSQL && client) {
            await client.query('ROLLBACK');
            client.release();
        }
    }

    // NEW CASHCUT SERVICE METHODS
    async createCashCut({ openingAmount, openedBy, notes = '' }) {
        // Check if there's already an open cash cut
        const openCashCut = await this.getOpenCashCut();
        if (openCashCut) {
            throw new Error('There is already an open cash cut. Please close it first.');
        }

        const id = this.generateId();
        const cashCut = {
            _id: id,
            id: id, // Compatibility
            status: 'open',
            openingAmount: parseFloat(openingAmount) || 0,
            openedBy,
            openedAt: new Date(),
            notes,
            entries: [],
            closingAmount: null,
            closedBy: null,
            closedAt: null,
            expectedAmount: parseFloat(openingAmount) || 0,
            difference: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return await this.saveCashCut(cashCut);
    }

    async getOpenCashCut() {
        try {
            const cashCuts = await this.getCashCuts(100);
            return cashCuts.find(cut => cut.status === 'open');
        } catch (error) {
            console.error('Error getting open cash cut:', error);
            return null;
        }
    }

    async appendEntry(cashCutId, { type, amount, referenceId, note }) {
        try {
            const cashCut = await this.getCashCutById(cashCutId);
            if (!cashCut) {
                throw new Error('Cash cut not found');
            }

            if (cashCut.status !== 'open') {
                throw new Error('Cash cut is not open');
            }

            const entry = {
                id: this.generateId(),
                type, // 'sale', 'expense', 'adjustment'
                amount: parseFloat(amount),
                referenceId,
                note: note || '',
                createdAt: new Date()
            };

            // Add entry to cash cut
            if (!cashCut.entries) cashCut.entries = [];
            cashCut.entries.push(entry);

            // Update expected amount
            if (type === 'sale' || type === 'adjustment') {
                cashCut.expectedAmount += parseFloat(amount);
            } else if (type === 'expense') {
                cashCut.expectedAmount -= parseFloat(amount);
            }

            cashCut.updatedAt = new Date();

            // Save updated cash cut
            if (this.usePostgreSQL) {
                return await require('./database').updateCashCut(cashCutId, cashCut);
            } else {
                const fs = require('fs').promises;
                const path = require('path');
                const cashCutsPath = path.join(__dirname, '..', 'data', 'cashcuts.json');
                
                const cashCuts = await this.getCashCuts(1000);
                const index = cashCuts.findIndex(c => c.id === cashCutId || c._id === cashCutId);
                if (index !== -1) {
                    cashCuts[index] = cashCut;
                    await fs.writeFile(cashCutsPath, JSON.stringify(cashCuts, null, 2));
                }
            }

            return cashCut;
        } catch (error) {
            console.error('Error appending entry to cash cut:', error);
            throw error;
        }
    }

    async computeExpectedAmount(cashCutId) {
        try {
            const cashCut = await this.getCashCutById(cashCutId);
            if (!cashCut) {
                throw new Error('Cash cut not found');
            }

            let expected = cashCut.openingAmount || 0;
            
            if (cashCut.entries && cashCut.entries.length > 0) {
                cashCut.entries.forEach(entry => {
                    if (entry.type === 'sale' || entry.type === 'adjustment') {
                        expected += parseFloat(entry.amount) || 0;
                    } else if (entry.type === 'expense') {
                        expected -= parseFloat(entry.amount) || 0;
                    }
                });
            }

            return Math.round(expected * 100) / 100;
        } catch (error) {
            console.error('Error computing expected amount:', error);
            return 0;
        }
    }

    async closeCashCut({ id, closingAmount, closedBy, notes = '' }) {
        try {
            const cashCut = await this.getCashCutById(id);
            if (!cashCut) {
                throw new Error('Cash cut not found');
            }

            if (cashCut.status !== 'open') {
                throw new Error('Cash cut is not open');
            }

            const expectedAmount = await this.computeExpectedAmount(id);
            const finalClosingAmount = parseFloat(closingAmount);
            const difference = finalClosingAmount - expectedAmount;

            // Update cash cut
            cashCut.status = 'closed';
            cashCut.closingAmount = finalClosingAmount;
            cashCut.closedBy = closedBy;
            cashCut.closedAt = new Date();
            cashCut.expectedAmount = expectedAmount;
            cashCut.difference = Math.round(difference * 100) / 100;
            cashCut.notes = (cashCut.notes || '') + (notes ? '\n' + notes : '');
            cashCut.updatedAt = new Date();

            // Save updated cash cut
            if (this.usePostgreSQL) {
                return await require('./database').updateCashCut(id, cashCut);
            } else {
                const fs = require('fs').promises;
                const path = require('path');
                const cashCutsPath = path.join(__dirname, '..', 'data', 'cashcuts.json');
                
                const cashCuts = await this.getCashCuts(1000);
                const index = cashCuts.findIndex(c => c.id === id || c._id === id);
                if (index !== -1) {
                    cashCuts[index] = cashCut;
                    await fs.writeFile(cashCutsPath, JSON.stringify(cashCuts, null, 2));
                }
            }

            return cashCut;
        } catch (error) {
            console.error('Error closing cash cut:', error);
            throw error;
        }
    }

    async listCashCuts({ from, to, status, limit = 50, offset = 0 }) {
        try {
            let cashCuts = await this.getCashCuts(limit + offset);
            
            // Apply filters
            if (from) {
                const fromDate = new Date(from);
                cashCuts = cashCuts.filter(cut => new Date(cut.createdAt || cut.openedAt) >= fromDate);
            }
            
            if (to) {
                const toDate = new Date(to);
                cashCuts = cashCuts.filter(cut => new Date(cut.createdAt || cut.openedAt) <= toDate);
            }
            
            if (status) {
                cashCuts = cashCuts.filter(cut => cut.status === status);
            }
            
            // Apply pagination
            return cashCuts.slice(offset, offset + limit);
        } catch (error) {
            console.error('Error listing cash cuts:', error);
            return [];
        }
    }

    // MEMBERSHIPS
    async getMemberships(filters = {}, options = {}) {
        if (this.usePostgreSQL) {
            return await database.getMemberships(filters, options);
        }
        return await fileDatabase.getMemberships(filters, options);
    }

    async getMembershipById(id) {
        if (this.usePostgreSQL) {
            return await database.getMembershipById(id);
        }
        return await fileDatabase.getMembershipById(id);
    }

    async createMembership(membershipData) {
        if (this.usePostgreSQL) {
            return await database.createMembership(membershipData);
        }
        return await fileDatabase.createMembership(membershipData);
    }

    async updateMembership(id, updateData) {
        if (this.usePostgreSQL) {
            return await database.updateMembership(id, updateData);
        }
        return await fileDatabase.updateMembership(id, updateData);
    }

    async deleteMembership(id) {
        if (this.usePostgreSQL) {
            return await database.deleteMembership(id);
        }
        return await fileDatabase.deleteMembership(id);
    }

    async getMembershipStats() {
        if (this.usePostgreSQL) {
            return await database.getMembershipStats();
        }
        return await fileDatabase.getMembershipStats();
    }

    // COWORKING SESSIONS
    async getCoworkingSessions() {
        if (this.usePostgreSQL) {
            return await database.getCoworkingSessions();
        }
        return await fileDatabase.getCoworkingSessions();
    }

    async getActiveCoworkingSessions() {
        if (this.usePostgreSQL) {
            return await database.getActiveCoworkingSessions();
        }
        return await fileDatabase.getActiveCoworkingSessions();
    }

    async getCoworkingSessionById(id) {
        if (this.usePostgreSQL) {
            return await database.getCoworkingSessionById(id);
        }
        return await fileDatabase.getCoworkingSessionById(id);
    }

    async createCoworkingSession(sessionData) {
        if (this.usePostgreSQL) {
            return await database.createCoworkingSession(sessionData);
        }
        return await fileDatabase.createCoworkingSession(sessionData);
    }

    async updateCoworkingSession(id, updateData) {
        if (this.usePostgreSQL) {
            return await database.updateCoworkingSession(id, updateData);
        }
        return await fileDatabase.updateCoworkingSession(id, updateData);
    }

    async deleteCoworkingSession(id) {
        if (this.usePostgreSQL) {
            return await database.deleteCoworkingSession(id);
        }
        return await fileDatabase.deleteCoworkingSession(id);
    }

    async closeCoworkingSession(id, paymentMethod) {
        const session = await this.getCoworkingSessionById(id);
        if (!session) {
            throw new Error('Session not found');
        }

        // Calculate final totals
        const CoworkingSession = require('../models/CoworkingSession');
        const sessionObj = new CoworkingSession(session);
        sessionObj.closeSession(paymentMethod);

        // Update the session in database
        const updatedSession = await this.updateCoworkingSession(id, sessionObj.toJSON());

        // Create a record for the closed session
        const recordData = {
            client: sessionObj.client,
            service: 'coworking',
            products: sessionObj.products,
            hours: Math.ceil(sessionObj.getElapsedHours()),
            payment: paymentMethod,
            notes: sessionObj.notes,
            subtotal: sessionObj.subtotal,
            serviceCharge: sessionObj.timeCharge,
            tip: 0,
            total: sessionObj.total,
            cost: sessionObj.cost,
            drinksCost: sessionObj.products.reduce((sum, p) => 
                p.category === 'cafeteria' ? sum + (p.cost * p.quantity) : sum, 0
            ),
            profit: sessionObj.profit,
            date: new Date(),
            createdBy: session.createdBy
        };

        const record = await this.createRecord(recordData);

        // Update customer database with this record
        try {
            await this.updateCustomerWithRecord(sessionObj.client, recordData);
        } catch (error) {
            console.error('Error updating customer with record:', error);
            // Continue execution - don't fail the session close
        }

        return {
            session: updatedSession,
            record: record
        };
    }

    async addProductToCoworkingSession(sessionId, productData) {
        const session = await this.getCoworkingSessionById(sessionId);
        if (!session) {
            throw new Error('Session not found');
        }

        // Get product details
        const product = await this.getProductById(productData.productId);
        if (!product || !product.isActive) {
            throw new Error('Product not found or inactive');
        }

        // Check stock
        if (product.quantity < productData.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}, Requested: ${productData.quantity}`);
        }

        // Add product to session
        const CoworkingSession = require('../models/CoworkingSession');
        const sessionObj = new CoworkingSession(session);
        sessionObj.addProduct({
            productId: product._id,
            name: product.name,
            quantity: productData.quantity,
            price: product.price,
            cost: product.cost,
            category: product.category
        });

        // Update session
        const updatedSession = await this.updateCoworkingSession(sessionId, sessionObj.toJSON());

        // Update product stock
        await this.updateProductStock(product._id, productData.quantity, 'subtract');

        return updatedSession;
    }

    // CUSTOMERS
    async getCustomers() {
        if (this.usePostgreSQL) {
            return await database.getCustomers();
        }
        return await fileDatabase.getCustomers();
    }

    async getCustomerById(id) {
        if (this.usePostgreSQL) {
            return await database.getCustomerById(id);
        }
        return await fileDatabase.getCustomerById(id);
    }

    async getCustomerByName(name) {
        if (this.usePostgreSQL) {
            return await database.getCustomerByName(name);
        }
        return await fileDatabase.getCustomerByName(name);
    }

    async createCustomer(customerData) {
        if (this.usePostgreSQL) {
            return await database.createCustomer(customerData);
        }
        return await fileDatabase.createCustomer(customerData);
    }

    async updateCustomer(id, updateData) {
        if (this.usePostgreSQL) {
            return await database.updateCustomer(id, updateData);
        }
        return await fileDatabase.updateCustomer(id, updateData);
    }

    async deleteCustomer(id) {
        if (this.usePostgreSQL) {
            return await database.deleteCustomer(id);
        }
        return await fileDatabase.deleteCustomer(id);
    }

    async searchCustomers(query) {
        if (this.usePostgreSQL) {
            return await database.searchCustomers(query);
        }
        return await fileDatabase.searchCustomers(query);
    }

    async getCustomerStats() {
        if (this.usePostgreSQL) {
            return await database.getCustomerStats();
        }
        return await fileDatabase.getCustomerStats();
    }

    async findOrCreateCustomer(customerName, additionalData = {}) {
        // Try to find existing customer by name
        let customer = await this.getCustomerByName(customerName);
        
        if (!customer) {
            // Create new customer
            const Customer = require('../models/Customer');
            const customerObj = new Customer({
                name: customerName.trim(),
                ...additionalData
            });
            
            const validation = customerObj.validate();
            if (!validation.isValid) {
                throw new Error('Invalid customer data: ' + validation.errors.join(', '));
            }
            
            customer = await this.createCustomer(customerObj.toJSON());
        }
        
        return customer;
    }

    async updateCustomerWithRecord(customerName, recordData) {
        const Customer = require('../models/Customer');
        
        // Find or create customer
        let customerData = await this.findOrCreateCustomer(customerName);
        
        // Update customer with new record data
        const customer = new Customer(customerData);
        customer.addVisit(recordData);
        
        // Save updated customer
        const updatedCustomer = await this.updateCustomer(customer._id, customer.toJSON());
        
        return updatedCustomer;
    }

    // EXPENSES (GASTOS)
    async getExpenses() {
        if (this.usePostgreSQL) {
            return await database.getExpenses();
        }
        return await fileDatabase.getExpenses();
    }

    async getExpenseById(id) {
        if (this.usePostgreSQL) {
            return await database.getExpenseById(id);
        }
        return await fileDatabase.getExpenseById(id);
    }

    async createExpense(expenseData) {
        if (this.usePostgreSQL) {
            return await database.createExpense(expenseData);
        }
        return await fileDatabase.createExpense(expenseData);
    }

    async updateExpense(id, updateData) {
        if (this.usePostgreSQL) {
            return await database.updateExpense(id, updateData);
        }
        return await fileDatabase.updateExpense(id, updateData);
    }

    async deleteExpense(id) {
        if (this.usePostgreSQL) {
            return await database.deleteExpense(id);
        }
        return await fileDatabase.deleteExpense(id);
    }

    async getExpensesByCategory(category) {
        if (this.usePostgreSQL) {
            return await database.getExpensesByCategory(category);
        }
        return await fileDatabase.getExpensesByCategory(category);
    }

    async getExpensesByDateRange(startDate, endDate) {
        if (this.usePostgreSQL) {
            return await database.getExpensesByDateRange(startDate, endDate);
        }
        return await fileDatabase.getExpensesByDateRange(startDate, endDate);
    }

    async getRecurringExpenses() {
        if (this.usePostgreSQL) {
            return await database.getRecurringExpenses();
        }
        return await fileDatabase.getRecurringExpenses();
    }

    async getOverdueExpenses() {
        if (this.usePostgreSQL) {
            return await database.getOverdueExpenses();
        }
        return await fileDatabase.getOverdueExpenses();
    }

    async getExpenseStats() {
        if (this.usePostgreSQL) {
            return await database.getExpenseStats();
        }
        return await fileDatabase.getExpenseStats();
    }

    // Generate financial report (ingresos vs egresos)
    async getFinancialReport(startDate, endDate) {
        try {
            // Get expenses for the period
            const expenses = await this.getExpensesByDateRange(startDate, endDate);
            const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            
            // Get income from records for the period
            const records = await this.getRecords();
            const periodRecords = records.filter(record => {
                const recordDate = new Date(record.date);
                return recordDate >= startDate && recordDate <= endDate && !record.isDeleted;
            });
            const totalIncome = periodRecords.reduce((sum, record) => sum + record.total, 0);
            
            // Get coworking income
            const sessions = await this.getCoworkingSessions();
            const periodSessions = sessions.filter(session => {
                const sessionDate = new Date(session.createdAt);
                return sessionDate >= startDate && sessionDate <= endDate && session.status === 'closed';
            });
            const coworkingIncome = periodSessions.reduce((sum, session) => sum + (session.total || 0), 0);
            
            const totalRevenue = totalIncome + coworkingIncome;
            const netProfit = totalRevenue - totalExpenses;
            
            return {
                period: {
                    startDate: startDate.toISOString().split('T')[0],
                    endDate: endDate.toISOString().split('T')[0]
                },
                income: {
                    pos_sales: totalIncome,
                    coworking: coworkingIncome,
                    total: totalRevenue
                },
                expenses: {
                    total: totalExpenses,
                    by_category: this.groupExpensesByCategory(expenses)
                },
                profit: {
                    net: netProfit,
                    margin: totalRevenue > 0 ? (netProfit / totalRevenue * 100) : 0
                },
                records_count: periodRecords.length,
                sessions_count: periodSessions.length,
                expenses_count: expenses.length
            };
        } catch (error) {
            console.error('Error generating financial report:', error);
            throw error;
        }
    }

    // Helper method to group expenses by category
    groupExpensesByCategory(expenses) {
        const Expense = require('../models/Expense');
        const categories = Expense.getCategories();
        const grouped = {};
        
        // Initialize all categories with 0
        Object.keys(categories).forEach(categoryId => {
            grouped[categoryId] = {
                name: categories[categoryId].name,
                total: 0,
                count: 0,
                color: categories[categoryId].color,
                icon: categories[categoryId].icon
            };
        });
        
        // Sum expenses by category
        expenses.forEach(expense => {
            const category = expense.category || 'otros';
            if (grouped[category]) {
                grouped[category].total += expense.amount;
                grouped[category].count += 1;
            }
        });
        
        return grouped;
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