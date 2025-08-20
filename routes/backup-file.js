const express = require('express');
const backupService = require('../utils/backupService-file');
const cloudStorageService = require('../utils/cloudStorage');
const { auth } = require('./auth-file');

const router = express.Router();

// Simple permission middleware
const canExportData = (req, res, next) => {
  if (req.user.permissions?.canExportData) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions for data export' });
  }
};

const adminAuth = (req, res, next) => {
  if (req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Admin privileges required' });
  }
};

// Create manual backup
router.post('/create', auth, canExportData, async (req, res) => {
  try {
    const { type = 'manual', dateFrom, dateTo } = req.body;

    if (!['manual', 'daily', 'weekly', 'monthly'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid backup type'
      });
    }

    const result = await backupService.createBackup(
      type, 
      req.user.userId, 
      dateFrom ? new Date(dateFrom) : null,
      dateTo ? new Date(dateTo) : null
    );

    res.json({
      message: 'Backup created successfully',
      backup: result
    });

  } catch (error) {
    console.error('Manual backup error:', error);
    res.status(500).json({
      error: error.message || 'Backup creation failed'
    });
  }
});

// List all backups
router.get('/list', auth, canExportData, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const backups = await backupService.getBackupHistory(parseInt(limit));

    res.json({
      backups,
      total: backups.length
    });

  } catch (error) {
    console.error('Backup list error:', error);
    res.status(500).json({
      error: 'Failed to fetch backup list'
    });
  }
});

// Get backup details
router.get('/:backupId', auth, canExportData, async (req, res) => {
  try {
    const { backupId } = req.params;
    
    const backups = await backupService.getBackupHistory();
    const backup = backups.find(b => b._id === backupId);

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    res.json(backup);

  } catch (error) {
    console.error('Backup details error:', error);
    res.status(500).json({
      error: 'Failed to fetch backup details'
    });
  }
});

// Restore from backup
router.post('/:backupId/restore', auth, adminAuth, async (req, res) => {
  try {
    const { backupId } = req.params;
    const { 
      restoreUsers = false, 
      restoreProducts = true, 
      restoreRecords = true, 
      mergeData = true 
    } = req.body;

    // Find backup record
    const backups = await backupService.getBackupHistory();
    const backup = backups.find(b => b._id === backupId);

    if (!backup || backup.status !== 'completed') {
      return res.status(404).json({
        error: 'Backup not found or incomplete'
      });
    }

    const options = {
      restoreUsers,
      restoreProducts,
      restoreRecords,
      mergeData
    };

    const result = await backupService.restoreFromBackup(backup.filename, options);

    res.json({
      message: 'Restore completed successfully',
      result
    });

  } catch (error) {
    console.error('Backup restore error:', error);
    res.status(500).json({
      error: error.message || 'Restore failed'
    });
  }
});

// Download backup file
router.get('/:backupId/download', auth, canExportData, async (req, res) => {
  try {
    const { backupId } = req.params;
    
    // Find backup record
    const backups = await backupService.getBackupHistory();
    const backup = backups.find(b => b._id === backupId);

    if (!backup || backup.status !== 'completed') {
      return res.status(404).json({
        error: 'Backup not found or incomplete'
      });
    }

    // Get file path and send file
    const filePath = require('path').join(
      require('../utils/cloudStorage').backupsPath,
      backup.filename
    );

    res.download(filePath, backup.filename, (err) => {
      if (err) {
        console.error('Backup download error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Backup file not found' });
        }
      }
    });

  } catch (error) {
    console.error('Backup download error:', error);
    res.status(500).json({
      error: 'Download failed'
    });
  }
});

// Delete backup
router.delete('/:backupId', auth, adminAuth, async (req, res) => {
  try {
    const { backupId } = req.params;
    
    // Find and remove backup record
    const fs = require('fs').promises;
    const fileDatabase = require('../utils/fileDatabase');
    
    const backupsData = await fs.readFile(fileDatabase.backupsFile, 'utf8');
    const backups = JSON.parse(backupsData);
    
    const backupIndex = backups.findIndex(b => b._id === backupId);
    if (backupIndex === -1) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    const backup = backups[backupIndex];
    
    // Delete physical backup file
    if (backup.filename) {
      try {
        const filePath = require('path').join(
          require('../utils/cloudStorage').backupsPath,
          backup.filename
        );
        await fs.unlink(filePath);
        console.log(`🗑️ Deleted backup file: ${backup.filename}`);
      } catch (error) {
        console.warn('Could not delete backup file:', error.message);
      }
    }

    // Remove from backup records
    backups.splice(backupIndex, 1);
    await fs.writeFile(fileDatabase.backupsFile, JSON.stringify(backups, null, 2));

    res.json({
      message: 'Backup deleted successfully'
    });

  } catch (error) {
    console.error('Backup deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete backup'
    });
  }
});

// Export data
router.post('/export', auth, canExportData, async (req, res) => {
  try {
    const { 
      format = 'json', 
      dateFrom, 
      dateTo, 
      dataTypes = ['records'] 
    } = req.body;

    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Format must be "json" or "csv"'
      });
    }

    const validDataTypes = ['records', 'products', 'users'];
    const invalidTypes = dataTypes.filter(type => !validDataTypes.includes(type));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        error: `Invalid data types: ${invalidTypes.join(', ')}`
      });
    }

    const result = await backupService.exportData(format, dateFrom, dateTo, dataTypes);

    res.json({
      message: 'Export completed successfully',
      export: result
    });

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({
      error: error.message || 'Export failed'
    });
  }
});

// Cleanup old backups
router.post('/cleanup', auth, adminAuth, async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;

    if (retentionDays < 1 || retentionDays > 365) {
      return res.status(400).json({
        error: 'Retention days must be between 1 and 365'
      });
    }

    const result = await backupService.cleanupOldBackups(retentionDays);

    res.json({
      message: 'Cleanup completed successfully',
      cleaned: result
    });

  } catch (error) {
    console.error('Backup cleanup error:', error);
    res.status(500).json({
      error: error.message || 'Cleanup failed'
    });
  }
});

// Get backup statistics
router.get('/stats/overview', auth, canExportData, async (req, res) => {
  try {
    const backups = await backupService.getBackupHistory();
    const storageInfo = await cloudStorageService.getStorageInfo ? 
      await cloudStorageService.getStorageInfo() : {};

    // Group backups by type and status
    const stats = {
      total: backups.length,
      byType: {},
      byStatus: {},
      totalSize: 0,
      latestBackup: null,
      oldestBackup: null
    };

    backups.forEach(backup => {
      // Count by type
      stats.byType[backup.type] = (stats.byType[backup.type] || 0) + 1;
      
      // Count by status
      stats.byStatus[backup.status] = (stats.byStatus[backup.status] || 0) + 1;
      
      // Sum sizes
      stats.totalSize += backup.size || 0;
    });

    // Find latest and oldest
    if (backups.length > 0) {
      stats.latestBackup = backups[0]; // Already sorted by date desc
      stats.oldestBackup = backups[backups.length - 1];
    }

    res.json({
      statistics: stats,
      storage: storageInfo
    });

  } catch (error) {
    console.error('Backup stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch backup statistics'
    });
  }
});

module.exports = router;