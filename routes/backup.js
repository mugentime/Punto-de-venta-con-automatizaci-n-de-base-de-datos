const express = require('express');
const backupService = require('../utils/backupService');
const cloudStorageService = require('../utils/cloudStorage');
const Backup = require('../models/Backup');
const { auth, canExportData, adminAuth } = require('../middleware/auth');

const router = express.Router();

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
    const { type, limit = 50 } = req.query;
    
    let query = {};
    if (type) {
      query.type = type;
    }

    const backups = await Backup.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      backups,
      total: backups.length
    });

  } catch (error) {
    console.error('Backup list error:', error);
    res.status(500).json({
      error: 'Failed to fetch backups'
    });
  }
});

// Get backup details
router.get('/:id', auth, canExportData, async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    res.json(backup);

  } catch (error) {
    console.error('Backup details error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid backup ID'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch backup details'
    });
  }
});

// Download backup file
router.get('/:id/download', auth, canExportData, async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    if (backup.status !== 'completed') {
      return res.status(400).json({
        error: 'Backup is not completed yet'
      });
    }

    if (!backup.googleDriveFileId) {
      return res.status(400).json({
        error: 'Backup file not available'
      });
    }

    // Create a shareable link
    const shareableLink = await googleDriveService.createShareableLink(backup.googleDriveFileId);

    res.json({
      message: 'Download link created',
      downloadUrl: shareableLink,
      filename: backup.filename,
      size: backup.size
    });

  } catch (error) {
    console.error('Backup download error:', error);
    res.status(500).json({
      error: error.message || 'Download link creation failed'
    });
  }
});

// Restore from backup (admin only)
router.post('/:id/restore', auth, adminAuth, async (req, res) => {
  try {
    const { restoreUsers = true, restoreProducts = true, restoreRecords = true } = req.body;

    const result = await backupService.restoreFromBackup(req.params.id, {
      restoreUsers,
      restoreProducts,
      restoreRecords
    });

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

// Delete backup (admin only)
router.delete('/:id', auth, adminAuth, async (req, res) => {
  try {
    const backup = await Backup.findById(req.params.id);

    if (!backup) {
      return res.status(404).json({
        error: 'Backup not found'
      });
    }

    // Delete from Google Drive if exists
    if (backup.googleDriveFileId) {
      try {
        // Note: Google Drive API doesn't have a direct delete method in our current implementation
        // This would need to be added to the googleDriveService
        console.log(`Should delete Google Drive file: ${backup.googleDriveFileId}`);
      } catch (driveError) {
        console.error('Failed to delete from Google Drive:', driveError);
        // Continue with database deletion even if Drive deletion fails
      }
    }

    // Delete from database
    await Backup.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Backup deleted successfully'
    });

  } catch (error) {
    console.error('Backup deletion error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid backup ID'
      });
    }

    res.status(500).json({
      error: 'Backup deletion failed'
    });
  }
});

// Cleanup old backups (admin only)
router.post('/cleanup', auth, adminAuth, async (req, res) => {
  try {
    const { retentionDays = 30 } = req.body;

    if (retentionDays < 7) {
      return res.status(400).json({
        error: 'Retention period must be at least 7 days'
      });
    }

    const result = await backupService.cleanupOldBackups(parseInt(retentionDays));

    res.json({
      message: 'Cleanup completed successfully',
      result
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
    const [
      totalBackups,
      completedBackups,
      failedBackups,
      latestBackups,
      storageInfo
    ] = await Promise.all([
      Backup.countDocuments(),
      Backup.countDocuments({ status: 'completed' }),
      Backup.countDocuments({ status: 'failed' }),
      Backup.findLatestByType(),
      googleDriveService.getStorageInfo().catch(() => ({ used: 0, total: 0 }))
    ]);

    // Calculate total backup size
    const sizeResult = await Backup.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
    ]);
    const totalSize = sizeResult[0]?.totalSize || 0;

    res.json({
      statistics: {
        totalBackups,
        completedBackups,
        failedBackups,
        pendingBackups: totalBackups - completedBackups - failedBackups,
        totalSize
      },
      latestBackups,
      storage: storageInfo
    });

  } catch (error) {
    console.error('Backup stats error:', error);
    res.status(500).json({
      error: 'Failed to fetch backup statistics'
    });
  }
});

// Test Google Drive connection
router.get('/test/connection', auth, adminAuth, async (req, res) => {
  try {
    if (!googleDriveService.initialized) {
      await googleDriveService.initialize();
    }

    const userInfo = await googleDriveService.testConnection();
    const storageInfo = await googleDriveService.getStorageInfo();

    res.json({
      message: 'Google Drive connection successful',
      userInfo,
      storageInfo,
      connected: true
    });

  } catch (error) {
    console.error('Google Drive connection test error:', error);
    res.status(500).json({
      error: error.message || 'Google Drive connection test failed',
      connected: false
    });
  }
});

module.exports = router;