const cloudStorageService = require('./cloudStorage');
const User = require('../models/User');
const Product = require('../models/Product');
const Record = require('../models/Record');
const Backup = require('../models/Backup');

class BackupService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      await cloudStorageService.initialize();
      this.initialized = true;
      console.log('✅ Backup Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Backup Service:', error);
      this.initialized = false;
    }
  }

  // Create a comprehensive backup
  async createBackup(type = 'manual', createdBy = null, dateFrom = null, dateTo = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    const backupId = `backup-${Date.now()}`;
    let backupRecord = null;

    try {
      // Set default date range if not provided
      if (!dateFrom || !dateTo) {
        dateTo = new Date();
        dateFrom = new Date();
        
        // Set date range based on backup type
        switch (type) {
          case 'daily':
            dateFrom.setDate(dateTo.getDate() - 1);
            break;
          case 'weekly':
            dateFrom.setDate(dateTo.getDate() - 7);
            break;
          case 'monthly':
            dateFrom.setMonth(dateTo.getMonth() - 1);
            break;
          default: // manual
            dateFrom.setFullYear(2020); // Include all historical data
            break;
        }
      }

      // Create backup record in database
      const filename = `conejo-negro-backup-${type}-${new Date().toISOString().split('T')[0]}-${backupId}.json`;
      backupRecord = new Backup({
        filename,
        type,
        dateFrom,
        dateTo,
        createdBy,
        status: 'pending'
      });
      await backupRecord.save();

      console.log(`🔄 Starting ${type} backup...`);

      // Collect data
      const backupData = await this.collectBackupData(dateFrom, dateTo);
      
      // Update counts in backup record
      backupRecord.recordsCount = backupData.records.length;
      backupRecord.productsCount = backupData.products.length;
      backupRecord.usersCount = backupData.users.length;
      backupRecord.status = 'uploading';
      await backupRecord.save();

      // Save to cloud storage
      const saveResult = await cloudStorageService.saveBackup(backupData, {
        type,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        createdBy,
        recordsCount: backupData.records.length,
        productsCount: backupData.products.length,
        usersCount: backupData.users.length
      });

      // Mark as completed
      await backupRecord.markCompleted(saveResult.filename, saveResult.size);

      console.log(`✅ ${type} backup completed successfully`);
      
      return {
        success: true,
        backupId: backupRecord._id,
        filename: saveResult.filename,
        cloudFileId: saveResult.filename,
        size: saveResult.size,
        recordsCount: backupRecord.recordsCount,
        productsCount: backupRecord.productsCount,
        usersCount: backupRecord.usersCount
      };

    } catch (error) {
      console.error(`❌ Backup failed:`, error);

      if (backupRecord) {
        await backupRecord.markFailed(error.message);
      }

      throw error;
    }
  }

  // Collect all data for backup
  async collectBackupData(dateFrom, dateTo) {
    try {
      console.log('📊 Collecting backup data...');

      const [users, products, records] = await Promise.all([
        User.find({}).select('-password').lean(),
        Product.find({}).lean(),
        Record.findByDateRange(dateFrom, dateTo).populate('drinkProduct').populate('createdBy', 'name email').lean()
      ]);

      // Get statistics
      const stats = await Record.getStatsByDateRange(dateFrom, dateTo);

      // Create comprehensive backup data structure
      const backupData = {
        metadata: {
          version: '2.0',
          createdAt: new Date().toISOString(),
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString(),
          totalRecords: records.length,
          totalProducts: products.length,
          totalUsers: users.length,
          statistics: stats
        },
        users: users.map(user => ({
          ...user,
          __v: undefined
        })),
        products: products.map(product => ({
          ...product,
          __v: undefined
        })),
        records: records.map(record => ({
          ...record,
          __v: undefined
        })),
        statistics: stats,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          railway: process.env.RAILWAY_ENVIRONMENT || 'local'
        }
      };

      console.log(`📈 Backup data collected: ${users.length} users, ${products.length} products, ${records.length} records`);
      
      return backupData;
    } catch (error) {
      throw new Error(`Failed to collect backup data: ${error.message}`);
    }
  }

  // Restore from backup
  async restoreFromBackup(filename, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`🔄 Starting restore from backup: ${filename}`);

      // Load backup data from cloud storage
      const backupData = await cloudStorageService.loadBackup(filename);

      if (!backupData || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      const data = backupData.data;

      // Restore data based on options
      if (options.restoreUsers !== false && data.users) {
        await this.restoreUsers(data.users);
      }

      if (options.restoreProducts !== false && data.products) {
        await this.restoreProducts(data.products);
      }

      if (options.restoreRecords !== false && data.records) {
        await this.restoreRecords(data.records);
      }

      console.log('✅ Restore completed successfully');
      
      return {
        success: true,
        restoredUsers: options.restoreUsers !== false ? (data.users?.length || 0) : 0,
        restoredProducts: options.restoreProducts !== false ? (data.products?.length || 0) : 0,
        restoredRecords: options.restoreRecords !== false ? (data.records?.length || 0) : 0
      };

    } catch (error) {
      console.error('❌ Restore failed:', error);
      throw error;
    }
  }

  // Restore users (with caution)
  async restoreUsers(users) {
    console.log('👥 Restoring users...');
    let restoredCount = 0;

    for (const userData of users) {
      try {
        const existingUser = await User.findById(userData._id);
        if (!existingUser) {
          const newUser = new User(userData);
          await newUser.save();
          restoredCount++;
        }
      } catch (error) {
        console.error(`Failed to restore user ${userData.email}:`, error.message);
      }
    }

    console.log(`👥 Restored ${restoredCount} users`);
  }

  // Restore products
  async restoreProducts(products) {
    console.log('📦 Restoring products...');
    let restoredCount = 0;

    for (const productData of products) {
      try {
        const existingProduct = await Product.findById(productData._id);
        if (existingProduct) {
          // Update existing product
          await Product.findByIdAndUpdate(productData._id, productData);
        } else {
          // Create new product
          const newProduct = new Product(productData);
          await newProduct.save();
        }
        restoredCount++;
      } catch (error) {
        console.error(`Failed to restore product ${productData.name}:`, error.message);
      }
    }

    console.log(`📦 Restored ${restoredCount} products`);
  }

  // Restore records
  async restoreRecords(records) {
    console.log('📄 Restoring records...');
    let restoredCount = 0;

    for (const recordData of records) {
      try {
        const existingRecord = await Record.findById(recordData._id);
        if (!existingRecord) {
          const newRecord = new Record(recordData);
          await newRecord.save();
          restoredCount++;
        }
      } catch (error) {
        console.error(`Failed to restore record ${recordData._id}:`, error.message);
      }
    }

    console.log(`📄 Restored ${restoredCount} records`);
  }

  // List available backups
  async listBackups() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get backups from both database and cloud storage
      const [dbBackups, cloudBackups] = await Promise.all([
        Backup.find({}).sort({ createdAt: -1 }).populate('createdBy', 'name email').lean(),
        cloudStorageService.listBackups()
      ]);

      // Merge data from both sources
      const backups = dbBackups.map(dbBackup => {
        const cloudBackup = cloudBackups.find(cb => cb.filename === dbBackup.filename);
        return {
          ...dbBackup,
          cloudSize: cloudBackup?.size || dbBackup.size,
          cloudCreated: cloudBackup?.created || dbBackup.createdAt
        };
      });

      return backups;
    } catch (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  // Cleanup old backups
  async cleanupOldBackups(retentionDays = 30) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('🧹 Cleaning up old backups...');

      // Cleanup database records
      const deletedFromDB = await Backup.cleanup(retentionDays);
      
      // Cleanup cloud storage files
      const deletedFromCloud = await cloudStorageService.cleanupOldBackups(retentionDays);
      
      console.log(`🧹 Cleanup completed: ${deletedFromDB.deletedCount} records from DB, ${deletedFromCloud} files from cloud`);

      return {
        deletedFromDatabase: deletedFromDB.deletedCount,
        deletedFromCloud: deletedFromCloud
      };
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

  // Export data to various formats
  async exportData(type, format = 'json', dateFrom = null, dateTo = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      let data = [];
      let filename = '';

      // Collect data based on type
      switch (type) {
        case 'records':
          data = await Record.findByDateRange(
            dateFrom || new Date(2020, 0, 1),
            dateTo || new Date()
          ).populate('drinkProduct', 'name category').lean();
          filename = `records-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        
        case 'products':
          data = await Product.find({ isActive: true }).lean();
          filename = `products-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        
        case 'users':
          data = await User.find({ isActive: true }).select('-password').lean();
          filename = `users-export-${new Date().toISOString().split('T')[0]}.${format}`;
          break;
        
        default:
          throw new Error('Invalid export type');
      }

      // Clean up data for export
      const cleanData = data.map(item => {
        const cleanItem = { ...item };
        delete cleanItem.__v;
        delete cleanItem._id;
        return cleanItem;
      });

      // Save to cloud storage
      const saveResult = await cloudStorageService.saveExport(cleanData, filename);

      console.log(`📊 Export completed: ${filename}`);

      return {
        success: true,
        filename: saveResult.filename,
        size: saveResult.size,
        url: saveResult.url,
        recordCount: cleanData.length
      };

    } catch (error) {
      console.error('❌ Export failed:', error);
      throw error;
    }
  }

  // Get storage statistics
  async getStorageStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const storageInfo = await cloudStorageService.getStorageInfo();
      const backupCount = await Backup.countDocuments({ status: 'completed' });

      return {
        ...storageInfo,
        databaseBackupCount: backupCount
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      return {
        total: 0,
        used: 0,
        available: 0,
        backupsSize: 0,
        backupsCount: 0,
        databaseBackupCount: 0
      };
    }
  }
}

// Export singleton instance
const backupService = new BackupService();

module.exports = backupService;