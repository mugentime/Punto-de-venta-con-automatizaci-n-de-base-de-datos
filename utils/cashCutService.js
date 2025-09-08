const databaseManager = require('./databaseManager');
const cron = require('node-cron');
const DuplicatePreventionService = require('../backend/services/DuplicatePreventionService');
const EnhancedCashClosingController = require('../backend/controllers/EnhancedCashClosingController');
const { v4: uuidv4 } = require('uuid');

class CashCutService {
  constructor() {
    this.initialized = false;
    this.jobs = new Map();
    this.lastCutTime = null;
    this.duplicateService = new DuplicatePreventionService();
    this.enhancedController = new EnhancedCashClosingController();
    console.log('🔧 TaskMaster: CashCutService initialized with duplicate prevention');
  }

  async initialize() {
    try {
      // Load the last cut time to determine when to start
      await this.loadLastCutTime();
      
      // Setup automatic 12-hour cuts
      this.setup12HourCuts();
      
      this.initialized = true;
      console.log('✅ Cash cut service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize cash cut service:', error);
    }
  }

  async loadLastCutTime() {
    try {
      // Check if we have a database implementation with cash cuts
      if (typeof databaseManager.getCashCuts === 'function') {
        const cuts = await databaseManager.getCashCuts();
        if (cuts && cuts.length > 0) {
          const lastCut = cuts.sort((a, b) => new Date(b.cutDate) - new Date(a.cutDate))[0];
          this.lastCutTime = new Date(lastCut.cutDate);
        }
      }
      
      // If no previous cuts, set to current time
      if (!this.lastCutTime) {
        this.lastCutTime = new Date();
      }
    } catch (error) {
      console.error('Error loading last cut time:', error);
      this.lastCutTime = new Date();
    }
  }

