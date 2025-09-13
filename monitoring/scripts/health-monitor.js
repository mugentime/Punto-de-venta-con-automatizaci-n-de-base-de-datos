/**
 * Health Monitoring Service for POS Railway Deployment
 * @description Comprehensive health checking and alerting system
 * @author Operational Launch Monitor
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const config = require('../config/monitoring-config');

class HealthMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...config, ...options };
    this.isRunning = false;
    this.intervals = [];
    this.metrics = new Map();
    this.alerts = new Map();
    this.startTime = Date.now();
    this.lastHealthCheck = null;
    
    // Bind methods
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.performHealthCheck = this.performHealthCheck.bind(this);
    this.checkEndpoint = this.checkEndpoint.bind(this);
  }

  /**
   * Start the health monitoring service
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Health monitor is already running');
      return;
    }

    console.log('🏥 Starting Health Monitor for POS Railway Deployment');
    console.log(`📊 Target URL: ${this.config.deployment.url}`);
    console.log(`⏱️ Check interval: ${this.config.healthChecks.interval}ms`);
    
    this.isRunning = true;
    this.emit('started');

    // Start health check interval
    const healthInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❌ Health check error:', error.message);
        this.emit('error', error);
      }
    }, this.config.healthChecks.interval);

    this.intervals.push(healthInterval);

    // Start metrics collection interval
    const metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('❌ Metrics collection error:', error.message);
      }
    }, this.config.metrics.collection.interval);

    this.intervals.push(metricsInterval);

    // Perform initial health check
    await this.performHealthCheck();
    
    console.log('✅ Health monitor started successfully');
  }

  /**
   * Stop the health monitoring service
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Health monitor is not running');
      return;
    }

    console.log('⏹️ Stopping Health Monitor');
    this.isRunning = false;

    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];

    this.emit('stopped');
    console.log('✅ Health monitor stopped');
  }

  /**
   * Perform comprehensive health check on all endpoints
   */
  async performHealthCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      checks: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    console.log(`🏥 Performing health check at ${results.timestamp}`);

    for (const endpoint of this.config.healthChecks.endpoints) {
      const checkResult = await this.checkEndpoint(endpoint);
      results.checks.push(checkResult);
      results.summary.total++;

      if (checkResult.status === 'pass') {
        results.summary.passed++;
      } else if (checkResult.status === 'fail') {
        results.summary.failed++;
        if (endpoint.critical) {
          results.overall = 'unhealthy';
        }
      } else {
        results.summary.warnings++;
      }

      // Trigger alerts for failed critical checks
      if (checkResult.status === 'fail' && endpoint.critical) {
        await this.triggerAlert('health_check_failed', {
          endpoint: endpoint.name,
          url: endpoint.url,
          error: checkResult.error,
          timestamp: results.timestamp
        });
      }

      // Check response time thresholds
      if (checkResult.responseTime > this.config.performance.responseTime.critical) {
        await this.triggerAlert('response_time_high', {
          endpoint: endpoint.name,
          responseTime: checkResult.responseTime,
          threshold: this.config.performance.responseTime.critical,
          timestamp: results.timestamp
        });
      }
    }

    this.lastHealthCheck = results;
    this.emit('healthCheck', results);

    // Log summary
    const statusIcon = results.overall === 'healthy' ? '✅' : '❌';
    console.log(`${statusIcon} Health check complete: ${results.summary.passed}/${results.summary.total} passed`);
    
    if (results.summary.failed > 0) {
      console.log(`⚠️ Failed checks: ${results.summary.failed}`);
    }

    return results;
  }

  /**
   * Check a specific endpoint
   */
  async checkEndpoint(endpoint) {
    const startTime = Date.now();
    const fullUrl = endpoint.url.startsWith('http') 
      ? endpoint.url 
      : `${this.config.deployment.url}${endpoint.url}`;

    const result = {
      name: endpoint.name,
      url: fullUrl,
      status: 'pass',
      responseTime: 0,
      statusCode: null,
      error: null,
      timestamp: new Date().toISOString(),
      details: {}
    };

    try {
      const response = await axios.get(fullUrl, {
        timeout: this.config.healthChecks.timeout,
        validateStatus: () => true // Don't throw on HTTP errors
      });

      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;

      // Check expected status code
      if (response.status !== endpoint.expectedStatus) {
        result.status = 'fail';
        result.error = `Expected status ${endpoint.expectedStatus}, got ${response.status}`;
        return result;
      }

      // Check expected fields if specified
      if (endpoint.expectedFields && Array.isArray(endpoint.expectedFields)) {
        const responseData = response.data;
        const missingFields = endpoint.expectedFields.filter(field => 
          !responseData.hasOwnProperty(field)
        );

        if (missingFields.length > 0) {
          result.status = 'warning';
          result.error = `Missing expected fields: ${missingFields.join(', ')}`;
        }

        // Store relevant response data
        result.details = endpoint.expectedFields.reduce((acc, field) => {
          if (responseData.hasOwnProperty(field)) {
            acc[field] = responseData[field];
          }
          return acc;
        }, {});
      }

      // Check response time performance
      if (result.responseTime > this.config.performance.responseTime.poor) {
        result.status = result.status === 'pass' ? 'warning' : result.status;
        result.details.performanceWarning = `Slow response time: ${result.responseTime}ms`;
      }

    } catch (error) {
      result.status = 'fail';
      result.responseTime = Date.now() - startTime;
      result.error = error.message;

      // Check for specific error types
      if (error.code === 'ECONNREFUSED') {
        result.error = 'Connection refused - service may be down';
      } else if (error.code === 'ETIMEDOUT') {
        result.error = 'Request timeout - service not responding';
      } else if (error.response) {
        result.statusCode = error.response.status;
        result.error = `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
    }

    return result;
  }

  /**
   * Collect system and application metrics
   */
  async collectMetrics() {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: await this.getSystemMetrics(),
      application: await this.getApplicationMetrics(),
      business: await this.getBusinessMetrics()
    };

    // Store metrics with timestamp key
    const metricsKey = Date.now();
    this.metrics.set(metricsKey, metrics);

    // Clean old metrics based on retention policy
    this.cleanOldMetrics();

    this.emit('metrics', metrics);
    return metrics;
  }

  /**
   * Get system metrics (memory, CPU, etc.)
   */
  async getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        usage: memUsage.heapUsed / memUsage.heapTotal
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      loadAverage: require('os').loadavg()
    };
  }

  /**
   * Get application-specific metrics from health endpoints
   */
  async getApplicationMetrics() {
    try {
      const healthUrl = `${this.config.deployment.url}/api/health`;
      const versionUrl = `${this.config.deployment.url}/api/version`;
      
      const [healthResponse, versionResponse] = await Promise.allSettled([
        axios.get(healthUrl, { timeout: 5000 }),
        axios.get(versionUrl, { timeout: 5000 })
      ]);

      const metrics = {};

      if (healthResponse.status === 'fulfilled') {
        const healthData = healthResponse.value.data;
        metrics.health = {
          isDatabaseReady: healthData.isDatabaseReady,
          databaseResponseTime: healthData.databaseResponseTime,
          uptime: healthData.uptime,
          environment: healthData.environment
        };
      }

      if (versionResponse.status === 'fulfilled') {
        const versionData = versionResponse.value.data;
        metrics.version = {
          version: versionData.version,
          commit: versionData.commit,
          buildTime: versionData.buildTime,
          nodeVersion: versionData.nodeVersion
        };
      }

      return metrics;
    } catch (error) {
      console.error('Error collecting application metrics:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Get business metrics (if available)
   */
  async getBusinessMetrics() {
    try {
      // Try to get stats from the application
      const statsUrl = `${this.config.deployment.url}/api/stats`;
      const response = await axios.get(statsUrl, { 
        timeout: 5000,
        headers: {
          'Authorization': process.env.MONITORING_AUTH_TOKEN || ''
        }
      });

      return response.data;
    } catch (error) {
      return { available: false, reason: 'No authentication or endpoint unavailable' };
    }
  }

  /**
   * Clean old metrics based on retention policy
   */
  cleanOldMetrics() {
    const now = Date.now();
    const retention = this.config.metrics.collection.retention.raw;
    
    for (const [timestamp, metrics] of this.metrics.entries()) {
      if (now - timestamp > retention) {
        this.metrics.delete(timestamp);
      }
    }
  }

  /**
   * Trigger an alert
   */
  async triggerAlert(alertType, data) {
    const alertRule = this.config.alerts.rules.find(rule => rule.condition === alertType);
    if (!alertRule) return;

    // Check cooldown period
    const lastAlert = this.alerts.get(alertType);
    if (lastAlert && Date.now() - lastAlert.timestamp < alertRule.cooldown) {
      return; // Still in cooldown period
    }

    const alert = {
      type: alertType,
      severity: alertRule.severity,
      name: alertRule.name,
      description: alertRule.description,
      data,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString()
    };

    // Store alert
    this.alerts.set(alertType, alert);

    // Send notifications
    await this.sendAlert(alert);

    this.emit('alert', alert);
    console.log(`🚨 Alert triggered: ${alert.name} (${alert.severity})`);
  }

  /**
   * Send alert notifications
   */
  async sendAlert(alert) {
    const channels = this.config.alerts.channels;

    // Console notification
    if (channels.console.enabled) {
      const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
      console.log(`${icon} ALERT [${alert.severity.toUpperCase()}]: ${alert.name}`);
      console.log(`   ${alert.description}`);
      if (alert.data) {
        console.log(`   Details:`, JSON.stringify(alert.data, null, 2));
      }
    }

    // Email notification
    if (channels.email.enabled && channels.email.recipients.length > 0) {
      try {
        await this.sendEmailAlert(alert);
      } catch (error) {
        console.error('❌ Failed to send email alert:', error.message);
      }
    }

    // Webhook notification
    if (channels.webhook.enabled && channels.webhook.urls.length > 0) {
      for (const url of channels.webhook.urls) {
        try {
          await axios.post(url, alert, { timeout: 5000 });
        } catch (error) {
          console.error(`❌ Failed to send webhook alert to ${url}:`, error.message);
        }
      }
    }

    // Slack notification
    if (channels.slack.enabled) {
      try {
        await this.sendSlackAlert(alert);
      } catch (error) {
        console.error('❌ Failed to send Slack alert:', error.message);
      }
    }
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter(this.config.alerts.channels.email.smtp);

    const context = {
      severity: alert.severity,
      alertName: alert.name,
      environment: this.config.deployment.environment,
      description: alert.description,
      timestamp: alert.timestampISO,
      details: JSON.stringify(alert.data, null, 2),
      critical: alert.severity === 'critical',
      dashboardUrl: `${this.config.deployment.url}/monitoring/dashboard`
    };

    const mailOptions = {
      from: this.config.alerts.channels.email.smtp.auth.user,
      to: this.config.alerts.channels.email.recipients.join(', '),
      subject: `[${alert.severity.toUpperCase()}] ${alert.name} - POS Conejo Negro`,
      html: this.renderTemplate(this.config.templates.email.html, context)
    };

    await transporter.sendMail(mailOptions);
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    const context = {
      severity: alert.severity.toUpperCase(),
      alertName: alert.name,
      environment: this.config.deployment.environment,
      timestamp: alert.timestampISO,
      description: alert.description
    };

    const payload = {
      channel: this.config.alerts.channels.slack.channel,
      blocks: this.config.templates.slack.blocks.map(block => ({
        ...block,
        text: block.text ? {
          ...block.text,
          text: this.renderTemplate(block.text.text, context)
        } : undefined,
        fields: block.fields ? block.fields.map(field => ({
          ...field,
          text: this.renderTemplate(field.text, context)
        })) : undefined
      }))
    };

    await axios.post(this.config.alerts.channels.slack.webhookUrl, payload);
  }

  /**
   * Simple template rendering
   */
  renderTemplate(template, context) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] || match;
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
      lastHealthCheck: this.lastHealthCheck,
      metricsCount: this.metrics.size,
      alertsCount: this.alerts.size,
      configuration: {
        checkInterval: this.config.healthChecks.interval,
        metricsInterval: this.config.metrics.collection.interval,
        endpointsCount: this.config.healthChecks.endpoints.length
      }
    };
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count = 10) {
    const recent = Array.from(this.metrics.entries())
      .sort(([a], [b]) => b - a)
      .slice(0, count);
    
    return recent.map(([timestamp, metrics]) => ({
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      ...metrics
    }));
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count = 10) {
    return Array.from(this.alerts.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }
}

module.exports = HealthMonitor;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const monitor = new HealthMonitor();

  switch (command) {
    case 'start':
      monitor.start().catch(console.error);
      break;
    case 'test':
      monitor.performHealthCheck().then(result => {
        console.log('Health check result:', JSON.stringify(result, null, 2));
        process.exit(result.overall === 'healthy' ? 0 : 1);
      }).catch(error => {
        console.error('Health check failed:', error);
        process.exit(1);
      });
      break;
    default:
      console.log('Usage: node health-monitor.js [start|test]');
      process.exit(1);
  }
}