const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'manual'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'uploading', 'completed', 'failed'],
    default: 'pending'
  },
  googleDriveFileId: {
    type: String,
    sparse: true
  },
  size: {
    type: Number, // Size in bytes
    min: 0
  },
  recordsCount: {
    type: Number,
    min: 0,
    default: 0
  },
  productsCount: {
    type: Number,
    min: 0,
    default: 0
  },
  usersCount: {
    type: Number,
    min: 0,
    default: 0
  },
  dateFrom: {
    type: Date,
    required: true
  },
  dateTo: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  error: {
    type: String,
    maxlength: 1000
  },
  completedAt: {
    type: Date
  },
  metadata: {
    version: {
      type: String,
      default: '1.0'
    },
    compression: {
      type: String,
      enum: ['none', 'gzip'],
      default: 'none'
    },
    checksum: {
      type: String // For data integrity verification
    }
  }
}, {
  timestamps: true
});

// Indexes
backupSchema.index({ type: 1, createdAt: -1 });
backupSchema.index({ status: 1 });
backupSchema.index({ dateFrom: 1, dateTo: 1 });
backupSchema.index({ createdBy: 1, createdAt: -1 });

// Static method to find successful backups
backupSchema.statics.findCompleted = function() {
  return this.find({ status: 'completed' }).sort({ createdAt: -1 });
};

// Static method to find backups by date range
backupSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    dateFrom: { $gte: new Date(startDate) },
    dateTo: { $lte: new Date(endDate) }
  }).sort({ createdAt: -1 });
};

// Static method to find latest backup of each type
backupSchema.statics.findLatestByType = async function() {
  const types = ['daily', 'weekly', 'monthly', 'manual'];
  const results = {};
  
  for (const type of types) {
    const latest = await this.findOne({ 
      type, 
      status: 'completed' 
    }).sort({ createdAt: -1 });
    results[type] = latest;
  }
  
  return results;
};

// Static method to cleanup old backups
backupSchema.statics.cleanup = async function(retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    type: { $ne: 'manual' } // Keep manual backups
  });
};

// Instance method to mark as completed
backupSchema.methods.markCompleted = function(googleDriveFileId, size) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.googleDriveFileId = googleDriveFileId;
  this.size = size;
  return this.save();
};

// Instance method to mark as failed
backupSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.error = error;
  return this.save();
};

module.exports = mongoose.model('Backup', backupSchema);