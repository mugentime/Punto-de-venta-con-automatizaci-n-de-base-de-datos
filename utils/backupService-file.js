const cloudStorageService = require('./cloudStorage');
const fileDatabase = require('./fileDatabase');

class BackupService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    try {
      await cloudStorageService.initialize();
      this.initialized = true;
      console.log('✅ File-based Backup Service initialized');
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
        }
      }

      console.log(`🔄 Creating ${type} backup...`);
      console.log(`📅 Date range: ${dateFrom.toISOString().split('T')[0]} to ${dateTo.toISOString().split('T')[0]}`);

      // Collect data from file database
      const [users, products, allRecords] = await Promise.all([
        fileDatabase.getUsers(),
        fileDatabase.getProducts(),
        fileDatabase.getRecords()
      ]);

      // Filter records by date range if specified
      let records = allRecords;
      if (dateFrom && dateTo) {
        records = allRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= dateFrom && recordDate <= dateTo;
        });
      }

      // Remove sensitive data from users (passwords)
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      // Prepare backup data
      const backupData = {
        users: safeUsers,
        products,
        records,
        metadata: {
          type,
          dateRange: {
            from: dateFrom.toISOString(),
            to: dateTo.toISOString()
          },
          counts: {
            users: safeUsers.length,
            products: products.length,
            records: records.length
          },
          createdBy,
          backupId
        }
      };

      // Save backup to cloud storage
      const backupMetadata = {
        type,
        backupId,
        createdBy,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
        recordCount: records.length,
        userCount: safeUsers.length,
        productCount: products.length
      };

      const savedBackup = await cloudStorageService.saveBackup(backupData, backupMetadata);

      // Create backup record in file system
      const backupRecord = {
        _id: this.generateId(),
        type,
        filename: savedBackup.filename,
        size: savedBackup.size,
        dateRange: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString()
        },
        counts: backupData.metadata.counts,
        createdBy,
        createdAt: new Date().toISOString(),
        status: 'completed',
        checksum: savedBackup.checksum
      };

      // Save backup record to file database
      await this.saveBackupRecord(backupRecord);

      console.log(`✅ ${type} backup completed`);
      console.log(`📄 File: ${savedBackup.filename}`);
      console.log(`💾 Size: ${this.formatBytes(savedBackup.size)}`);
      console.log(`📊 Records: ${records.length}, Products: ${products.length}, Users: ${safeUsers.length}`);

      return {
        success: true,
        backup: backupRecord,
        file: savedBackup
      };

    } catch (error) {
      console.error(`❌ ${type} backup failed:`, error);
      
      // Create failed backup record
      const failedRecord = {
        _id: this.generateId(),
        type,
        filename: null,
        size: 0,
        dateRange: {
          from: dateFrom?.toISOString(),
          to: dateTo?.toISOString()
        },
        error: error.message,
        createdBy,
        createdAt: new Date().toISOString(),
        status: 'failed'
      };

      await this.saveBackupRecord(failedRecord);
      throw error;
    }
  }

  // Restore from backup
  async restoreFromBackup(filename, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log(`🔄 Restoring from backup: ${filename}`);

      // Load backup data
      const backupData = await cloudStorageService.loadBackup(filename);

      if (!backupData || !backupData.data) {
        throw new Error('Invalid backup file format');
      }

      const { users, products, records } = backupData.data;

      // Restore options
      const {
        restoreUsers = false,
        restoreProducts = true,
        restoreRecords = true,
        mergeData = false
      } = options;

      console.log(`📥 Restoring data...`);
      console.log(`👥 Users: ${restoreUsers ? 'YES' : 'NO'}`);
      console.log(`📦 Products: ${restoreProducts ? 'YES' : 'NO'}`);
      console.log(`📊 Records: ${restoreRecords ? 'YES' : 'NO'}`);
      console.log(`🔗 Merge mode: ${mergeData ? 'YES' : 'NO'}`);

      // Create backup before restore
      await this.createBackup('pre-restore', null);

      const fs = require('fs').promises;

      // Restore products
      if (restoreProducts) {
        if (mergeData) {
          // Merge with existing products
          const existingProducts = await fileDatabase.getProducts();
          const mergedProducts = [...existingProducts];
          
          products.forEach(product => {
            const existingIndex = mergedProducts.findIndex(p => p._id === product._id);
            if (existingIndex >= 0) {
              mergedProducts[existingIndex] = product;
            } else {
              mergedProducts.push(product);
            }
          });
          
          await fs.writeFile(fileDatabase.productsFile, JSON.stringify(mergedProducts, null, 2));
        } else {
          await fs.writeFile(fileDatabase.productsFile, JSON.stringify(products, null, 2));
        }
        console.log(`✅ Restored ${products.length} products`);
      }

      // Restore records
      if (restoreRecords) {
        if (mergeData) {
          // Merge with existing records
          const existingRecords = await fileDatabase.getRecords();
          const mergedRecords = [...existingRecords];
          
          records.forEach(record => {
            const existingIndex = mergedRecords.findIndex(r => r._id === record._id);
            if (existingIndex >= 0) {
              mergedRecords[existingIndex] = record;
            } else {
              mergedRecords.push(record);
            }
          });
          
          await fs.writeFile(fileDatabase.recordsFile, JSON.stringify(mergedRecords, null, 2));
        } else {
          await fs.writeFile(fileDatabase.recordsFile, JSON.stringify(records, null, 2));
        }
        console.log(`✅ Restored ${records.length} records`);
      }

      // Restore users (only in merge mode and if explicitly requested)
      if (restoreUsers && mergeData) {
        const existingUsers = await fileDatabase.getUsers();
        const mergedUsers = [...existingUsers];
        
        users.forEach(user => {
          const existingIndex = mergedUsers.findIndex(u => u.email === user.email);
          if (existingIndex >= 0) {
            // Update existing user but keep the password
            mergedUsers[existingIndex] = {
              ...user,
              password: mergedUsers[existingIndex].password // Keep existing password
            };
          } else {
            // New user needs a default password
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('tempPassword123', 12);
            mergedUsers.push({
              ...user,
              password: hashedPassword
            });
          }
        });
        
        await fs.writeFile(fileDatabase.usersFile, JSON.stringify(mergedUsers, null, 2));
        console.log(`✅ Restored ${users.length} users`);
      }

      console.log(`✅ Restore completed successfully`);

      return {
        success: true,
        restored: {
          products: restoreProducts ? products.length : 0,
          records: restoreRecords ? records.length : 0,
          users: (restoreUsers && mergeData) ? users.length : 0
        }
      };

    } catch (error) {
      console.error(`❌ Restore failed:`, error);
      throw error;
    }
  }

  // Get backup history
  async getBackupHistory(limit = 50) {
    try {
      const fs = require('fs').promises;
      const backupsData = await fs.readFile(fileDatabase.backupsFile, 'utf8');
      const backups = JSON.parse(backupsData);
      
      return backups
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting backup history:', error);
      return [];
    }
  }

  // Delete old backups
  async cleanupOldBackups(retentionDays = 30) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Clean up cloud storage backups
      const deletedCount = await cloudStorageService.cleanupOldBackups(retentionDays);

      // Clean up backup records
      const fs = require('fs').promises;
      const backupsData = await fs.readFile(fileDatabase.backupsFile, 'utf8');
      const backups = JSON.parse(backupsData);
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const filteredBackups = backups.filter(backup => {
        return new Date(backup.createdAt) > cutoffDate || backup.type !== 'manual';
      });
      
      await fs.writeFile(fileDatabase.backupsFile, JSON.stringify(filteredBackups, null, 2));

      console.log(`🧹 Cleaned up ${backups.length - filteredBackups.length} backup records`);

      return {
        cloudFiles: deletedCount,
        records: backups.length - filteredBackups.length
      };

    } catch (error) {
      console.error('Backup cleanup error:', error);
      throw error;
    }
  }

  // Save backup record to file system
  async saveBackupRecord(record) {
    try {
      const fs = require('fs').promises;
      
      let backups = [];
      try {
        const backupsData = await fs.readFile(fileDatabase.backupsFile, 'utf8');
        backups = JSON.parse(backupsData);
      } catch (error) {
        // File doesn't exist or is empty, start with empty array
      }
      
      backups.push(record);
      await fs.writeFile(fileDatabase.backupsFile, JSON.stringify(backups, null, 2));
      
    } catch (error) {
      console.error('Error saving backup record:', error);
      throw error;
    }
  }

  // Export data to various formats
  async exportData(format, dateFrom, dateTo, dataTypes = ['records']) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      let exportData = {};
      let filename = `export-${timestamp}`;

      // Collect requested data
      if (dataTypes.includes('records')) {
        const allRecords = await fileDatabase.getRecords();
        exportData.records = dateFrom && dateTo 
          ? allRecords.filter(r => {
              const recordDate = new Date(r.date);
              return recordDate >= new Date(dateFrom) && recordDate <= new Date(dateTo);
            })
          : allRecords;
        filename += '-records';
      }

      if (dataTypes.includes('products')) {
        exportData.products = await fileDatabase.getProducts();
        filename += '-products';
      }

      if (dataTypes.includes('users')) {
        const users = await fileDatabase.getUsers();
        exportData.users = users.map(user => {
          const { password, ...safeUser } = user;
          return safeUser;
        });
        filename += '-users';
      }

      // Set file extension based on format
      filename += format === 'csv' ? '.csv' : '.json';

      // Save export file
      const exportResult = await cloudStorageService.saveExport(exportData, filename);

      console.log(`📤 Export completed: ${filename}`);
      return exportResult;

    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  // Utility methods
  generateId() {
    return require('crypto').randomBytes(12).toString('hex');
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

// Export singleton instance
const backupService = new BackupService();

module.exports = backupService;