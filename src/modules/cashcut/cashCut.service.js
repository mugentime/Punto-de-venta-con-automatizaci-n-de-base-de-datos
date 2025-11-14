/**
 * Servicio Unificado de Corte de Caja - TaskMaster Integration
 * 🔧 TaskMaster: Unified Cash Cut Service with Duplicate Prevention
 */

const databaseManager = require('../../../utils/databaseManager');
const fs = require('fs').promises;
const path = require('path');

// Make node-cron optional - fallback to manual scheduling if not available
let cron;
try {
    cron = require('node-cron');
    console.log('✅ node-cron loaded successfully');
} catch (error) {
    console.warn('⚠️  node-cron not available, automated scheduling disabled');
    cron = null;
}

class CashCutService {
    constructor() {
        this.initialized = false;
        this.processingCuts = new Map(); // Track cuts being processed
        this.recentCuts = new Map(); // Cache recent cuts to prevent duplicates
        this.cutHistory = new Map(); // Store idempotency mappings
        this.jobs = new Map(); // Cron jobs
        this.lastCutTime = null;
        console.log('🔧 TaskMaster: CashCutService initialized with duplicate prevention');
    }

    /**
     * 🚀 Initialize service with database and settings
     */
    async init({ db, logger, settings } = {}) {
        if (this.initialized) {
            console.log('🔧 CashCutService already initialized');
            return;
        }

        try {
            // Store references
            this.db = db || databaseManager;
            this.logger = logger || console;
            this.settings = settings || {};

            // Load last cut time
            await this.loadLastCutTime();

            // Setup automatic cuts if enabled
            if (this.settings.cron && this.settings.cron !== 'off') {
                this.setupAutomaticCuts(this.settings.cron);
            }

            this.initialized = true;
            console.log('✅ CashCutService initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize CashCutService:', error);
            throw error;
        }
    }

    /**
     * 📅 Setup automatic cuts with cron
     */
    setupAutomaticCuts(cronExpression) {
        // If node-cron is not available, skip scheduling
        if (!cron) {
            console.warn('⚠️  node-cron not available - automatic scheduling disabled');
            console.log('💡 Manual cash cuts via API still work');
            return;
        }

        try {
            const job = cron.schedule(cronExpression, async () => {
                try {
                    console.log('🔄 Starting automatic cash cut...');
                    await this.performAutomaticCashCut();
                    console.log('✅ Automatic cash cut completed');
                } catch (error) {
                    console.error('❌ Automatic cash cut failed:', error);
                }
            }, {
                scheduled: false,
                timezone: this.settings.timezone || 'America/Mexico_City'
            });

            this.jobs.set('automatic', job);
            job.start();

            console.log(`📅 Automatic cash cuts scheduled: ${cronExpression}`);
        } catch (error) {
            console.error('❌ Failed to setup automatic cuts:', error);
        }
    }

