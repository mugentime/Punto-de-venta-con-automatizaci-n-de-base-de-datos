/**
 * Railway-Specific Monitoring for POS Deployment
 * @description Monitors Railway deployment status, resource usage, and platform-specific metrics
 * @author Operational Launch Monitor
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const config = require('../config/monitoring-config');

class RailwayMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...config, ...options };
    this.deploymentInfo = {
      serviceId: process.env.RAILWAY_SERVICE_ID,
      environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
      projectId: process.env.RAILWAY_PROJECT_ID,
      deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
      publicDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
      gitCommit: process.env.RAILWAY_GIT_COMMIT,
      gitBranch: process.env.RAILWAY_GIT_BRANCH,
      environment: process.env.RAILWAY_ENVIRONMENT
    };
    
    this.metrics = new Map();
    this.isRunning = false;
    this.intervalId = null;
    this.startTime = Date.now();
  }

  /**
   * Initialize Railway monitoring
   */
  async initialize() {
    console.log('🚂 Initializing Railway Monitor');
    console.log('📊 Deployment Info:', this.deploymentInfo);
    
    if (!this.deploymentInfo.serviceId) {
      console.warn('⚠️ No RAILWAY_SERVICE_ID found - some features may not work');
    }
    
    this.isRunning = true;
    console.log('✅ Railway Monitor initialized');
  }

  /**
   * Start monitoring
   */
  async start() {
    if (this.isRunning && this.intervalId) {
      console.log('⚠️ Railway monitor is already running');
      return;
    }

    await this.initialize();
    
    console.log('🚂 Starting Railway Deployment Monitor');
    console.log(`🎯 Service ID: ${this.deploymentInfo.serviceId || 'unknown'}`);
    console.log(`🌍 Public Domain: ${this.deploymentInfo.publicDomain || 'unknown'}`);
    
    // Start monitoring interval
    this.intervalId = setInterval(async () => {
      try {
        await this.collectRailwayMetrics();
      } catch (error) {
        console.error('❌ Railway monitoring error:', error.message);
        this.emit('error', error);
      }
    }, 60000); // Every minute

    // Initial collection
    await this.collectRailwayMetrics();
    
    console.log('✅ Railway monitor started successfully');
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Railway monitor is not running');
      return;
    }

    console.log('⏹️ Stopping Railway Monitor');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.emit('stopped');
    console.log('✅ Railway monitor stopped');
  }

  /**
   * Collect Railway-specific metrics
   */
  async collectRailwayMetrics() {
    const timestamp = Date.now();
    const metrics = {
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      deployment: await this.getDeploymentMetrics(),
      resources: await this.getResourceMetrics(),
      connectivity: await this.getConnectivityMetrics(),
      database: await this.getDatabaseMetrics(),
      environment: await this.getEnvironmentMetrics()
    };

    // Store metrics
    this.metrics.set(timestamp, metrics);
    this.emit('metrics', metrics);

    // Cleanup old metrics (keep last 24 hours)
    this.cleanupOldMetrics();

    // Check for alerts
    await this.checkRailwayAlerts(metrics);

    return metrics;
  }

  /**
   * Get deployment-specific metrics
   */
  async getDeploymentMetrics() {
    const deployment = {
      serviceId: this.deploymentInfo.serviceId,
      environmentId: this.deploymentInfo.environmentId,
      deploymentId: this.deploymentInfo.deploymentId,
      publicDomain: this.deploymentInfo.publicDomain,
      gitCommit: this.deploymentInfo.gitCommit,
      gitBranch: this.deploymentInfo.gitBranch,
      environment: this.deploymentInfo.environment,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch
    };

    // Check if this is a new deployment by comparing commit hash
    const previousMetrics = this.getPreviousMetrics();
    if (previousMetrics && previousMetrics.deployment.gitCommit !== deployment.gitCommit) {
      deployment.newDeployment = true;
      deployment.previousCommit = previousMetrics.deployment.gitCommit;
    }

    return deployment;
  }

  /**
   * Get resource usage metrics
   */
  async getResourceMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        usagePercent: memUsage.heapUsed / memUsage.heapTotal,
        usageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        totalMB: Math.round(memUsage.heapTotal / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        usage: (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds
      },
      uptime: process.uptime(),
      loadAverage: require('os').loadavg()
    };
  }

  /**
   * Test connectivity to Railway services
   */
  async getConnectivityMetrics() {
    const connectivity = {
      publicDomain: false,
      internalServices: {},
      latency: {},
      timestamps: {}
    };

    // Test public domain connectivity
    if (this.deploymentInfo.publicDomain) {
      try {
        const start = Date.now();
        const response = await axios.get(`https://${this.deploymentInfo.publicDomain}/api/health`, {
          timeout: 10000,
          validateStatus: () => true
        });
        
        connectivity.publicDomain = response.status === 200;
        connectivity.latency.publicDomain = Date.now() - start;
        connectivity.timestamps.publicDomain = new Date().toISOString();
      } catch (error) {
        connectivity.publicDomain = false;
        connectivity.latency.publicDomain = -1;
        connectivity.error = error.message;
      }
    }

    // Test internal Railway network (if available)
    if (process.env.DATABASE_URL) {
      try {
        // Test database connectivity through the application
        const start = Date.now();
        const response = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/debug/users`, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        connectivity.internalServices.database = response.status === 200;
        connectivity.latency.database = Date.now() - start;
        connectivity.timestamps.database = new Date().toISOString();
      } catch (error) {
        connectivity.internalServices.database = false;
        connectivity.latency.database = -1;
      }
    }

    return connectivity;
  }

  /**
   * Get database-specific metrics (PostgreSQL on Railway)
   */
  async getDatabaseMetrics() {
    const database = {
      available: false,
      type: 'unknown',
      connectionString: process.env.DATABASE_URL ? 'configured' : 'not_configured'
    };

    if (process.env.DATABASE_URL) {
      database.type = 'postgresql';
      database.available = true;
      
      // Get database info from URL
      try {
        const url = new URL(process.env.DATABASE_URL);
        database.host = url.hostname;
        database.port = url.port;
        database.database = url.pathname.substring(1);
        database.username = url.username;
        
        // Test database responsiveness through application endpoint
        const response = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/debug/users`, {
          timeout: 5000
        });
        
        if (response.data && typeof response.data.userCount === 'number') {
          database.responsive = true;
          database.userCount = response.data.userCount;
        }
      } catch (error) {
        database.responsive = false;
        database.error = error.message;
      }
    } else {
      database.type = 'file-based';
      database.note = 'Using file-based storage with Git sync';
    }

    return database;
  }

  /**
   * Get Railway environment metrics
   */
  async getEnvironmentMetrics() {
    const environment = {
      variables: {
        NODE_ENV: process.env.NODE_ENV,
        RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
        RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
        RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
        RAILWAY_DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
        DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not_set',
        JWT_SECRET: process.env.JWT_SECRET ? 'configured' : 'not_set',
        PORT: process.env.PORT || '3000'
      },
      features: {
        database: !!process.env.DATABASE_URL,
        authentication: !!process.env.JWT_SECRET,
        monitoring: true,
        gitSync: true
      },
      networking: {
        port: process.env.PORT || '3000',
        publicDomain: this.deploymentInfo.publicDomain,
        internalNetwork: 'railway.internal'
      }
    };

    return environment;
  }

  /**
   * Check for Railway-specific alerts
   */
  async checkRailwayAlerts(metrics) {
    const alerts = [];

    // High memory usage alert
    if (metrics.resources.memory.usagePercent > 0.9) {
      alerts.push({
        type: 'high_memory_usage',
        severity: 'warning',
        message: `Memory usage is ${Math.round(metrics.resources.memory.usagePercent * 100)}%`,
        data: metrics.resources.memory
      });
    }

    // Database connectivity alert
    if (metrics.database.available && !metrics.database.responsive) {
      alerts.push({
        type: 'database_connectivity',
        severity: 'critical',
        message: 'Database is configured but not responding',
        data: metrics.database
      });
    }

    // Public domain connectivity alert
    if (this.deploymentInfo.publicDomain && !metrics.connectivity.publicDomain) {
      alerts.push({
        type: 'public_domain_unreachable',
        severity: 'critical',
        message: 'Public domain is not reachable',
        data: { domain: this.deploymentInfo.publicDomain }
      });
    }

    // High latency alert
    if (metrics.connectivity.latency.publicDomain > 5000) {
      alerts.push({
        type: 'high_latency',
        severity: 'warning',
        message: `High latency detected: ${metrics.connectivity.latency.publicDomain}ms`,
        data: metrics.connectivity.latency
      });
    }

    // New deployment notification
    if (metrics.deployment.newDeployment) {
      alerts.push({
        type: 'new_deployment',
        severity: 'info',
        message: `New deployment detected: ${metrics.deployment.gitCommit}`,
        data: {
          newCommit: metrics.deployment.gitCommit,
          previousCommit: metrics.deployment.previousCommit
        }
      });
    }

    // Send alerts
    for (const alert of alerts) {
      try {
        const AlertSystem = require('./alert-system');
        const alertSystem = new AlertSystem();
        await alertSystem.initialize();
        await alertSystem.trigger(alert.type, alert.data);
      } catch (error) {
        console.error('❌ Failed to trigger Railway alert:', error.message);
      }
    }

    return alerts;
  }

  /**
   * Get previous metrics for comparison
   */
  getPreviousMetrics() {
    const timestamps = Array.from(this.metrics.keys()).sort((a, b) => b - a);
    if (timestamps.length > 1) {
      return this.metrics.get(timestamps[1]);
    }
    return null;
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [timestamp] of this.metrics.entries()) {
      if (timestamp < cutoffTime) {
        this.metrics.delete(timestamp);
      }
    }
  }

  /**
   * Generate Railway deployment report
   */
  generateDeploymentReport() {
    const recentMetrics = this.getRecentMetrics(10);
    const latestMetric = recentMetrics[0];

    if (!latestMetric) {
      return {
        error: 'No metrics available',
        timestamp: new Date().toISOString()
      };
    }

    const report = {
      timestamp: new Date().toISOString(),
      deployment: {
        status: 'active',
        serviceId: this.deploymentInfo.serviceId,
        environment: this.deploymentInfo.environment,
        gitCommit: this.deploymentInfo.gitCommit,
        gitBranch: this.deploymentInfo.gitBranch,
        uptime: this.formatUptime(latestMetric.resources.uptime),
        publicDomain: this.deploymentInfo.publicDomain
      },
      performance: {
        memoryUsage: Math.round(latestMetric.resources.memory.usagePercent * 100) + '%',
        memoryTotal: latestMetric.resources.memory.totalMB + 'MB',
        memoryUsed: latestMetric.resources.memory.usageMB + 'MB',
        uptime: latestMetric.resources.uptime
      },
      connectivity: {
        publicDomainReachable: latestMetric.connectivity.publicDomain,
        publicDomainLatency: latestMetric.connectivity.latency.publicDomain + 'ms',
        databaseConnected: latestMetric.database.responsive !== false
      },
      database: {
        type: latestMetric.database.type,
        available: latestMetric.database.available,
        responsive: latestMetric.database.responsive
      },
      environment: latestMetric.environment,
      healthScore: this.calculateHealthScore(latestMetric)
    };

    return report;
  }

  /**
   * Calculate overall health score
   */
  calculateHealthScore(metrics) {
    let score = 100;
    
    // Deduct points for issues
    if (metrics.resources.memory.usagePercent > 0.8) score -= 20;
    if (metrics.resources.memory.usagePercent > 0.9) score -= 30;
    
    if (!metrics.connectivity.publicDomain) score -= 40;
    if (metrics.connectivity.latency.publicDomain > 2000) score -= 15;
    if (metrics.connectivity.latency.publicDomain > 5000) score -= 25;
    
    if (metrics.database.available && !metrics.database.responsive) score -= 30;
    
    return Math.max(0, score);
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count = 10) {
    const recent = Array.from(this.metrics.entries())
      .sort(([a], [b]) => b - a)
      .slice(0, count);
    
    return recent.map(([timestamp, metrics]) => metrics);
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /**
   * Get current status
   */
  getStatus() {
    const latestMetrics = this.getRecentMetrics(1);
    const latest = latestMetrics[0];

    return {
      isRunning: this.isRunning,
      deploymentInfo: this.deploymentInfo,
      metricsCollected: this.metrics.size,
      uptime: this.formatUptime((Date.now() - this.startTime) / 1000),
      latestCheck: latest ? latest.timestampISO : 'never',
      healthScore: latest ? this.calculateHealthScore(latest) : 0
    };
  }
}

