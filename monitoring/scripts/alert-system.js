/**
 * Alert System for POS Railway Deployment
 * @description Comprehensive alerting with multiple notification channels
 * @author Operational Launch Monitor
 */

const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/monitoring-config');

class AlertSystem {
  constructor(options = {}) {
    this.config = { ...config.alerts, ...options };
    this.alertHistory = new Map();
    this.isInitialized = false;
    this.emailTransporter = null;
  }

  /**
   * Initialize the alert system
   */
  async initialize() {
    console.log('🚨 Initializing Alert System');
    
    // Setup email transporter if enabled
    if (this.config.channels.email.enabled) {
      try {
        this.emailTransporter = nodemailer.createTransporter(this.config.channels.email.smtp);
        await this.emailTransporter.verify();
        console.log('✅ Email alerts configured');
      } catch (error) {
        console.error('❌ Email configuration failed:', error.message);
        this.config.channels.email.enabled = false;
      }
    }

    // Test webhook endpoints if enabled
    if (this.config.channels.webhook.enabled) {
      let activeWebhooks = 0;
      for (const url of this.config.channels.webhook.urls) {
        try {
          await axios.head(url, { timeout: 5000 });
          activeWebhooks++;
        } catch (error) {
          console.warn(`⚠️ Webhook ${url} is not responding`);
        }
      }
      console.log(`✅ ${activeWebhooks}/${this.config.channels.webhook.urls.length} webhooks active`);
    }

    // Test Slack webhook if enabled
    if (this.config.channels.slack.enabled) {
      try {
        await this.sendTestSlackMessage();
        console.log('✅ Slack alerts configured');
      } catch (error) {
        console.error('❌ Slack configuration failed:', error.message);
        this.config.channels.slack.enabled = false;
      }
    }

    this.isInitialized = true;
    console.log('✅ Alert System initialized successfully');
  }

  /**
   * Send test Slack message
   */
  async sendTestSlackMessage() {
    const payload = {
      channel: this.config.channels.slack.channel,
      text: 'POS Alert System - Test Message',
      attachments: [
        {
          color: 'good',
          fields: [
            {
              title: 'Status',
              value: 'Alert system initialization complete',
              short: true
            },
            {
              title: 'Time',
              value: new Date().toISOString(),
              short: true
            }
          ]
        }
      ]
    };

    await axios.post(this.config.channels.slack.webhookUrl, payload, {
      timeout: 5000
    });
  }

  /**
   * Trigger an alert
   */
  async trigger(alertType, data = {}) {
    if (!this.isInitialized) {
      console.warn('⚠️ Alert system not initialized, initializing now...');
      await this.initialize();
    }

    // Find matching alert rule
    const rule = this.config.rules.find(r => r.condition === alertType);
    if (!rule) {
      console.error(`❌ No alert rule found for type: ${alertType}`);
      return false;
    }

    // Check cooldown period
    const lastAlert = this.alertHistory.get(alertType);
    if (lastAlert && Date.now() - lastAlert.timestamp < rule.cooldown) {
      console.log(`⏸️ Alert ${alertType} is in cooldown period`);
      return false;
    }

    // Create alert object
    const alert = {
      id: this.generateAlertId(),
      type: alertType,
      name: rule.name,
      severity: rule.severity,
      description: rule.description,
      data,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      rule
    };

    // Store in history
    this.alertHistory.set(alertType, alert);

    // Send notifications
    const results = await this.sendNotifications(alert);

    // Log alert
    this.logAlert(alert, results);

    return {
      alert,
      notificationResults: results
    };
  }

  /**
   * Send notifications through all enabled channels
   */
  async sendNotifications(alert) {
    const results = [];

    // Console notification
    if (this.config.channels.console.enabled) {
      results.push(await this.sendConsoleAlert(alert));
    }

    // Email notification
    if (this.config.channels.email.enabled && this.emailTransporter) {
      results.push(await this.sendEmailAlert(alert));
    }

    // Webhook notifications
    if (this.config.channels.webhook.enabled) {
      for (const url of this.config.channels.webhook.urls) {
        results.push(await this.sendWebhookAlert(alert, url));
      }
    }

    // Slack notification
    if (this.config.channels.slack.enabled) {
      results.push(await this.sendSlackAlert(alert));
    }

    return results;
  }

