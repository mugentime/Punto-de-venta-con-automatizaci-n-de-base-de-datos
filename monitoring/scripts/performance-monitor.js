/**
 * Performance Monitor for POS Railway Deployment
 * @description Real-time performance monitoring and metrics collection
 * @author Operational Launch Monitor
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const config = require('../config/monitoring-config');

class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...config, ...options };
    this.isRunning = false;
    this.metrics = new Map();
    this.samples = new Map();
    this.intervalId = null;
    this.startTime = Date.now();
    this.requestTimes = [];
    this.errorCounts = new Map();
    
    // Performance baselines
    this.baselines = {
      responseTime: 500, // Expected baseline response time
      errorRate: 0.01,   // Expected baseline error rate (1%)
      memoryUsage: 0.7   // Expected baseline memory usage (70%)
    };
  }

  /**
   * Start performance monitoring
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Performance monitor is already running');
      return;
    }

    console.log('📊 Starting Performance Monitor for POS Railway Deployment');
    console.log(`🎯 Target URL: ${this.config.deployment.url}`);
    console.log(`⏱️ Collection interval: ${this.config.metrics.collection.interval}ms`);
    
    this.isRunning = true;
    this.emit('started');

    // Start metrics collection
    this.intervalId = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.analyzePerformance();
      } catch (error) {
        console.error('❌ Performance monitoring error:', error.message);
        this.emit('error', error);
      }
    }, this.config.metrics.collection.interval);

    // Initial collection
    await this.collectMetrics();
    
    console.log('✅ Performance monitor started successfully');
  }

  /**
   * Stop performance monitoring
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Performance monitor is not running');
      return;
    }

    console.log('⏹️ Stopping Performance Monitor');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Save final metrics
    await this.saveMetrics();

    this.emit('stopped');
    console.log('✅ Performance monitor stopped');
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();
    const metrics = {
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      system: await this.getSystemMetrics(),
      network: await this.getNetworkMetrics(),
      application: await this.getApplicationMetrics(),
      business: await this.getBusinessMetrics()
    };

    // Store metrics
    this.metrics.set(timestamp, metrics);
    this.emit('metrics', metrics);

    // Cleanup old metrics
    this.cleanupOldMetrics();

    return metrics;
  }

  /**
   * Get system performance metrics
   */
  async getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // Calculate memory usage percentage
    const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    
    // Get load average (if available)
    const loadAverage = require('os').loadavg();
    const platform = require('os').platform();
    
    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        usagePercent: memoryUsagePercent,
        usageMB: Math.round(memUsage.heapUsed / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: platform !== 'win32' ? loadAverage : [0, 0, 0]
      },
      uptime: {
        seconds: uptime,
        formatted: this.formatUptime(uptime)
      },
      platform: {
        type: platform,
        nodeVersion: process.version,
        architecture: process.arch
      }
    };
  }

  /**
   * Get network performance metrics
   */
  async getNetworkMetrics() {
    const startTime = Date.now();
    const networkTests = [];

    // Test primary endpoints
    const endpoints = [
      { name: 'health', url: '/api/health' },
      { name: 'version', url: '/api/version' },
      { name: 'main', url: '/' }
    ];

    for (const endpoint of endpoints) {
      try {
        const testStart = Date.now();
        const response = await axios.get(
          `${this.config.deployment.url}${endpoint.url}`,
          { 
            timeout: 10000,
            validateStatus: () => true // Don't throw on HTTP errors
          }
        );
        
        const responseTime = Date.now() - testStart;
        
        networkTests.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          responseTime,
          statusCode: response.status,
          success: response.status >= 200 && response.status < 400,
          size: JSON.stringify(response.data).length
        });

        // Track response times for analysis
        this.requestTimes.push({
          endpoint: endpoint.name,
          responseTime,
          timestamp: Date.now()
        });

      } catch (error) {
        networkTests.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          responseTime: -1,
          statusCode: 0,
          success: false,
          error: error.message
        });

        // Track errors
        const errorKey = `${endpoint.name}_error`;
        this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
      }
    }

    // Calculate network statistics
    const successfulTests = networkTests.filter(t => t.success);
    const avgResponseTime = successfulTests.length > 0 
      ? successfulTests.reduce((sum, t) => sum + t.responseTime, 0) / successfulTests.length
      : 0;

    // Clean old request times (keep last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.requestTimes = this.requestTimes.filter(r => r.timestamp > oneHourAgo);

    return {
      tests: networkTests,
      summary: {
        totalTests: networkTests.length,
        successfulTests: successfulTests.length,
        failedTests: networkTests.length - successfulTests.length,
        avgResponseTime,
        minResponseTime: successfulTests.length > 0 ? Math.min(...successfulTests.map(t => t.responseTime)) : 0,
        maxResponseTime: successfulTests.length > 0 ? Math.max(...successfulTests.map(t => t.responseTime)) : 0
      }
    };
  }

  /**
   * Get application-specific metrics
   */
  async getApplicationMetrics() {
    const metrics = {
      available: false,
      endpoints: {}
    };

    try {
      // Health endpoint metrics
      const healthResponse = await axios.get(
        `${this.config.deployment.url}/api/health`,
        { timeout: 5000 }
      );
      
      if (healthResponse.status === 200) {
        const healthData = healthResponse.data;
        metrics.endpoints.health = {
          status: healthData.status,
          isDatabaseReady: healthData.isDatabaseReady,
          databaseResponseTime: healthData.databaseResponseTime,
          uptime: healthData.uptime,
          environment: healthData.environment
        };
        metrics.available = true;
      }

      // Version endpoint metrics
      const versionResponse = await axios.get(
        `${this.config.deployment.url}/api/version`,
        { timeout: 5000 }
      );
      
      if (versionResponse.status === 200) {
        const versionData = versionResponse.data;
        metrics.endpoints.version = {
          version: versionData.version,
          commit: versionData.commit,
          buildTime: versionData.buildTime,
          uptime: versionData.uptime
        };
      }

    } catch (error) {
      metrics.error = error.message;
    }

    return metrics;
  }

  /**
   * Get business metrics (if accessible)
   */
  async getBusinessMetrics() {
    const metrics = {
      available: false,
      reason: 'Authentication required or endpoint unavailable'
    };

    try {
      // Attempt to get stats (may require authentication)
      const statsResponse = await axios.get(
        `${this.config.deployment.url}/api/stats`,
        { 
          timeout: 5000,
          headers: {
            'Authorization': process.env.MONITORING_AUTH_TOKEN || ''
          },
          validateStatus: () => true
        }
      );

      if (statsResponse.status === 200) {
        metrics.available = true;
        metrics.data = statsResponse.data;
      } else {
        metrics.reason = `HTTP ${statsResponse.status}: Authentication may be required`;
      }

    } catch (error) {
      metrics.reason = error.message;
    }

    return metrics;
  }

  /**
   * Analyze performance and trigger alerts if needed
   */
  async analyzePerformance() {
    const recentMetrics = this.getRecentMetrics(5); // Last 5 samples
    if (recentMetrics.length < 2) return; // Need at least 2 samples for analysis

    const analysis = {
      timestamp: new Date().toISOString(),
      alerts: [],
      trends: {},
      recommendations: []
    };

    // Analyze response time trends
    const responseTimes = recentMetrics.map(m => m.network.summary.avgResponseTime).filter(t => t > 0);
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      analysis.trends.responseTime = {
        current: avgResponseTime,
        maximum: maxResponseTime,
        baseline: this.baselines.responseTime,
        status: avgResponseTime > this.config.performance.responseTime.critical ? 'critical' :
               avgResponseTime > this.config.performance.responseTime.poor ? 'warning' : 'good'
      };

      // Alert on high response times
      if (avgResponseTime > this.config.performance.responseTime.critical) {
        analysis.alerts.push({
          type: 'response_time_high',
          severity: 'critical',
          message: `Average response time (${Math.round(avgResponseTime)}ms) exceeds critical threshold`,
          data: { avgResponseTime, threshold: this.config.performance.responseTime.critical }
        });
      }
    }

    // Analyze memory usage trends
    const memoryUsages = recentMetrics.map(m => m.system.memory.usagePercent);
    const avgMemoryUsage = memoryUsages.reduce((sum, u) => sum + u, 0) / memoryUsages.length;
    
    analysis.trends.memory = {
      current: avgMemoryUsage,
      baseline: this.baselines.memoryUsage,
      status: avgMemoryUsage > this.config.performance.memoryUsage.critical ? 'critical' :
             avgMemoryUsage > this.config.performance.memoryUsage.warning ? 'warning' : 'good'
    };

    // Alert on high memory usage
    if (avgMemoryUsage > this.config.performance.memoryUsage.critical) {
      analysis.alerts.push({
        type: 'memory_usage_high',
        severity: 'critical',
        message: `Memory usage (${Math.round(avgMemoryUsage * 100)}%) exceeds critical threshold`,
        data: { memoryUsage: avgMemoryUsage, threshold: this.config.performance.memoryUsage.critical }
      });
    }

    // Analyze error rates
    const errorRate = this.calculateErrorRate();
    analysis.trends.errorRate = {
      current: errorRate,
      baseline: this.baselines.errorRate,
      status: errorRate > this.config.performance.errorRate.critical ? 'critical' :
             errorRate > this.config.performance.errorRate.warning ? 'warning' : 'good'
    };

    // Alert on high error rates
    if (errorRate > this.config.performance.errorRate.critical) {
      analysis.alerts.push({
        type: 'error_rate_high',
        severity: 'critical',
        message: `Error rate (${Math.round(errorRate * 100)}%) exceeds critical threshold`,
        data: { errorRate, threshold: this.config.performance.errorRate.critical }
      });
    }

    // Generate recommendations
    if (analysis.trends.responseTime && analysis.trends.responseTime.status !== 'good') {
      analysis.recommendations.push({
        category: 'performance',
        priority: 'high',
        message: 'Consider optimizing database queries and enabling caching',
        actions: ['Review slow database operations', 'Implement Redis caching', 'Optimize API endpoints']
      });
    }

    if (analysis.trends.memory && analysis.trends.memory.status !== 'good') {
      analysis.recommendations.push({
        category: 'resources',
        priority: 'medium',
        message: 'High memory usage detected - investigate memory leaks',
        actions: ['Review memory usage patterns', 'Check for memory leaks', 'Consider garbage collection tuning']
      });
    }

    // Emit analysis results
    this.emit('analysis', analysis);

    // Trigger alerts through the alert system
    if (analysis.alerts.length > 0) {
      const AlertSystem = require('./alert-system');
      const alertSystem = new AlertSystem();
      await alertSystem.initialize();

      for (const alert of analysis.alerts) {
        await alertSystem.trigger(alert.type, alert.data);
      }
    }

    return analysis;
  }

  /**
   * Calculate current error rate
   */
  calculateErrorRate() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentRequests = this.requestTimes.filter(r => r.timestamp > oneHourAgo);
    
    if (recentRequests.length === 0) return 0;

    let totalErrors = 0;
    for (const [key, count] of this.errorCounts.entries()) {
      if (key.includes('_error')) {
        totalErrors += count;
      }
    }

    return totalErrors / (recentRequests.length + totalErrors);
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
   * Clean up old metrics based on retention policy
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const retention = this.config.metrics.collection.retention.raw;
    
    for (const [timestamp] of this.metrics.entries()) {
      if (now - timestamp > retention) {
        this.metrics.delete(timestamp);
      }
    }
  }

  /**
   * Generate performance report
   */
  generateReport(hours = 24) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const relevantMetrics = Array.from(this.metrics.entries())
      .filter(([timestamp]) => timestamp > cutoffTime)
      .map(([timestamp, metrics]) => metrics)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (relevantMetrics.length === 0) {
      return {
        error: 'No metrics available for the specified time period',
        period: `${hours} hours`,
        timestamp: new Date().toISOString()
      };
    }

    // Calculate statistics
    const responseTimes = relevantMetrics.map(m => m.network.summary.avgResponseTime).filter(t => t > 0);
    const memoryUsages = relevantMetrics.map(m => m.system.memory.usagePercent);
    const errorCounts = Array.from(this.errorCounts.values());

    const report = {
      period: `${hours} hours`,
      timestamp: new Date().toISOString(),
      dataPoints: relevantMetrics.length,
      performance: {
        responseTime: {
          average: responseTimes.length > 0 ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0,
          minimum: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
          maximum: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
          samples: responseTimes.length
        },
        memory: {
          average: memoryUsages.reduce((sum, u) => sum + u, 0) / memoryUsages.length,
          minimum: Math.min(...memoryUsages),
          maximum: Math.max(...memoryUsages),
          samples: memoryUsages.length
        },
        errors: {
          total: errorCounts.reduce((sum, c) => sum + c, 0),
          rate: this.calculateErrorRate(),
          types: Object.fromEntries(this.errorCounts.entries())
        }
      },
      trends: this.analyzeTrends(relevantMetrics),
      recommendations: this.generateRecommendations(relevantMetrics)
    };

    return report;
  }

  /**
   * Analyze performance trends
   */
  analyzeTrends(metrics) {
    if (metrics.length < 2) return {};

    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2));

    const trends = {};

    // Response time trend
    const firstHalfResponseTime = firstHalf.map(m => m.network.summary.avgResponseTime).filter(t => t > 0);
    const secondHalfResponseTime = secondHalf.map(m => m.network.summary.avgResponseTime).filter(t => t > 0);

    if (firstHalfResponseTime.length > 0 && secondHalfResponseTime.length > 0) {
      const firstAvg = firstHalfResponseTime.reduce((sum, t) => sum + t, 0) / firstHalfResponseTime.length;
      const secondAvg = secondHalfResponseTime.reduce((sum, t) => sum + t, 0) / secondHalfResponseTime.length;
      
      trends.responseTime = {
        direction: secondAvg > firstAvg ? 'increasing' : secondAvg < firstAvg ? 'decreasing' : 'stable',
        change: Math.round(((secondAvg - firstAvg) / firstAvg) * 100),
        changeAbsolute: Math.round(secondAvg - firstAvg)
      };
    }

    // Memory usage trend
    const firstHalfMemory = firstHalf.map(m => m.system.memory.usagePercent);
    const secondHalfMemory = secondHalf.map(m => m.system.memory.usagePercent);

    const firstMemAvg = firstHalfMemory.reduce((sum, u) => sum + u, 0) / firstHalfMemory.length;
    const secondMemAvg = secondHalfMemory.reduce((sum, u) => sum + u, 0) / secondHalfMemory.length;

    trends.memory = {
      direction: secondMemAvg > firstMemAvg ? 'increasing' : secondMemAvg < firstMemAvg ? 'decreasing' : 'stable',
      change: Math.round(((secondMemAvg - firstMemAvg) / firstMemAvg) * 100),
      changeAbsolute: Math.round((secondMemAvg - firstMemAvg) * 100)
    };

    return trends;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.length === 0) return recommendations;

    const latestMetric = metrics[metrics.length - 1];
    const avgResponseTime = latestMetric.network.summary.avgResponseTime;
    const memoryUsage = latestMetric.system.memory.usagePercent;

    // Response time recommendations
    if (avgResponseTime > this.config.performance.responseTime.poor) {
      recommendations.push({
        category: 'performance',
        priority: avgResponseTime > this.config.performance.responseTime.critical ? 'critical' : 'high',
        title: 'High Response Times Detected',
        description: `Average response time is ${Math.round(avgResponseTime)}ms`,
        actions: [
          'Review database query performance',
          'Implement response caching',
          'Optimize API endpoints',
          'Consider CDN for static assets'
        ]
      });
    }

    // Memory recommendations
    if (memoryUsage > this.config.performance.memoryUsage.warning) {
      recommendations.push({
        category: 'resources',
        priority: memoryUsage > this.config.performance.memoryUsage.critical ? 'critical' : 'medium',
        title: 'High Memory Usage',
        description: `Memory usage is at ${Math.round(memoryUsage * 100)}%`,
        actions: [
          'Investigate memory leaks',
          'Review caching strategies',
          'Optimize data structures',
          'Consider increasing memory allocation'
        ]
      });
    }

    // General optimization recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'optimization',
        priority: 'low',
        title: 'System Performance is Good',
        description: 'All metrics are within acceptable ranges',
        actions: [
          'Continue monitoring for trends',
          'Plan for capacity scaling',
          'Review performance baselines quarterly'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      const metricsDir = path.join(__dirname, '..', 'data');
      await fs.mkdir(metricsDir, { recursive: true });
      
      const filename = `performance-metrics-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(metricsDir, filename);
      
      const metricsArray = Array.from(this.metrics.entries()).map(([timestamp, metrics]) => ({
        timestamp,
        timestampISO: new Date(timestamp).toISOString(),
        ...metrics
      }));

      await fs.writeFile(filepath, JSON.stringify(metricsArray, null, 2));
      console.log(`📊 Metrics saved to ${filename}`);
    } catch (error) {
      console.error('❌ Failed to save metrics:', error.message);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    const uptime = Date.now() - this.startTime;
    const recentMetrics = this.getRecentMetrics(1);
    const latestMetric = recentMetrics.length > 0 ? recentMetrics[0] : null;

    return {
      isRunning: this.isRunning,
      uptime: this.formatUptime(uptime / 1000),
      metricsCollected: this.metrics.size,
      latestMetric: latestMetric ? {
        timestamp: latestMetric.timestampISO,
        responseTime: latestMetric.network.summary.avgResponseTime,
        memoryUsage: Math.round(latestMetric.system.memory.usagePercent * 100) + '%',
        errorRate: Math.round(this.calculateErrorRate() * 100) + '%'
      } : null,
      configuration: {
        collectionInterval: this.config.metrics.collection.interval,
        retentionPeriod: this.config.metrics.collection.retention.raw
      }
    };
  }
}

module.exports = PerformanceMonitor;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const monitor = new PerformanceMonitor();

  async function runCommand() {
    switch (command) {
      case 'start':
        await monitor.start();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
          console.log('\n🔄 Shutting down performance monitor...');
          await monitor.stop();
          process.exit(0);
        });
        
        // Keep running until interrupted
        await new Promise(() => {});
        break;
        
      case 'test':
        console.log('🧪 Running performance test...');
        await monitor.collectMetrics();
        const analysis = await monitor.analyzePerformance();
        console.log('📊 Performance Analysis:', JSON.stringify(analysis, null, 2));
        break;
        
      case 'report':
        const hours = parseInt(process.argv[3]) || 24;
        console.log(`📋 Generating ${hours}-hour performance report...`);
        await monitor.start();
        const report = monitor.generateReport(hours);
        console.log(JSON.stringify(report, null, 2));
        await monitor.stop();
        break;
        
      case 'status':
        const status = monitor.getStatus();
        console.log('📊 Performance Monitor Status:', JSON.stringify(status, null, 2));
        break;
        
      default:
        console.log('Performance Monitor Commands:');
        console.log('  start           - Start continuous monitoring');
        console.log('  test            - Run single performance test');
        console.log('  report [hours]  - Generate performance report');
        console.log('  status          - Show monitor status');
        process.exit(1);
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}