    /**
     * 📊 Load last cut time
     */
    async loadLastCutTime() {
        try {
            const cuts = await this.getCashCuts(1);
            if (cuts && cuts.length > 0) {
                this.lastCutTime = new Date(cuts[0].cutDate);
            } else {
                this.lastCutTime = new Date();
            }
        } catch (error) {
            console.error('Error loading last cut time:', error);
            this.lastCutTime = new Date();
        }
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

            // Check database/file storage
            const cashCuts = await this.getCashCuts();
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
            const cashCut = await this.performCashCut('manual', userId, notes, idempotencyKey);
            
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
     * 🔄 Perform automatic cash cut
     */
    async performAutomaticCashCut() {
        return await this.performCashCut('automatic');
    }

    /**
     * 💰 Main cash cut logic
     */
    async performCashCut(cutType = 'manual', userId = null, notes = '', idempotencyKey = null) {
        try {
            const cutDate = new Date();
            
            // Calculate the period for this cut
            let startDate;
            if (cutType === 'automatic') {
                // For automatic cuts, use time since last cut
                startDate = new Date(this.lastCutTime);
            } else {
                // For manual cuts, use last 12 hours or since last cut
                if (this.lastCutTime) {
                    startDate = new Date(this.lastCutTime);
                } else {
                    startDate = new Date(cutDate.getTime() - (12 * 60 * 60 * 1000));
                }
            }
            
            const endDate = new Date(cutDate);

            // Get records and expenses for the period
            const records = await this.getRecordsForPeriod(startDate, endDate);
            const expenses = await this.getExpensesForPeriod(startDate, endDate);
            
            // Calculate statistics including expenses
            const stats = this.calculatePeriodStats(records, expenses);
            
            // Create cash cut data
            const cashCutData = {
                cutDate,
                cutTime: cutDate.toLocaleTimeString('es-MX', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                startDate,
                endDate,
                cutType,
                totalRecords: stats.totalRecords,
                totalIncome: Math.round(stats.totalIncome * 100) / 100,
                totalCost: Math.round(stats.totalCost * 100) / 100,
                totalExpenses: Math.round(stats.totalExpenses * 100) / 100,
                totalExpenseRecords: stats.totalExpenseRecords,
                netProfit: Math.round((stats.totalIncome - stats.totalCost - stats.totalExpenses) * 100) / 100,
                totalProfit: Math.round((stats.totalIncome - stats.totalCost) * 100) / 100, // Keep for compatibility
                averageTicket: stats.totalRecords > 0 ? Math.round((stats.totalIncome / stats.totalRecords) * 100) / 100 : 0,
                paymentBreakdown: stats.paymentBreakdown,
                serviceBreakdown: stats.serviceBreakdown,
                expenseBreakdown: stats.expenseBreakdown,
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
            await this.saveCashCut(cashCutData);
            
            // Update last cut time
            this.lastCutTime = cutDate;
            
            console.log(`💰 Cash cut completed: ${stats.totalRecords} records, $${stats.totalIncome} income, $${stats.totalExpenses} expenses, $${stats.totalIncome - stats.totalCost - stats.totalExpenses} net profit`);
            
            return cashCutData;
        } catch (error) {
            console.error('Error performing cash cut:', error);
            throw error;
        }
    }

    /**
     * 📋 Get records for period
     */
    async getRecordsForPeriod(startDate, endDate) {
        try {
            const allRecords = await this.db.getRecords();
            return allRecords.filter(record => {
                if (!record.date) return false;
                const recordDate = new Date(record.date);
                return recordDate >= startDate && recordDate < endDate && !record.isDeleted;
            });
        } catch (error) {
            console.error('Error getting records for period:', error);
            return [];
        }
    }

    /**
     * 💸 Get expenses for period
     */
    async getExpensesForPeriod(startDate, endDate) {
        try {
            if (typeof this.db.getExpensesByDateRange === 'function') {
                const allExpenses = await this.db.getExpensesByDateRange(startDate, endDate);
                return allExpenses.filter(expense => {
                    return expense.isActive !== false && expense.status === 'pagado';
                });
            }
            return [];
        } catch (error) {
            console.error('Error getting expenses for period:', error);
            return [];
        }
    }

    /**
     * 📊 Calculate period statistics
     */
    calculatePeriodStats(records, expenses = []) {
        const stats = {
            totalRecords: records.length,
            totalIncome: 0,
            totalCost: 0,
            totalExpenses: 0,
            totalExpenseRecords: expenses.length,
            paymentBreakdown: {
                efectivo: { count: 0, amount: 0 },
                tarjeta: { count: 0, amount: 0 },
                transferencia: { count: 0, amount: 0 }
            },
            serviceBreakdown: {
                cafeteria: { count: 0, amount: 0 },
                coworking: { count: 0, amount: 0 }
            },
            expenseBreakdown: {
                'gastos-fijos': { count: 0, amount: 0 },
                'insumos': { count: 0, amount: 0 },
                'sueldos': { count: 0, amount: 0 },
                'marketing': { count: 0, amount: 0 },
                'mantenimiento': { count: 0, amount: 0 },
                'otros': { count: 0, amount: 0 }
            },
            topProducts: [],
            hourlyBreakdown: []
        };

        const productStats = {};
        const hourlyStats = {};

        // Process records
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

        // Process expenses
        expenses.forEach(expense => {
            stats.totalExpenses += expense.amount || 0;
            
            const category = expense.category || 'otros';
            if (stats.expenseBreakdown[category]) {
                stats.expenseBreakdown[category].count++;
                stats.expenseBreakdown[category].amount += expense.amount || 0;
            } else {
                stats.expenseBreakdown['otros'].count++;
                stats.expenseBreakdown['otros'].amount += expense.amount || 0;
            }
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
     * 💾 Save cash cut
     */
    async saveCashCut(cashCutData) {
        try {
            if (typeof this.db.saveCashCut === 'function') {
                await this.db.saveCashCut(cashCutData);
            } else {
                await this.saveCashCutToFile(cashCutData);
            }
        } catch (error) {
            console.error('Error saving cash cut:', error);
            throw error;
        }
    }

    /**
     * 💾 Save cash cut to file (fallback)
     */
    async saveCashCutToFile(cashCutData) {
        const dataDir = path.join(__dirname, '..', '..', '..', 'data');
        const cashCutsPath = path.join(dataDir, 'cash_cuts.json');
        
        try {
            await fs.mkdir(dataDir, { recursive: true });
            
            let cashCuts = [];
            try {
                const data = await fs.readFile(cashCutsPath, 'utf8');
                cashCuts = JSON.parse(data);
            } catch (error) {
                cashCuts = [];
            }
            
            cashCuts.push(cashCutData);
            
            await fs.writeFile(cashCutsPath, JSON.stringify(cashCuts, null, 2));
            console.log(`💾 TaskMaster: Cash cut saved: ${cashCutData.id}`);
        } catch (error) {
            console.error('Error saving cash cut to file:', error);
            throw error;
        }
    }

    /**
     * 📖 Get cash cuts
     */
    async getCashCuts(limit = 50) {
        try {
            if (typeof this.db.getCashCuts === 'function') {
                return await this.db.getCashCuts(limit);
            } else {
                return await this.getCashCutsFromFile(limit);
            }
        } catch (error) {
            console.error('Error getting cash cuts:', error);
            return [];
        }
    }

    /**
     * 📖 Get cash cuts from file (fallback)
     */
    async getCashCutsFromFile(limit = 50) {
        const cashCutsPath = path.join(__dirname, '..', '..', '..', 'data', 'cash_cuts.json');
        
        try {
            const data = await fs.readFile(cashCutsPath, 'utf8');
            const cashCuts = JSON.parse(data);
            
            return cashCuts
                .filter(cut => !cut.isDeleted)
                .sort((a, b) => new Date(b.cutDate) - new Date(a.cutDate))
                .slice(0, limit);
        } catch (error) {
            return [];
        }
    }

    /**
     * 🔍 Get cash cut by ID
     */
    async getCashCutById(id) {
        try {
            if (typeof this.db.getCashCutById === 'function') {
                return await this.db.getCashCutById(id);
            } else {
                const cashCuts = await this.getCashCutsFromFile();
                return cashCuts.find(cut => cut.id === id);
            }
        } catch (error) {
            console.error('Error getting cash cut by ID:', error);
            return null;
        }
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
            initialized: this.initialized,
            processingCuts: this.processingCuts.size,
            cachedCuts: this.cutHistory.size,
            lastCutTime: this.lastCutTime,
            jobs: Object.fromEntries(
                Array.from(this.jobs.entries()).map(([name, job]) => [
                    name, 
                    { running: job.running || false, scheduled: true }
                ])
            ),
            schedule: this.settings?.cron || null,
            timezone: this.settings?.timezone || 'America/Mexico_City',
            taskMasterActive: true,
            version: '2.0.0'
        };
    }

    /**
     * 🛑 Stop all jobs
     */
    stopAllJobs() {
        this.jobs.forEach((job, name) => {
            job.stop();
            console.log(`⏹️ Cash cut ${name} job stopped`);
        });
    }

    /**
     * 📈 Get jobs status
     */
    getJobsStatus() {
        const status = {};
        this.jobs.forEach((job, name) => {
            status[name] = {
                running: job.running || false,
                scheduled: true
            };
        });
        return status;
    }
}

// Export singleton instance
module.exports = new CashCutService();
