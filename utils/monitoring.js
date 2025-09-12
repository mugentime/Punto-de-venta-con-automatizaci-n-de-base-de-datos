/**
 * @fileoverview Application Monitoring and Metrics Collection
 * @description Comprehensive monitoring system for performance tracking and health monitoring
 * @author POS Development Team  
 * @version 1.0.0
 * @created 2025-09-12
 */

const { MONITORING, PERFORMANCE, RAILWAY } = require('../config/constants');

/**
 * Metrics Collection Service
 * Collects and aggregates application metrics
 */
class MetricsCollector {
  constructor() {
    this.metrics = {
      // Request metrics
      requests: {
        total: 0,
        success: 0,
        errors: 0,
        byMethod: {},
        byEndpoint: {},
        responseTime: {
          total: 0,
          count: 0,
          average: 0,
          min: Infinity,
          max: 0,
          percentiles: {}
        }
      },
      
      // System metrics
      system: {
        startTime: Date.now(),
        uptime: 0,
        memory: {},
        cpu: {},
        gc: {
          collections: 0,
          totalTime: 0
        }
      },
      
      // Database metrics
      database: {
        connections: {
          active: 0,
          idle: 0,
          total: 0
        },
        queries: {
          total: 0,
          errors: 0,
          slowQueries: 0,
          averageTime: 0
        }
      },
      
      // Business metrics
      business: {
        sales: {
          total: 0,
          today: 0,
          revenue: 0
        },
        products: {
          total: 0,
          active: 0
        },
        users: {
          total: 0,
          active: 0,
          sessions: 0
        }
      },
      
      // Error metrics
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {},
        rate: 0
      }
    };
    
