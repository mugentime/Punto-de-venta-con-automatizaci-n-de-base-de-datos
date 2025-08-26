const databaseManager = require('./databaseManager');
const cron = require('node-cron');

class CashCutService {
  constructor() {
    this.initialized = false;
    this.jobs = new Map();
    this.lastCutTime = null;
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

  async performManualCashCut(userId, notes = '') {
    return await this.performCashCut('manual', userId, notes);
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
      
      // Calculate statistics
      const stats = this.calculatePeriodStats(records);
      
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
        totalProfit: Math.round((stats.totalIncome - stats.totalCost) * 100) / 100,
        averageTicket: stats.totalRecords > 0 ? Math.round((stats.totalIncome / stats.totalRecords) * 100) / 100 : 0,
        paymentBreakdown: stats.paymentBreakdown,
        serviceBreakdown: stats.serviceBreakdown,
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
      
      console.log(`💰 Cash cut completed: ${stats.totalRecords} records, $${stats.totalIncome} income, $${stats.totalIncome - stats.totalCost} profit`);
      
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

  // Manual trigger for testing
  async triggerManualCut(userId, notes = '') {
    try {
      console.log('🔄 Manually triggering cash cut...');
      const result = await this.performManualCashCut(userId, notes);
      console.log('✅ Manual cash cut completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Manual cash cut failed:', error);
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