module.exports = RailwayMonitor;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const monitor = new RailwayMonitor();

  async function runCommand() {
    switch (command) {
      case 'start':
        await monitor.start();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n🔄 Shutting down Railway monitor...');
          await monitor.stop();
          process.exit(0);
        });
        
        // Keep running until interrupted
        await new Promise(() => {});
        break;
        
      case 'status':
        const status = monitor.getStatus();
        console.log('🚂 Railway Monitor Status:', JSON.stringify(status, null, 2));
        break;
        
      case 'metrics':
        await monitor.collectRailwayMetrics();
        const metrics = monitor.getRecentMetrics(1)[0];
        console.log('📊 Railway Metrics:', JSON.stringify(metrics, null, 2));
        break;
        
      case 'report':
        await monitor.collectRailwayMetrics();
        const report = monitor.generateDeploymentReport();
        console.log('📋 Railway Deployment Report:', JSON.stringify(report, null, 2));
        break;
        
      case 'test':
        console.log('🧪 Testing Railway connectivity...');
        await monitor.collectRailwayMetrics();
        const testMetrics = monitor.getRecentMetrics(1)[0];
        console.log('🔍 Connectivity Results:');
        console.log('  Public Domain:', testMetrics.connectivity.publicDomain ? '✅' : '❌');
        console.log('  Database:', testMetrics.database.responsive ? '✅' : '❌');
        console.log('  Health Score:', monitor.calculateHealthScore(testMetrics));
        break;
        
      default:
        console.log('Railway Monitor Commands:');
        console.log('  start     - Start continuous monitoring');
        console.log('  status    - Show monitor status');
        console.log('  metrics   - Collect and show current metrics');
        console.log('  report    - Generate deployment report');
        console.log('  test      - Test Railway connectivity');
        process.exit(1);
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}