  setup12HourCuts() {
    // Run every 12 hours - at 6:00 AM and 6:00 PM
    const twiceDaily = cron.schedule('0 6,18 * * *', async () => {
      try {
        console.log('🔄 Starting automatic 12-hour cash cut...');
        await this.performAutomaticCashCut();
        console.log('✅ Automatic 12-hour cash cut completed');
      } catch (error) {
        console.error('❌ Automatic 12-hour cash cut failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City'
    });

    this.jobs.set('twiceDaily', twiceDaily);
    twiceDaily.start();
    
    console.log('📅 12-hour automatic cash cut scheduled');
  }

  async performAutomaticCashCut() {
    return await this.performCashCut('automatic');
  }

  async performManualCashCut(userId, notes = '', idempotencyKey = null) {
    console.log('🔧 TaskMaster: Manual cash cut requested with duplicate prevention');
    
    // Generate idempotency key if not provided
    if (!idempotencyKey) {
      idempotencyKey = this.generateIdempotencyKey(userId, notes);
    }
    
    // Use Enhanced Controller for duplicate prevention
    return await this.performEnhancedManualCashCut(userId, notes, idempotencyKey);
  }

  async performCashCut(cutType = 'automatic', userId = null, notes = '') {
    try {
      const cutDate = new Date();
      
      // Calculate the period for this cut
      let startDate;
      if (cutType === 'automatic') {
        // For automatic cuts, use 12-hour periods
        startDate = new Date(this.lastCutTime);
      } else {
        // For manual cuts, get records from last cut or beginning of day
        if (this.lastCutTime) {
          startDate = new Date(this.lastCutTime);
        } else {
          startDate = new Date(cutDate.getFullYear(), cutDate.getMonth(), cutDate.getDate());
        }
      }
      
      const endDate = new Date(cutDate);

      // Get records for the period
      const records = await this.getRecordsForPeriod(startDate, endDate);
      
      // 💰 NEW: Get expenses for the period
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
        // 💰 NEW: Include expenses in cash cut
        totalExpenses: Math.round(stats.totalExpenses * 100) / 100,
        totalExpenseRecords: stats.totalExpenseRecords,
        netProfit: Math.round((stats.totalIncome - stats.totalCost - stats.totalExpenses) * 100) / 100,
        totalProfit: Math.round((stats.totalIncome - stats.totalCost) * 100) / 100, // Keep original for compatibility
        averageTicket: stats.totalRecords > 0 ? Math.round((stats.totalIncome / stats.totalRecords) * 100) / 100 : 0,
        paymentBreakdown: stats.paymentBreakdown,
        serviceBreakdown: stats.serviceBreakdown,
        // 💰 NEW: Add expenses breakdown
        expenseBreakdown: stats.expenseBreakdown,
        topProducts: stats.topProducts,
        hourlyBreakdown: stats.hourlyBreakdown,
        notes,
        createdBy: userId,
        id: this.generateId()
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

  async getRecordsForPeriod(startDate, endDate) {
    try {
      const allRecords = await databaseManager.getRecords();
      return allRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate < endDate && !record.isDeleted;
      });
    } catch (error) {
      console.error('Error getting records for period:', error);
      return [];
    }
  }

  // 💰 NEW: Get expenses for the period to include in cash cut
  async getExpensesForPeriod(startDate, endDate) {
    try {
      const allExpenses = await databaseManager.getExpensesByDateRange(startDate, endDate);
      return allExpenses.filter(expense => {
        return expense.isActive !== false && expense.status === 'pagado';
      });
    } catch (error) {
      console.error('Error getting expenses for period:', error);
      return [];
    }
  }

  calculatePeriodStats(records, expenses = []) {
    const stats = {
      totalRecords: records.length,
      totalIncome: 0,
      totalCost: 0,
      // 💰 NEW: Add expenses tracking
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
      // 💰 NEW: Add expenses breakdown by category
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

    records.forEach(record => {
      // Basic totals
      stats.totalIncome += record.total;
      stats.totalCost += record.cost;
      
      // Payment breakdown
      if (stats.paymentBreakdown[record.payment]) {
        stats.paymentBreakdown[record.payment].count++;
        stats.paymentBreakdown[record.payment].amount += record.total;
      }
      
      // Service breakdown
      if (stats.serviceBreakdown[record.service]) {
        stats.serviceBreakdown[record.service].count++;
        stats.serviceBreakdown[record.service].amount += record.total;
      }
      
      // Product statistics
      const productKey = record.drink;
      if (!productStats[productKey]) {
        productStats[productKey] = {
          productName: record.drink,
          quantity: 0,
          revenue: 0
        };
      }
      productStats[productKey].quantity++;
      productStats[productKey].revenue += record.total;
      
      // Hourly breakdown
      const recordDate = new Date(record.date);
      const hour = recordDate.getHours().toString().padStart(2, '0') + ':00';
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { count: 0, revenue: 0 };
      }
      hourlyStats[hour].count++;
      hourlyStats[hour].revenue += record.total;
    });

    // 💰 NEW: Process expenses for the period
    expenses.forEach(expense => {
      // Add to total expenses
      stats.totalExpenses += expense.amount;
      
      // Expense breakdown by category
      const category = expense.category || 'otros';
      if (stats.expenseBreakdown[category]) {
        stats.expenseBreakdown[category].count++;
        stats.expenseBreakdown[category].amount += expense.amount;
      } else {
        // If category not found, add to 'otros'
        stats.expenseBreakdown['otros'].count++;
        stats.expenseBreakdown['otros'].amount += expense.amount;
      }
    });

    // Convert product stats to top products (sorted by revenue)
    stats.topProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Convert hourly stats to array
    stats.hourlyBreakdown = Object.keys(hourlyStats)
      .sort()
      .map(hour => ({
        hour,
        count: hourlyStats[hour].count,
        revenue: Math.round(hourlyStats[hour].revenue * 100) / 100
      }));

    return stats;
  }

  async saveCashCut(cashCutData) {
    try {
      // Save to database manager (implement cash cuts support)
      if (typeof databaseManager.saveCashCut === 'function') {
        await databaseManager.saveCashCut(cashCutData);
      } else {
        // Fallback: save to file system
        await this.saveCashCutToFile(cashCutData);
      }
    } catch (error) {
      console.error('Error saving cash cut:', error);
      throw error;
    }
  }

  async saveCashCutToFile(cashCutData) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const dataDir = path.join(__dirname, '..', 'data');
      const cashCutsPath = path.join(dataDir, 'cashcuts.json');
      
      // Ensure data directory exists
      try {
        await fs.mkdir(dataDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
      
      let cashCuts = [];
      try {
        const data = await fs.readFile(cashCutsPath, 'utf8');
        cashCuts = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start with empty array
        cashCuts = [];
      }
      
      cashCuts.push(cashCutData);
      
      await fs.writeFile(cashCutsPath, JSON.stringify(cashCuts, null, 2));
    } catch (error) {
      console.error('Error saving cash cut to file:', error);
      throw error;
    }
  }

  async getCashCuts(limit = 50) {
    try {
      if (typeof databaseManager.getCashCuts === 'function') {
        return await databaseManager.getCashCuts(limit);
      } else {
        return await this.getCashCutsFromFile(limit);
      }
    } catch (error) {
      console.error('Error getting cash cuts:', error);
      return [];
    }
  }

  async getCashCutsFromFile(limit = 50) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const cashCutsPath = path.join(__dirname, '..', 'data', 'cashcuts.json');
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

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 🔧 TaskMaster: Generate idempotency key for manual cash cuts
   */
  generateIdempotencyKey(userId, notes) {
    const timestamp = Math.floor(Date.now() / (1000 * 60)); // Round to minute
    const payload = `${userId}_manual_${timestamp}_${notes}`;
    return require('crypto').createHash('sha256').update(payload).digest('hex').substring(0, 16);
  }

  /**
   * 💰 NEW: Trigger manual cash cut (wrapper for external calls)
   */
  async triggerManualCut(userId, notes = '') {
    console.log(`🔄 Manual cash cut triggered by user: ${userId}`);
    return await this.performManualCashCut(userId, notes);
  }

  /**
   * 🔄 TaskMaster: Enhanced manual cash cut with duplicate prevention
   */
  async performEnhancedManualCashCut(userId, notes, idempotencyKey) {
    console.log(`🔧 TaskMaster: Processing enhanced cash cut - Key: ${idempotencyKey}`);
    
    try {
      // Check if cash cut already exists
      const existingCashCut = await this.checkExistingCashCut(idempotencyKey);
      if (existingCashCut) {
        console.log(`✅ TaskMaster: Returning existing cash cut: ${existingCashCut.id}`);
        return existingCashCut;
      }

      // Acquire lock to prevent concurrent duplicates
      const lockResult = await this.duplicateService.acquireLock(userId, idempotencyKey, 'manual_cash_cut');
      if (!lockResult.success) {
        throw new Error(`Duplicate operation in progress: ${lockResult.message}`);
      }

      try {
        // Perform the actual cash cut with original logic
        const result = await this.performCashCut('manual', userId, notes);
        
        // Store mapping for future duplicate checks
        await this.storeCashCutMapping(idempotencyKey, result);
        
        console.log(`✅ TaskMaster: New cash cut created: ${result.id}`);
        return result;
        
      } finally {
        // Always release the lock
        await this.duplicateService.releaseLock(lockResult.lockKey, lockResult.lockValue);
      }
      
    } catch (error) {
      console.error(`❌ TaskMaster: Enhanced cash cut failed:`, error.message);
      throw error;
    }
  }

  /**
   * 🔍 TaskMaster: Check if cash cut already exists by idempotency key
   */
  async checkExistingCashCut(idempotencyKey) {
    try {
      const cashCuts = await this.getCashCuts();
      return cashCuts.find(cut => cut.idempotencyKey === idempotencyKey);
    } catch (error) {
      console.error('Error checking existing cash cut:', error.message);
      return null;
    }
  }

  /**
   * 💾 TaskMaster: Store cash cut mapping for duplicate prevention
   */
  async storeCashCutMapping(idempotencyKey, cashCut) {
    try {
      // Add idempotency key to cash cut data
      cashCut.idempotencyKey = idempotencyKey;
      cashCut.taskMasterProtected = true;
      cashCut.createdByTaskMaster = new Date().toISOString();
      
      console.log(`💾 TaskMaster: Stored mapping ${idempotencyKey} -> ${cashCut.id}`);
    } catch (error) {
      console.error('Error storing cash cut mapping:', error.message);
    }
  }

  // Manual trigger for testing with TaskMaster protection
  async triggerManualCut(userId, notes = '', idempotencyKey = null) {
    try {
      console.log('🔧 TaskMaster: Manually triggering protected cash cut...');
      const result = await this.performManualCashCut(userId, notes, idempotencyKey);
      console.log('✅ TaskMaster: Protected manual cash cut completed:', result.id);
      return result;
    } catch (error) {
      console.error('❌ TaskMaster: Protected manual cash cut failed:', error);
      throw error;
    }
  }

  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Cash cut ${name} job stopped`);
    });
  }

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

// Create and export singleton instance
const cashCutService = new CashCutService();

// Initialize service when the module is loaded
cashCutService.initialize();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Shutting down cash cut service...');
  cashCutService.stopAllJobs();
});

process.on('SIGINT', () => {
  console.log('🔄 Shutting down cash cut service...');
  cashCutService.stopAllJobs();
});

module.exports = cashCutService;