    this.responseTimes = [];
    this.isCollecting = false;
  }

  /**
   * Initialize metrics collection
   */
  initialize() {
    if (!MONITORING.ENABLE_METRICS) {
      console.log('📊 Metrics collection disabled');
      return;
    }

    console.log('📊 Initializing metrics collection...');
    
    this.isCollecting = true;
    this.setupEventListeners();
    this.startPeriodicCollection();
    
    console.log('✅ Metrics collection initialized');
  }

  /**
   * Set up event listeners for metric collection
   */
  setupEventListeners() {
    // Performance metrics
    process.on('performance-metric', (data) => {
      this.recordRequest(data);
    });

    // Database metrics
    process.on('database-metrics', (data) => {
      this.updateDatabaseMetrics(data);
    });

    // Error metrics
    process.on('application-error', (data) => {
      this.recordError(data);
    });

    // GC metrics (if available)
    if (global.gc) {
      const originalGC = global.gc;
      global.gc = () => {
        const start = process.hrtime.bigint();
        originalGC();
        const end = process.hrtime.bigint();
        this.recordGCMetric(Number(end - start) / 1000000);
      };
    }
  }

  /**
   * Record request metrics
   * @param {Object} data - Request data
   */
  recordRequest(data) {
    const { method, path, responseTime, statusCode } = data;
    
    // Update request counts
    this.metrics.requests.total++;
    
    if (statusCode < 400) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.errors++;
    }
    
    // Update method statistics
    if (!this.metrics.requests.byMethod[method]) {
      this.metrics.requests.byMethod[method] = 0;
    }
    this.metrics.requests.byMethod[method]++;
    
    // Update endpoint statistics
    const endpoint = this.normalizeEndpoint(path);
    if (!this.metrics.requests.byEndpoint[endpoint]) {
      this.metrics.requests.byEndpoint[endpoint] = {
        count: 0,
        totalTime: 0,
        errors: 0
      };
    }
    
    this.metrics.requests.byEndpoint[endpoint].count++;
    this.metrics.requests.byEndpoint[endpoint].totalTime += responseTime;
    
    if (statusCode >= 400) {
      this.metrics.requests.byEndpoint[endpoint].errors++;
    }
    
    // Update response time metrics
    this.updateResponseTimeMetrics(responseTime);
  }

  /**
   * Update response time metrics
   * @param {number} responseTime - Response time in milliseconds
   */
  updateResponseTimeMetrics(responseTime) {
    const rtMetrics = this.metrics.requests.responseTime;
    
    rtMetrics.total += responseTime;
    rtMetrics.count++;
    rtMetrics.average = rtMetrics.total / rtMetrics.count;
    rtMetrics.min = Math.min(rtMetrics.min, responseTime);
    rtMetrics.max = Math.max(rtMetrics.max, responseTime);
    
    // Store for percentile calculation
    this.responseTimes.push(responseTime);
    
    // Keep only last 10000 response times
    if (this.responseTimes.length > 10000) {
      this.responseTimes = this.responseTimes.slice(-10000);
    }
    
    // Calculate percentiles periodically
    if (this.responseTimes.length % 100 === 0) {
      this.calculateResponseTimePercentiles();
    }
  }

  /**
   * Calculate response time percentiles
   */
  calculateResponseTimePercentiles() {
    if (this.responseTimes.length === 0) return;
    
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99];
    
    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      this.metrics.requests.responseTime.percentiles[`p${p}`] = sorted[index];
    }
  }

  /**
   * Update database metrics
   * @param {Object} data - Database metrics data
   */
  updateDatabaseMetrics(data) {
    this.metrics.database.connections = {
      active: data.totalCount - data.idleCount,
      idle: data.idleCount,
      total: data.totalCount
    };
    
    this.metrics.database.queries = {
      total: data.queries || 0,
      errors: data.errors || 0,
      averageTime: data.avgQueryTime || 0
    };
  }

  /**
   * Record error metrics
   * @param {Object} data - Error data
   */
  recordError(data) {
    this.metrics.errors.total++;
    
    const errorType = data.error?.type || 'Unknown';
    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    this.metrics.errors.byType[errorType]++;
    
    if (data.request?.url) {
      const endpoint = this.normalizeEndpoint(data.request.url);
      if (!this.metrics.errors.byEndpoint[endpoint]) {
        this.metrics.errors.byEndpoint[endpoint] = 0;
      }
      this.metrics.errors.byEndpoint[endpoint]++;
    }
  }

  /**
   * Record GC metrics
   * @param {number} duration - GC duration in milliseconds
   */
  recordGCMetric(duration) {
    this.metrics.system.gc.collections++;
    this.metrics.system.gc.totalTime += duration;
  }

  /**
   * Normalize endpoint paths for grouping
   * @param {string} path - Request path
   * @returns {string} Normalized endpoint
   */
  normalizeEndpoint(path) {
    // Remove IDs and dynamic segments
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[0-9a-f]{24}/g, '/:id') // MongoDB ObjectIds
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:uuid'); // UUIDs
  }

  /**
   * Start periodic metrics collection
   */
  startPeriodicCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
      this.calculateRates();
      this.emitMetrics();
    }, MONITORING.METRICS_INTERVAL);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    // Update uptime
    this.metrics.system.uptime = process.uptime();
    
    // Update memory usage
    this.metrics.system.memory = process.memoryUsage();
    
    // Update CPU usage
    this.metrics.system.cpu = process.cpuUsage();
  }

  /**
   * Calculate rates and derived metrics
   */
  calculateRates() {
    const uptime = this.metrics.system.uptime;
    
    // Request rate (requests per second)
    this.metrics.requests.rate = this.metrics.requests.total / uptime;
    
    // Error rate (percentage)
    this.metrics.errors.rate = this.metrics.requests.total > 0 
      ? (this.metrics.errors.total / this.metrics.requests.total) * 100 
      : 0;
  }

  /**
   * Emit metrics for external monitoring
   */
  emitMetrics() {
    const metricsSnapshot = {
      timestamp: new Date().toISOString(),
      ...this.metrics
    };
    
    // Emit for external monitoring services
    process.emit('metrics-snapshot', metricsSnapshot);
    
    // Log metrics summary in development
    if (process.env.NODE_ENV !== 'production') {
      this.logMetricsSummary();
    }
  }

  /**
   * Log metrics summary for debugging
   */
  logMetricsSummary() {
    const summary = {
      requests: {
        total: this.metrics.requests.total,
        rate: this.metrics.requests.rate.toFixed(2) + '/sec',
        avgTime: this.metrics.requests.responseTime.average.toFixed(2) + 'ms',
        errorRate: this.metrics.errors.rate.toFixed(2) + '%'
      },
      system: {
        uptime: (this.metrics.system.uptime / 60).toFixed(1) + 'min',
        memory: Math.round(this.metrics.system.memory.heapUsed / 1024 / 1024) + 'MB',
        gc: this.metrics.system.gc.collections
      },
      database: {
        connections: this.metrics.database.connections.total,
        queries: this.metrics.database.queries.total
      }
    };
    
    console.log('📊 Metrics Summary:', summary);
  }

  /**
   * Get current metrics
   * @returns {Object} Current metrics snapshot
   */
  getMetrics() {
    return {
      timestamp: new Date().toISOString(),
      ...this.metrics
    };
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.requests = {
      total: 0,
      success: 0,
      errors: 0,
      byMethod: {},
      byEndpoint: {},
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        min: Infinity,
        max: 0,
        percentiles: {}
      }
    };
    
    this.metrics.errors = {
      total: 0,
      byType: {},
      byEndpoint: {},
      rate: 0
    };
    
    this.responseTimes = [];
    
    console.log('📊 Metrics reset');
  }
}

