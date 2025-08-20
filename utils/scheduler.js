const cron = require('node-cron');
const backupService = require('./backupService-file');
const cloudStorageService = require('./cloudStorage');

class BackupScheduler {
  constructor() {
    this.initialized = false;
    this.jobs = new Map();
  }

  async initialize() {
    try {
      // Initialize cloud storage service
      await cloudStorageService.initialize();
      
      this.setupScheduledBackups();
      this.initialized = true;
      
      console.log('✅ Backup scheduler initialized');
    } catch (error) {
      console.error('❌ Failed to initialize backup scheduler:', error);
    }
  }

  setupScheduledBackups() {
    // Daily backup at 2:00 AM
    const dailyBackup = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('🔄 Starting scheduled daily backup...');
        await backupService.createBackup('daily');
        console.log('✅ Scheduled daily backup completed');
      } catch (error) {
        console.error('❌ Scheduled daily backup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City' // Adjust to your timezone
    });

    // Weekly backup every Sunday at 3:00 AM
    const weeklyBackup = cron.schedule('0 3 * * 0', async () => {
      try {
        console.log('🔄 Starting scheduled weekly backup...');
        await backupService.createBackup('weekly');
        console.log('✅ Scheduled weekly backup completed');
      } catch (error) {
        console.error('❌ Scheduled weekly backup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City'
    });

    // Monthly backup on the 1st of each month at 4:00 AM
    const monthlyBackup = cron.schedule('0 4 1 * *', async () => {
      try {
        console.log('🔄 Starting scheduled monthly backup...');
        await backupService.createBackup('monthly');
        console.log('✅ Scheduled monthly backup completed');
      } catch (error) {
        console.error('❌ Scheduled monthly backup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City'
    });

    // Cleanup old backups every week on Saturday at 1:00 AM
    const cleanup = cron.schedule('0 1 * * 6', async () => {
      try {
        console.log('🧹 Starting scheduled backup cleanup...');
        await backupService.cleanupOldBackups(30); // Keep 30 days
        console.log('✅ Scheduled backup cleanup completed');
      } catch (error) {
        console.error('❌ Scheduled backup cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City'
    });

    // Store jobs for management
    this.jobs.set('daily', dailyBackup);
    this.jobs.set('weekly', weeklyBackup);
    this.jobs.set('monthly', monthlyBackup);
    this.jobs.set('cleanup', cleanup);

    // Start all jobs
    this.startAllJobs();
  }

  startAllJobs() {
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`📅 Scheduled ${name} backup job started`);
    });
  }

  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Scheduled ${name} backup job stopped`);
    });
  }

  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      console.log(`📅 Scheduled ${jobName} backup job started`);
      return true;
    }
    return false;
  }

  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      console.log(`⏹️ Scheduled ${jobName} backup job stopped`);
      return true;
    }
    return false;
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

  // Manual trigger for testing
  async triggerBackup(type = 'manual') {
    try {
      console.log(`🔄 Manually triggering ${type} backup...`);
      const result = await backupService.createBackup(type);
      console.log(`✅ Manual ${type} backup completed:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Manual ${type} backup failed:`, error);
      throw error;
    }
  }
}

// Create and export singleton instance
const scheduler = new BackupScheduler();

// Initialize scheduler when the module is loaded
scheduler.initialize();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Shutting down backup scheduler...');
  scheduler.stopAllJobs();
});

process.on('SIGINT', () => {
  console.log('🔄 Shutting down backup scheduler...');
  scheduler.stopAllJobs();
});

module.exports = scheduler;