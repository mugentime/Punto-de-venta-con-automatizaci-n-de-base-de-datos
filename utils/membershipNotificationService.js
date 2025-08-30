const databaseManager = require('./databaseManager');
const cron = require('node-cron');

class MembershipNotificationService {
  constructor() {
    this.initialized = false;
    this.jobs = new Map();
    this.notifications = [];
  }

  async initialize() {
    try {
      // Setup daily check for expiring memberships
      this.setupExpirationChecks();
      
      this.initialized = true;
      console.log('✅ Membership notification service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize membership notification service:', error);
    }
  }

  setupExpirationChecks() {
    // Check every day at 9:00 AM for expiring memberships
    const dailyCheck = cron.schedule('0 9 * * *', async () => {
      try {
        console.log('🔔 Checking for expiring memberships...');
        await this.checkExpiringMemberships();
      } catch (error) {
        console.error('❌ Failed to check expiring memberships:', error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City'
    });

    this.jobs.set('dailyExpirationCheck', dailyCheck);
    dailyCheck.start();
    
    console.log('📅 Daily membership expiration check scheduled (9:00 AM)');
  }

  async checkExpiringMemberships() {
    try {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const filters = {
        endDate: { $lte: threeDaysFromNow },
        status: 'active'
      };

      const result = await databaseManager.getMemberships(filters);
      const expiringMemberships = result.data || [];
      
      if (expiringMemberships.length === 0) {
        console.log('✅ No memberships expiring in the next 3 days');
        return;
      }

      // Create notifications for expiring memberships
      for (const membership of expiringMemberships) {
        const daysRemaining = this.calculateDaysRemaining(membership);
        
        const notification = {
          id: this.generateId(),
          type: 'membership_expiring',
          title: 'Membresía por vencer',
          message: `La membresía de ${membership.clientName} vence ${daysRemaining === 0 ? 'hoy' : daysRemaining === 1 ? 'mañana' : `en ${daysRemaining} días`}`,
          membershipId: membership.id,
          clientName: membership.clientName,
          daysRemaining,
          priority: daysRemaining === 0 ? 'high' : daysRemaining === 1 ? 'medium' : 'low',
          createdAt: new Date(),
          read: false
        };

        this.addNotification(notification);
        
        console.log(`🔔 Notification created: ${membership.clientName} - ${daysRemaining} days remaining`);
      }

      console.log(`✅ Created ${expiringMemberships.length} expiration notifications`);
      
      return expiringMemberships.length;
    } catch (error) {
      console.error('Error checking expiring memberships:', error);
      return 0;
    }
  }

  addNotification(notification) {
    // Remove existing notification for same membership if exists
    this.notifications = this.notifications.filter(n => 
      !(n.type === 'membership_expiring' && n.membershipId === notification.membershipId)
    );
    
    this.notifications.unshift(notification);
    
    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
  }

  getNotifications(options = {}) {
    let notifications = [...this.notifications];
    
    // Filter by read status
    if (options.unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    
    // Filter by type
    if (options.type) {
      notifications = notifications.filter(n => n.type === options.type);
    }
    
    // Filter by priority
    if (options.priority) {
      notifications = notifications.filter(n => n.priority === options.priority);
    }
    
    // Apply limit
    const limit = options.limit || 50;
    return notifications.slice(0, limit);
  }

  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      notification.readAt = new Date();
      return true;
    }
    return false;
  }

  markAllAsRead() {
    const count = this.notifications.filter(n => !n.read).length;
    this.notifications.forEach(n => {
      if (!n.read) {
        n.read = true;
        n.readAt = new Date();
      }
    });
    return count;
  }

  deleteNotification(notificationId) {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      return true;
    }
    return false;
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  calculateDaysRemaining(membership) {
    if (membership.status === 'expired' || membership.status === 'cancelled') {
      return 0;
    }
    const now = new Date();
    const end = new Date(membership.endDate);
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }

  // Manual trigger for testing
  async triggerExpirationCheck() {
    try {
      console.log('🔄 Manually triggering expiration check...');
      const count = await this.checkExpiringMemberships();
      console.log(`✅ Manual expiration check completed: ${count} notifications created`);
      return count;
    } catch (error) {
      console.error('❌ Manual expiration check failed:', error);
      throw error;
    }
  }

  // Create custom notification
  createCustomNotification(type, title, message, data = {}) {
    const notification = {
      id: this.generateId(),
      type,
      title,
      message,
      ...data,
      priority: data.priority || 'medium',
      createdAt: new Date(),
      read: false
    };

    this.addNotification(notification);
    return notification;
  }

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  stopAllJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`⏹️ Notification ${name} job stopped`);
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
const membershipNotificationService = new MembershipNotificationService();

// Initialize service when the module is loaded
membershipNotificationService.initialize();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Shutting down membership notification service...');
  membershipNotificationService.stopAllJobs();
});

process.on('SIGINT', () => {
  console.log('🔄 Shutting down membership notification service...');
  membershipNotificationService.stopAllJobs();
});

module.exports = membershipNotificationService;