  /**
   * Send console alert
   */
  async sendConsoleAlert(alert) {
    try {
      const icon = this.getSeverityIcon(alert.severity);
      const color = this.getSeverityColor(alert.severity);
      
      console.log(`\n${icon} ALERT [${alert.severity.toUpperCase()}]: ${alert.name}`);
      console.log(`   📋 ${alert.description}`);
      console.log(`   🕒 ${alert.timestampISO}`);
      
      if (alert.data && Object.keys(alert.data).length > 0) {
        console.log('   📊 Details:', JSON.stringify(alert.data, null, 2));
      }
      
      return { channel: 'console', success: true };
    } catch (error) {
      return { channel: 'console', success: false, error: error.message };
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const subject = this.renderTemplate(
        config.templates.email.subject, 
        this.getTemplateContext(alert)
      );

      const html = this.renderTemplate(
        config.templates.email.html,
        this.getTemplateContext(alert)
      );

      const mailOptions = {
        from: this.config.channels.email.smtp.auth.user,
        to: this.config.channels.email.recipients.join(', '),
        subject,
        html
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      
      return { 
        channel: 'email', 
        success: true, 
        recipients: this.config.channels.email.recipients.length,
        messageId: info.messageId
      };
    } catch (error) {
      return { channel: 'email', success: false, error: error.message };
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert, webhookUrl) {
    try {
      const payload = {
        alert: {
          id: alert.id,
          type: alert.type,
          name: alert.name,
          severity: alert.severity,
          description: alert.description,
          timestamp: alert.timestampISO,
          data: alert.data
        },
        service: {
          name: 'POS Conejo Negro',
          environment: config.deployment.environment,
          url: config.deployment.url
        }
      };

      const response = await axios.post(webhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'POS-AlertSystem/1.0'
        }
      });

      return { 
        channel: 'webhook', 
        url: webhookUrl,
        success: true, 
        statusCode: response.status 
      };
    } catch (error) {
      return { 
        channel: 'webhook', 
        url: webhookUrl,
        success: false, 
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const context = this.getTemplateContext(alert);
      const color = this.getSlackColor(alert.severity);
      
      const payload = {
        channel: this.config.channels.slack.channel,
        username: 'POS Alert System',
        icon_emoji: ':warning:',
        attachments: [
          {
            color,
            title: `${this.getSeverityIcon(alert.severity)} ${alert.name}`,
            text: alert.description,
            fields: [
              {
                title: 'Severity',
                value: alert.severity.toUpperCase(),
                short: true
              },
              {
                title: 'Service',
                value: 'POS Conejo Negro',
                short: true
              },
              {
                title: 'Environment',
                value: config.deployment.environment,
                short: true
              },
              {
                title: 'Time',
                value: alert.timestampISO,
                short: true
              }
            ],
            footer: 'POS Monitoring System',
            ts: Math.floor(alert.timestamp / 1000)
          }
        ]
      };

      // Add data fields if available
      if (alert.data && Object.keys(alert.data).length > 0) {
        payload.attachments[0].fields.push({
          title: 'Details',
          value: '```' + JSON.stringify(alert.data, null, 2) + '```',
          short: false
        });
      }

      const response = await axios.post(
        this.config.channels.slack.webhookUrl, 
        payload,
        { timeout: 10000 }
      );

      return { 
        channel: 'slack', 
        success: true, 
        statusCode: response.status 
      };
    } catch (error) {
      return { 
        channel: 'slack', 
        success: false, 
        error: error.message,
        statusCode: error.response?.status
      };
    }
  }

  /**
   * Get template context for rendering
   */
  getTemplateContext(alert) {
    return {
      alertId: alert.id,
      alertName: alert.name,
      severity: alert.severity,
      description: alert.description,
      timestamp: alert.timestampISO,
      environment: config.deployment.environment,
      serviceUrl: config.deployment.url,
      dashboardUrl: `${config.deployment.url}/monitoring/dashboard`,
      critical: alert.severity === 'critical',
      details: alert.data ? JSON.stringify(alert.data, null, 2) : ''
    };
  }

  /**
   * Simple template rendering
   */
  renderTemplate(template, context) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? context[key] : match;
    });
  }

  /**
   * Generate unique alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    const icons = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️',
      success: '✅'
    };
    return icons[severity] || '❓';
  }

  /**
   * Get severity color for console
   */
  getSeverityColor(severity) {
    const colors = {
      critical: '\x1b[31m', // Red
      warning: '\x1b[33m',  // Yellow
      info: '\x1b[36m',     // Cyan
      success: '\x1b[32m'   // Green
    };
    return colors[severity] || '\x1b[0m';
  }

  /**
   * Get Slack color for severity
   */
  getSlackColor(severity) {
    const colors = {
      critical: 'danger',
      warning: 'warning',
      info: '#36a64f',
      success: 'good'
    };
    return colors[severity] || '#808080';
  }

  /**
   * Log alert to file
   */
  async logAlert(alert, results) {
    try {
      const logEntry = {
        timestamp: alert.timestampISO,
        alert: {
          id: alert.id,
          type: alert.type,
          name: alert.name,
          severity: alert.severity,
          description: alert.description,
          data: alert.data
        },
        notifications: results.map(r => ({
          channel: r.channel,
          success: r.success,
          error: r.error || null
        }))
      };

      const logDir = path.join(__dirname, '..', 'logs');
      await fs.mkdir(logDir, { recursive: true });
      
      const logFile = path.join(logDir, `alerts-${new Date().toISOString().split('T')[0]}.json`);
      
      let existingLogs = [];
      try {
        const existing = await fs.readFile(logFile, 'utf8');
        existingLogs = JSON.parse(existing);
      } catch (error) {
        // File doesn't exist or is invalid, start fresh
      }
      
      existingLogs.push(logEntry);
      await fs.writeFile(logFile, JSON.stringify(existingLogs, null, 2));
      
    } catch (error) {
      console.error('❌ Failed to log alert:', error.message);
    }
  }

  /**
   * Get alert statistics
   */
  getStatistics(hours = 24) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentAlerts = Array.from(this.alertHistory.values())
      .filter(alert => alert.timestamp > cutoffTime);

    const stats = {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.severity === 'critical').length,
      warning: recentAlerts.filter(a => a.severity === 'warning').length,
      info: recentAlerts.filter(a => a.severity === 'info').length,
      byType: {}
    };

    // Group by alert type
    recentAlerts.forEach(alert => {
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Test all notification channels
   */
  async testAllChannels() {
    console.log('🧪 Testing all notification channels...');
    
    const testAlert = {
      id: 'test_alert_' + Date.now(),
      type: 'test',
      name: 'Alert System Test',
      severity: 'info',
      description: 'This is a test alert to verify all notification channels are working',
      data: {
        test: true,
        timestamp: new Date().toISOString()
      },
      timestamp: Date.now(),
      timestampISO: new Date().toISOString(),
      rule: { name: 'Test Rule', cooldown: 0 }
    };

    const results = await this.sendNotifications(testAlert);
    
    console.log('🧪 Test Results:');
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.channel}: ${result.success ? 'OK' : result.error}`);
    });

    return results;
  }
}

module.exports = AlertSystem;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const alertSystem = new AlertSystem();

  async function runCommand() {
    switch (command) {
      case 'init':
        await alertSystem.initialize();
        break;
        
      case 'test':
        await alertSystem.initialize();
        await alertSystem.testAllChannels();
        break;
        
      case 'trigger':
        const alertType = process.argv[3];
        const data = process.argv[4] ? JSON.parse(process.argv[4]) : {};
        
        if (!alertType) {
          console.error('❌ Alert type is required');
          console.log('Usage: node alert-system.js trigger <alert_type> [data_json]');
          process.exit(1);
        }
        
        await alertSystem.initialize();
        const result = await alertSystem.trigger(alertType, data);
        
        if (result) {
          console.log('✅ Alert triggered successfully');
          console.log('Alert ID:', result.alert.id);
        } else {
          console.log('⚠️ Alert not sent (cooldown or invalid type)');
        }
        break;
        
      case 'stats':
        const hours = parseInt(process.argv[3]) || 24;
        const stats = alertSystem.getStatistics(hours);
        console.log(`📊 Alert Statistics (last ${hours} hours):`);
        console.log(JSON.stringify(stats, null, 2));
        break;
        
      default:
        console.log('POS Alert System Commands:');
        console.log('  init                     - Initialize alert system');
        console.log('  test                     - Test all notification channels');
        console.log('  trigger <type> [data]    - Trigger a specific alert');
        console.log('  stats [hours]            - Show alert statistics');
        process.exit(1);
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}