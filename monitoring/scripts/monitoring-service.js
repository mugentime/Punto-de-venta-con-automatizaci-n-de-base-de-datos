/**
 * Main Monitoring Service Orchestrator
 * @description Coordinates all monitoring components for POS Railway deployment
 * @author Operational Launch Monitor
 */

const EventEmitter = require('events');
const HealthMonitor = require('./health-monitor');
const PerformanceMonitor = require('./performance-monitor');
const AlertSystem = require('./alert-system');
const ErrorTracker = require('./error-tracker');
const RailwayMonitor = require('./railway-monitor');
const config = require('../config/monitoring-config');

class MonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...config, ...options };
    this.isRunning = false;
    this.startTime = null;
    
    // Initialize monitoring components
    this.components = {
      health: new HealthMonitor(),
      performance: new PerformanceMonitor(),
      alerts: new AlertSystem(),
      errors: new ErrorTracker(),
      railway: new RailwayMonitor()
    };
    
    this.setupComponentEvents();
  }

  /**
   * Setup event listeners for all components
   */
  setupComponentEvents() {
    // Health monitor events
    this.components.health.on('healthCheck', (results) => {
      this.emit('healthCheck', results);
      this.handleHealthCheck(results);
    });

    this.components.health.on('alert', (alert) => {
      this.components.alerts.trigger(alert.type, alert.data);
    });

    // Performance monitor events
    this.components.performance.on('metrics', (metrics) => {
      this.emit('performanceMetrics', metrics);
    });

    this.components.performance.on('analysis', (analysis) => {
      this.emit('performanceAnalysis', analysis);
    });

    // Error tracker events
    this.components.errors.on('error', (errorData) => {
      this.emit('errorTracked', errorData);
    });

    // Railway monitor events
    this.components.railway.on('metrics', (metrics) => {
      this.emit('railwayMetrics', metrics);
    });

    // Alert system events
    this.components.alerts.on('alert', (alert) => {
      this.emit('alertTriggered', alert);
      console.log(`🚨 Alert: ${alert.name} (${alert.severity})`);
    });

    // Error handling for all components
    Object.entries(this.components).forEach(([name, component]) => {
      component.on('error', (error) => {
        console.error(`❌ ${name} error:`, error.message);
        this.emit('componentError', { component: name, error });
      });
    });
  }

  /**
   * Start all monitoring services
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Monitoring service is already running');
      return;
    }

    console.log('🚀 Starting Comprehensive POS Monitoring Service');
    console.log('═'.repeat(60));
    console.log(`📊 Target URL: ${this.config.deployment.url}`);
    console.log(`🌍 Environment: ${this.config.deployment.environment}`);
    console.log(`🚂 Railway Service: ${this.config.deployment.serviceId || 'unknown'}`);
    console.log('═'.repeat(60));

    this.startTime = Date.now();
    this.isRunning = true;

    try {
      // Start alert system first
      console.log('🚨 Initializing Alert System...');
      await this.components.alerts.initialize();
      
      // Start error tracker
      console.log('🔍 Initializing Error Tracker...');
      await this.components.errors.initialize();
      
      // Start health monitor
      console.log('🏥 Starting Health Monitor...');
      await this.components.health.start();
      
      // Start performance monitor
      console.log('📊 Starting Performance Monitor...');
      await this.components.performance.start();
      
      // Start Railway monitor
      console.log('🚂 Starting Railway Monitor...');
      await this.components.railway.start();

      this.emit('started');
      console.log('═'.repeat(60));
      console.log('✅ All monitoring services started successfully!');
      console.log('🔗 Dashboard: Available at /monitoring/dashboard');
      console.log('📊 Metrics: Being collected every minute');
      console.log('🚨 Alerts: Configured for critical issues');
      console.log('═'.repeat(60));

      // Send startup notification
      await this.sendStartupNotification();
      
    } catch (error) {
      console.error('❌ Failed to start monitoring service:', error.message);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop all monitoring services
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Monitoring service is not running');
      return;
    }

    console.log('⏹️ Stopping Monitoring Service...');
    this.isRunning = false;

    // Stop all components
    const stopPromises = Object.entries(this.components).map(async ([name, component]) => {
      try {
        if (typeof component.stop === 'function') {
          await component.stop();
        }
        console.log(`✅ ${name} stopped`);
      } catch (error) {
        console.error(`❌ Failed to stop ${name}:`, error.message);
      }
    });

    await Promise.all(stopPromises);

    this.emit('stopped');
    console.log('✅ Monitoring service stopped');

    // Send shutdown notification
    await this.sendShutdownNotification();
  }

  /**
   * Handle health check results
   */
  handleHealthCheck(results) {
    // Update component statuses based on health check
    if (results.overall === 'unhealthy') {
      console.log('⚠️ System health degraded - escalating monitoring');
      // Could increase monitoring frequency here
    }
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus() {
    const status = {
      timestamp: new Date().toISOString(),
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      isRunning: this.isRunning,
      components: {},
      summary: {
        healthy: true,
        criticalAlerts: 0,
        warnings: 0,
        errors: 0
      }
    };

    // Get status from each component
    for (const [name, component] of Object.entries(this.components)) {
      try {
        if (typeof component.getStatus === 'function') {
          status.components[name] = component.getStatus();
        } else {
          status.components[name] = { available: false, reason: 'No status method' };
        }
      } catch (error) {
        status.components[name] = { error: error.message };
      }
    }

    // Calculate summary
    const healthCheck = this.components.health.lastHealthCheck;
    if (healthCheck) {
      status.summary.healthy = healthCheck.overall === 'healthy';
      status.summary.warnings = healthCheck.summary.warnings;
      status.summary.errors = healthCheck.summary.failed;
    }

    return status;
  }

  /**
   * Generate comprehensive monitoring report
   */
  async generateReport(hours = 24) {
    console.log(`📋 Generating ${hours}-hour monitoring report...`);

    const report = {
      period: `${hours} hours`,
      timestamp: new Date().toISOString(),
      deployment: this.config.deployment,
      systemStatus: await this.getSystemStatus(),
      health: this.components.health.getStatus(),
      performance: this.components.performance.generateReport(hours),
      errors: this.components.errors.generateReport(hours),
      railway: this.components.railway.generateDeploymentReport(),
      alerts: this.components.alerts.getStatistics(hours),
      recommendations: []
    };

    // Generate combined recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  /**
   * Generate recommendations based on all monitoring data
   */
  generateRecommendations(report) {
    const recommendations = [];

    // Health recommendations
    if (!report.systemStatus.summary.healthy) {
      recommendations.push({
        category: 'health',
        priority: 'critical',
        title: 'System Health Issues Detected',
        description: 'Multiple health checks are failing',
        actions: [
          'Check service logs for errors',
          'Verify database connectivity',
          'Review system resources'
        ]
      });
    }

    // Performance recommendations
    if (report.performance.performance.responseTime.average > 1000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        title: 'High Response Times',
        description: `Average response time is ${report.performance.performance.responseTime.average.toFixed(0)}ms`,
        actions: [
          'Optimize database queries',
          'Implement caching',
          'Review API endpoints'
        ]
      });
    }

    // Error recommendations
    if (report.errors.summary.criticalErrors > 0) {
      recommendations.push({
        category: 'reliability',
        priority: 'critical',
        title: 'Critical Errors Present',
        description: `${report.errors.summary.criticalErrors} critical errors detected`,
        actions: [
          'Investigate critical error patterns',
          'Fix database connection issues',
          'Implement better error handling'
        ]
      });
    }

    // Railway recommendations
    if (report.railway.healthScore < 80) {
      recommendations.push({
        category: 'infrastructure',
        priority: 'medium',
        title: 'Railway Health Score Low',
        description: `Deployment health score is ${report.railway.healthScore}`,
        actions: [
          'Check Railway service status',
          'Review resource allocation',
          'Optimize memory usage'
        ]
      });
    }

    // Alert recommendations
    if (report.alerts.total > 20) {
      recommendations.push({
        category: 'monitoring',
        priority: 'medium',
        title: 'High Alert Volume',
        description: `${report.alerts.total} alerts in the monitoring period`,
        actions: [
          'Review alert thresholds',
          'Investigate recurring alerts',
          'Improve system stability'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Send startup notification
   */
  async sendStartupNotification() {
    try {
      await this.components.alerts.trigger('monitoring_started', {
        timestamp: new Date().toISOString(),
        components: Object.keys(this.components),
        environment: this.config.deployment.environment,
        url: this.config.deployment.url
      });
    } catch (error) {
      console.error('❌ Failed to send startup notification:', error.message);
    }
  }

  /**
   * Send shutdown notification
   */
  async sendShutdownNotification() {
    try {
      await this.components.alerts.trigger('monitoring_stopped', {
        timestamp: new Date().toISOString(),
        uptime: this.startTime ? Date.now() - this.startTime : 0,
        environment: this.config.deployment.environment
      });
    } catch (error) {
      console.error('❌ Failed to send shutdown notification:', error.message);
    }
  }

  /**
   * Test all monitoring components
   */
  async testAllComponents() {
    console.log('🧪 Testing all monitoring components...');
    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test health monitor
    try {
      const healthResult = await this.components.health.performHealthCheck();
      results.tests.health = {
        status: 'pass',
        result: healthResult.overall,
        checks: healthResult.summary.total
      };
    } catch (error) {
      results.tests.health = { status: 'fail', error: error.message };
    }

    // Test performance monitor
    try {
      const perfMetrics = await this.components.performance.collectMetrics();
      results.tests.performance = {
        status: 'pass',
        metrics: Object.keys(perfMetrics).length
      };
    } catch (error) {
      results.tests.performance = { status: 'fail', error: error.message };
    }

    // Test error tracker
    try {
      const testError = new Error('Test error for monitoring system');
      await this.components.errors.trackError(testError, { test: true });
      results.tests.errors = { status: 'pass', message: 'Error tracking functional' };
    } catch (error) {
      results.tests.errors = { status: 'fail', error: error.message };
    }

    // Test alert system
    try {
      await this.components.alerts.testAllChannels();
      results.tests.alerts = { status: 'pass', message: 'Alert system functional' };
    } catch (error) {
      results.tests.alerts = { status: 'fail', error: error.message };
    }

    // Test Railway monitor
    try {
      const railwayMetrics = await this.components.railway.collectRailwayMetrics();
      results.tests.railway = {
        status: 'pass',
        healthScore: this.components.railway.calculateHealthScore(railwayMetrics)
      };
    } catch (error) {
      results.tests.railway = { status: 'fail', error: error.message };
    }

    // Calculate overall test result
    const passedTests = Object.values(results.tests).filter(t => t.status === 'pass').length;
    const totalTests = Object.keys(results.tests).length;
    
    results.summary = {
      passed: passedTests,
      total: totalTests,
      success: passedTests === totalTests
    };

    console.log(`🧪 Test Results: ${passedTests}/${totalTests} passed`);
    return results;
  }

  /**
   * Format uptime for display
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
}

module.exports = MonitoringService;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const service = new MonitoringService();

  async function runCommand() {
    switch (command) {
      case 'start':
        await service.start();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n🔄 Shutting down monitoring service...');
          await service.stop();
          process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
          console.log('\n🔄 Received SIGTERM, shutting down...');
          await service.stop();
          process.exit(0);
        });
        
        // Keep running until interrupted
        console.log('📊 Monitoring service is running. Press Ctrl+C to stop.');
        await new Promise(() => {}); // Keep alive
        break;
        
      case 'stop':
        await service.stop();
        break;
        
      case 'status':
        const status = await service.getSystemStatus();
        console.log('📊 Monitoring Service Status:');
        console.log(JSON.stringify(status, null, 2));
        break;
        
      case 'test':
        const testResults = await service.testAllComponents();
        console.log('🧪 Component Test Results:');
        console.log(JSON.stringify(testResults, null, 2));
        process.exit(testResults.summary.success ? 0 : 1);
        break;
        
      case 'report':
        const hours = parseInt(process.argv[3]) || 24;
        const report = await service.generateReport(hours);
        console.log(`📋 ${hours}-Hour Monitoring Report:`);
        console.log(JSON.stringify(report, null, 2));
        break;
        
      default:
        console.log('POS Monitoring Service Commands:');
        console.log('  start           - Start all monitoring services');
        console.log('  stop            - Stop all monitoring services');
        console.log('  status          - Show current system status');
        console.log('  test            - Test all components');
        console.log('  report [hours]  - Generate monitoring report');
        process.exit(1);
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}