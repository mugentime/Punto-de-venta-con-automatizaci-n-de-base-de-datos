const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CloudStorageService {
  constructor() {
    // Use Railway's persistent volume or fallback to local temp
    this.storageBasePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '..', 'storage');
    this.backupsPath = path.join(this.storageBasePath, 'backups');
    this.exportsPath = path.join(this.storageBasePath, 'exports');
    this.cachePath = path.join(this.storageBasePath, 'cache');
    this.initialized = false;
  }

  async initialize() {
    try {
      // Create storage directories if they don't exist
      await this.ensureDirectories();
      
      this.initialized = true;
      console.log('✅ Cloud Storage Service initialized');
      console.log(`📁 Storage path: ${this.storageBasePath}`);
      
      // Check available storage
      const storageInfo = await this.getStorageInfo();
      console.log(`💾 Available storage: ${this.formatBytes(storageInfo.available)}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Cloud Storage Service:', error.message);
      this.initialized = false;
      return false;
    }
  }

  async ensureDirectories() {
    const directories = [
      this.storageBasePath,
      this.backupsPath,
      this.exportsPath,
      this.cachePath
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  // Save backup file
  async saveBackup(data, metadata = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${metadata.type || 'manual'}-${timestamp}.json`;
      const filepath = path.join(this.backupsPath, filename);
      
      // Add metadata to the backup
      const backupData = {
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          version: '2.0',
          checksum: this.generateChecksum(JSON.stringify(data))
        },
        data
      };

      // Compress if needed (simple JSON stringification for now)
      const jsonData = JSON.stringify(backupData, null, 2);
      
      // Write to file
      await fs.writeFile(filepath, jsonData, 'utf8');
      
      // Get file stats
      const stats = await fs.stat(filepath);
      
      console.log(`✅ Backup saved: ${filename} (${this.formatBytes(stats.size)})`);
      
      return {
        filename,
        filepath,
        size: stats.size,
        checksum: backupData.metadata.checksum
      };
    } catch (error) {
      console.error('❌ Failed to save backup:', error);
      throw error;
    }
  }

  // Load backup file
  async loadBackup(filename) {
    if (!this.initialized) await this.initialize();

    try {
      const filepath = path.join(this.backupsPath, filename);
      
      // Check if file exists
      await fs.access(filepath);
      
      // Read file
      const jsonData = await fs.readFile(filepath, 'utf8');
      const backupData = JSON.parse(jsonData);
      
      // Verify checksum
      if (backupData.metadata?.checksum) {
        const calculatedChecksum = this.generateChecksum(JSON.stringify(backupData.data));
        if (calculatedChecksum !== backupData.metadata.checksum) {
          throw new Error('Backup file integrity check failed');
        }
      }
      
      console.log(`✅ Backup loaded: ${filename}`);
      
      return backupData;
    } catch (error) {
      console.error('❌ Failed to load backup:', error);
      throw error;
    }
  }

  // List all backups
  async listBackups() {
    if (!this.initialized) await this.initialize();

    try {
      const files = await fs.readdir(this.backupsPath);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.backupsPath, file);
          const stats = await fs.stat(filepath);
          
          // Try to extract metadata from filename
          const parts = file.replace('.json', '').split('-');
          const type = parts[1] || 'unknown';
          
          backups.push({
            filename: file,
            type,
            size: stats.size,
            created: stats.birthtime || stats.ctime,
            modified: stats.mtime
          });
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created - a.created);
      
      return backups;
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  // Delete old backups
  async cleanupOldBackups(retentionDays = 30) {
    if (!this.initialized) await this.initialize();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const files = await fs.readdir(this.backupsPath);
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.backupsPath, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtime < cutoffDate) {
            // Keep at least one backup per type
            const type = file.split('-')[1];
            const otherBackups = files.filter(f => f.includes(`-${type}-`) && f !== file);
            
            if (otherBackups.length > 0) {
              await fs.unlink(filepath);
              console.log(`🗑️ Deleted old backup: ${file}`);
              deletedCount++;
            }
          }
        }
      }

      console.log(`🧹 Cleanup completed. Deleted ${deletedCount} old backup files.`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old backups:', error);
      throw error;
    }
  }

  // Save export file (for downloads)
  async saveExport(data, filename) {
    if (!this.initialized) await this.initialize();

    try {
      const filepath = path.join(this.exportsPath, filename);
      
      // Determine format based on file extension
      let content;
      if (filename.endsWith('.csv')) {
        content = this.convertToCSV(data);
      } else if (filename.endsWith('.json')) {
        content = JSON.stringify(data, null, 2);
      } else {
        content = data.toString();
      }
      
      await fs.writeFile(filepath, content, 'utf8');
      
      const stats = await fs.stat(filepath);
      
      console.log(`📄 Export saved: ${filename} (${this.formatBytes(stats.size)})`);
      
      return {
        filename,
        filepath,
        size: stats.size,
        url: `/api/exports/${filename}` // Endpoint to serve the file
      };
    } catch (error) {
      console.error('❌ Failed to save export:', error);
      throw error;
    }
  }

  // Get export file path
  getExportPath(filename) {
    return path.join(this.exportsPath, filename);
  }

  // Cache data
  async cacheData(key, data, ttl = 3600) {
    if (!this.initialized) await this.initialize();

    try {
      const cacheFile = path.join(this.cachePath, `${key}.cache`);
      const cacheData = {
        data,
        expires: Date.now() + (ttl * 1000),
        key
      };
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf8');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to cache data:', error);
      return false;
    }
  }

  // Get cached data
  async getCachedData(key) {
    if (!this.initialized) await this.initialize();

    try {
      const cacheFile = path.join(this.cachePath, `${key}.cache`);
      
      // Check if cache file exists
      await fs.access(cacheFile);
      
      const cacheContent = await fs.readFile(cacheFile, 'utf8');
      const cacheData = JSON.parse(cacheContent);
      
      // Check if cache is expired
      if (cacheData.expires < Date.now()) {
        await fs.unlink(cacheFile);
        return null;
      }
      
      return cacheData.data;
    } catch (error) {
      // Cache miss is not an error
      return null;
    }
  }

  // Clear cache
  async clearCache() {
    if (!this.initialized) await this.initialize();

    try {
      const files = await fs.readdir(this.cachePath);
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          await fs.unlink(path.join(this.cachePath, file));
        }
      }
      
      console.log('🧹 Cache cleared');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      return false;
    }
  }

  // Get storage information
  async getStorageInfo() {
    try {
      const backups = await this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      
      // Get export files size
      let exportsSize = 0;
      try {
        const exportFiles = await fs.readdir(this.exportsPath);
        for (const file of exportFiles) {
          const stats = await fs.stat(path.join(this.exportsPath, file));
          exportsSize += stats.size;
        }
      } catch (error) {
        // Ignore if exports directory doesn't exist
      }
      
      // Get cache size
      let cacheSize = 0;
      try {
        const cacheFiles = await fs.readdir(this.cachePath);
        for (const file of cacheFiles) {
          const stats = await fs.stat(path.join(this.cachePath, file));
          cacheSize += stats.size;
        }
      } catch (error) {
        // Ignore if cache directory doesn't exist
      }
      
      // Railway provides 10GB persistent storage on paid plans
      const totalAvailable = 10 * 1024 * 1024 * 1024; // 10GB in bytes
      const totalUsed = totalSize + exportsSize + cacheSize;
      
      return {
        total: totalAvailable,
        used: totalUsed,
        available: totalAvailable - totalUsed,
        backupsSize: totalSize,
        exportsSize,
        cacheSize,
        backupsCount: backups.length
      };
    } catch (error) {
      console.error('❌ Failed to get storage info:', error);
      return {
        total: 0,
        used: 0,
        available: 0,
        backupsSize: 0,
        exportsSize: 0,
        cacheSize: 0,
        backupsCount: 0
      };
    }
  }

  // Generate checksum for data integrity
  generateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Convert data to CSV format
  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  // Format bytes for display
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
const cloudStorageService = new CloudStorageService();

module.exports = cloudStorageService;