/**
 * Health Check Service
 * Provides comprehensive health status for the application
 */
class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.lastCheckResults = new Map();
  }

  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFn - Health check function
   * @param {number} timeout - Check timeout in milliseconds
   */
  registerCheck(name, checkFn, timeout = 5000) {
    this.checks.set(name, { checkFn, timeout });
  }

  /**
   * Run all health checks
   * @returns {Promise<Object>} Health check results
   */
  async runChecks() {
    const results = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: require('../package.json').version,
      checks: {}
    };

    const checkPromises = Array.from(this.checks.entries()).map(async ([name, { checkFn, timeout }]) => {
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Health check timeout')), timeout);
        });
        
        const result = await Promise.race([checkFn(), timeoutPromise]);
        
        results.checks[name] = {
          status: 'healthy',
          ...result,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results.checks[name] = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        };
        results.status = 'unhealthy';
      }
    });

    await Promise.allSettled(checkPromises);
    
    // Store results for caching
    this.lastCheckResults.set('full', results);
    
    return results;
  }

  /**
   * Get cached health check results
   * @returns {Object} Cached health check results
   */
  getCachedResults() {
    return this.lastCheckResults.get('full') || {
      status: 'unknown',
      message: 'No health checks performed yet'
    };
  }
}

/**
 * Performance Profiler
 * Profiles specific operations for optimization
 */
class PerformanceProfiler {
  constructor() {
    this.profiles = new Map();
  }

  /**
   * Start profiling an operation
   * @param {string} name - Operation name
   * @returns {Function} End profiling function
   */
  profile(name) {
    const startTime = process.hrtime.bigint();
    
    return (metadata = {}) => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      if (!this.profiles.has(name)) {
        this.profiles.set(name, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: 0,
          avgTime: 0,
          samples: []
        });
      }
      
      const profile = this.profiles.get(name);
      profile.count++;
      profile.totalTime += duration;
      profile.minTime = Math.min(profile.minTime, duration);
      profile.maxTime = Math.max(profile.maxTime, duration);
      profile.avgTime = profile.totalTime / profile.count;
      
      // Keep last 100 samples
      profile.samples.push({ duration, timestamp: Date.now(), ...metadata });
      if (profile.samples.length > 100) {
        profile.samples.shift();
      }
      
      return duration;
    };
  }

  /**
   * Get profiling results
   * @param {string} name - Operation name (optional)
   * @returns {Object} Profiling results
   */
  getResults(name) {
    if (name) {
      return this.profiles.get(name);
    }
    
    const results = {};
    for (const [key, value] of this.profiles.entries()) {
      results[key] = {
        count: value.count,
        totalTime: value.totalTime,
        minTime: value.minTime,
        maxTime: value.maxTime,
        avgTime: value.avgTime
      };
    }
    
    return results;
  }
}

// Singleton instances
const metricsCollector = new MetricsCollector();
const healthCheckService = new HealthCheckService();
const performanceProfiler = new PerformanceProfiler();

// Initialize default health checks
healthCheckService.registerCheck('memory', async () => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  
  return {
    heapUsed: heapUsedMB.toFixed(2) + 'MB',
    heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
    external: (memUsage.external / 1024 / 1024).toFixed(2) + 'MB',
    healthy: heapUsedMB < 512 // Flag if using more than 512MB
  };
});

healthCheckService.registerCheck('uptime', async () => {
  const uptime = process.uptime();
  
  return {
    seconds: uptime.toFixed(0),
    minutes: (uptime / 60).toFixed(1),
    healthy: uptime > 10 // Healthy if running for more than 10 seconds
  };
});

module.exports = {
  MetricsCollector,
  HealthCheckService,
  PerformanceProfiler,
  metricsCollector,
  healthCheckService,
  performanceProfiler
};