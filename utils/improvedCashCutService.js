/**
 * @deprecated This service is being replaced by the unified module at src/modules/cashcut
 * This file now exports the unified service for backwards compatibility
 */

// Redirect to unified module
const unifiedModule = require('../src/modules/cashcut');
module.exports = unifiedModule.service;
    constructor() {
        this.processingCuts = new Map(); // Track cuts being processed
        this.recentCuts = new Map(); // Cache recent cuts to prevent duplicates
        this.cutHistory = new Map(); // Store idempotency mappings
        console.log('🔧 TaskMaster: ImprovedCashCutService initialized with duplicate prevention');
    }

    /**
     * 🔧 TaskMaster: Generate idempotency key
     */
    generateIdempotencyKey(userId, notes) {
        const timestamp = Math.floor(Date.now() / (1000 * 60)); // Round to minute
        const payload = `${userId}_manual_${timestamp}_${notes}`;
        return require('crypto').createHash('sha256').update(payload).digest('hex').substring(0, 16);
    }

    /**
     * 🔒 TaskMaster: Check if operation is already in progress
     */
    isOperationInProgress(key) {
        return this.processingCuts.has(key);
    }

    /**
     * 🔍 TaskMaster: Check for existing cash cut
     */
    async getExistingCashCut(idempotencyKey) {
        try {
            // First check cache
            if (this.cutHistory.has(idempotencyKey)) {
                const cashCutId = this.cutHistory.get(idempotencyKey);
                console.log(`✅ TaskMaster: Found cached cash cut: ${cashCutId}`);
                return await this.getCashCutById(cashCutId);
            }

            // Check file storage
            const cashCuts = await this.getCashCutsFromFile();
            const existing = cashCuts.find(cut => cut.idempotencyKey === idempotencyKey);
            
            if (existing) {
                // Cache for future lookups
                this.cutHistory.set(idempotencyKey, existing.id);
                console.log(`✅ TaskMaster: Found existing cash cut: ${existing.id}`);
                return existing;
            }

            return null;
        } catch (error) {
            console.error('Error checking existing cash cut:', error.message);
            return null;
        }
    }

    /**
     * 🔄 TaskMaster: Protected manual cash cut
     */
    async triggerManualCut(userId, notes = '') {
        const idempotencyKey = this.generateIdempotencyKey(userId, notes);
        
        console.log(`🔧 TaskMaster: Processing manual cut - Key: ${idempotencyKey}`);

        // Check if already exists
        const existing = await this.getExistingCashCut(idempotencyKey);
        if (existing) {
            console.log(`🔄 TaskMaster: Returning existing cash cut: ${existing.id}`);
            return existing;
        }

        // Check if operation is in progress
        if (this.isOperationInProgress(idempotencyKey)) {
            console.log(`⏳ TaskMaster: Operation in progress, waiting...`);
            // Wait for completion and return result
            return await this.waitForCompletion(idempotencyKey);
        }

        // Mark operation as in progress
        this.processingCuts.set(idempotencyKey, {
            userId,
            notes,
            startTime: new Date(),
            status: 'processing'
        });

        try {
            // Perform the actual cash cut
            const cashCut = await this.performActualCashCut(userId, notes, idempotencyKey);
            
            // Store in history for duplicate prevention
            this.cutHistory.set(idempotencyKey, cashCut.id);
            
            // Mark as completed
            this.processingCuts.set(idempotencyKey, {
                ...this.processingCuts.get(idempotencyKey),
                status: 'completed',
                result: cashCut,
                endTime: new Date()
            });

            console.log(`✅ TaskMaster: New cash cut created: ${cashCut.id}`);
            return cashCut;

        } catch (error) {
            // Mark as failed
            this.processingCuts.set(idempotencyKey, {
                ...this.processingCuts.get(idempotencyKey),
                status: 'failed',
                error: error.message,
                endTime: new Date()
            });

            console.error(`❌ TaskMaster: Cash cut failed:`, error.message);
            throw error;

        } finally {
            // Clean up after 5 minutes
            setTimeout(() => {
                this.processingCuts.delete(idempotencyKey);
            }, 5 * 60 * 1000);
        }
    }

    /**
     * ⏳ TaskMaster: Wait for operation completion
     */
    async waitForCompletion(idempotencyKey, maxWaitMs = 30000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitMs) {
            const operation = this.processingCuts.get(idempotencyKey);
            
            if (operation && operation.status === 'completed') {
                return operation.result;
            }
            
            if (operation && operation.status === 'failed') {
                throw new Error(`Previous operation failed: ${operation.error}`);
            }

            // Wait 100ms before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        throw new Error('Operation timeout - cash cut taking too long');
    }

    /**
     * 💰 TaskMaster: Perform actual cash cut (original logic)
     */
    async performActualCashCut(userId, notes, idempotencyKey) {
        const cutDate = new Date();
        
        // Get records for the period (simplified for immediate fix)
        const records = await this.getRecordsForPeriod();
        
        // Calculate statistics
        const stats = this.calculatePeriodStats(records);
        
        // Create cash cut data with TaskMaster protection
        const cashCutData = {
            cutDate,
            cutTime: cutDate.toLocaleTimeString('es-MX', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            }),
            startDate: new Date(cutDate.getTime() - (12 * 60 * 60 * 1000)), // Last 12 hours
            endDate: cutDate,
            cutType: 'manual',
            totalRecords: stats.totalRecords,
            totalIncome: Math.round(stats.totalIncome * 100) / 100,
            totalCost: Math.round(stats.totalCost * 100) / 100,
            totalProfit: Math.round((stats.totalIncome - stats.totalCost) * 100) / 100,
            averageTicket: stats.totalRecords > 0 ? Math.round((stats.totalIncome / stats.totalRecords) * 100) / 100 : 0,
            paymentBreakdown: stats.paymentBreakdown,
            serviceBreakdown: stats.serviceBreakdown,
            topProducts: stats.topProducts,
            hourlyBreakdown: stats.hourlyBreakdown,
            notes,
            createdBy: userId,
            id: this.generateId(),
            // TaskMaster metadata
            idempotencyKey,
            taskMasterProtected: true,
            createdByTaskMaster: new Date().toISOString()
        };

        // Save the cash cut
        await this.saveCashCutToFile(cashCutData);
        
        console.log(`💰 TaskMaster: Cash cut completed: ${stats.totalRecords} records, $${stats.totalIncome} income, $${stats.totalIncome - stats.totalCost} profit`);
        
        return cashCutData;
    }

    /**
     * 📊 Calculate period statistics
     */
    calculatePeriodStats(records) {
        const stats = {
            totalRecords: records.length,
            totalIncome: 0,
            totalCost: 0,
            paymentBreakdown: {
                efectivo: { count: 0, amount: 0 },
                tarjeta: { count: 0, amount: 0 },
                transferencia: { count: 0, amount: 0 }
            },
            serviceBreakdown: {
                cafeteria: { count: 0, amount: 0 },
                coworking: { count: 0, amount: 0 }
            },
            topProducts: [],
            hourlyBreakdown: []
        };

        const productStats = {};
        const hourlyStats = {};

        records.forEach(record => {
            stats.totalIncome += record.total || 0;
            stats.totalCost += record.cost || 0;
            
            // Payment breakdown
            if (stats.paymentBreakdown[record.payment]) {
                stats.paymentBreakdown[record.payment].count++;
                stats.paymentBreakdown[record.payment].amount += record.total || 0;
            }
            
            // Service breakdown
            if (stats.serviceBreakdown[record.service]) {
                stats.serviceBreakdown[record.service].count++;
                stats.serviceBreakdown[record.service].amount += record.total || 0;
            }
            
            // Product statistics
            const productKey = record.drink || 'Unknown';
            if (!productStats[productKey]) {
                productStats[productKey] = {
                    productName: productKey,
                    quantity: 0,
                    revenue: 0
                };
            }
            productStats[productKey].quantity++;
            productStats[productKey].revenue += record.total || 0;
            
            // Hourly breakdown
            const recordDate = new Date(record.date);
            const hour = recordDate.getHours().toString().padStart(2, '0') + ':00';
            if (!hourlyStats[hour]) {
                hourlyStats[hour] = { count: 0, revenue: 0 };
            }
            hourlyStats[hour].count++;
            hourlyStats[hour].revenue += record.total || 0;
        });

        // Convert to arrays
        stats.topProducts = Object.values(productStats)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        stats.hourlyBreakdown = Object.keys(hourlyStats)
            .sort()
            .map(hour => ({
                hour,
                count: hourlyStats[hour].count,
                revenue: Math.round(hourlyStats[hour].revenue * 100) / 100
            }));

        return stats;
    }

    /**
     * 📋 Get records for period
     */
    async getRecordsForPeriod() {
        try {
            const allRecords = await databaseManager.getRecords();
            // Get records from last 12 hours or all if no timestamp filter
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
            return allRecords.filter(record => {
                if (!record.date) return true; // Include records without date
                const recordDate = new Date(record.date);
                return recordDate >= twelveHoursAgo && !record.isDeleted;
            });
        } catch (error) {
            console.error('Error getting records:', error);
            return [];
        }
    }

    /**
     * 💾 Save cash cut to file
     */
    async saveCashCutToFile(cashCutData) {
        const dataDir = path.join(__dirname, '..', 'data');
        const cashCutsPath = path.join(dataDir, 'cashcuts.json');
        
        try {
            // Ensure data directory exists
            await fs.mkdir(dataDir, { recursive: true });
            
            let cashCuts = [];
            try {
                const data = await fs.readFile(cashCutsPath, 'utf8');
                cashCuts = JSON.parse(data);
            } catch (error) {
                // File doesn't exist yet
                cashCuts = [];
            }
            
            cashCuts.push(cashCutData);
            
            await fs.writeFile(cashCutsPath, JSON.stringify(cashCuts, null, 2));
            console.log(`💾 TaskMaster: Cash cut saved: ${cashCutData.id}`);
        } catch (error) {
            console.error('Error saving cash cut:', error);
            throw error;
        }
    }

    /**
     * 📖 Get cash cuts from file
     */
    async getCashCutsFromFile() {
        const cashCutsPath = path.join(__dirname, '..', 'data', 'cashcuts.json');
        
        try {
            const data = await fs.readFile(cashCutsPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    /**
     * 🔍 Get cash cut by ID
     */
    async getCashCutById(id) {
        const cashCuts = await this.getCashCutsFromFile();
        return cashCuts.find(cut => cut.id === id);
    }

    /**
     * 🆔 Generate unique ID
     */
    generateId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 📊 Get service status
     */
    getStatus() {
        return {
            processingCuts: this.processingCuts.size,
            cachedCuts: this.cutHistory.size,
            taskMasterActive: true,
            version: '1.0.0'
        };
    }
}

module.exports = new ImprovedCashCutService();
