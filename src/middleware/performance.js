const compression = require('compression');
const crypto = require('crypto');

/**
 * Performance Optimization Middleware
 * Comprehensive performance enhancements for the POS system
 */

/**
 * Response Compression Middleware
 */
function createCompressionMiddleware() {
  return compression({
    // Compression level (0-9, 6 is default)
    level: 6,
    
    // Compression threshold - only compress responses larger than this
    threshold: 1024, // 1KB
    
    // Filter function to determine what to compress
    filter: (req, res) => {
      // Don't compress if the request includes a cache-busting query parameter
      if (req.query.nocache) return false;
      
      // Don't compress already compressed files
      const contentType = res.getHeader('content-type');
      if (contentType && (
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip')
      )) {
        return false;
      }
      
      // Compress JSON responses, HTML, CSS, JS
      return compression.filter(req, res);
    }
  });
}

/**
 * Response Caching Middleware
 */
class ResponseCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Maximum number of cached responses
    this.ttl = 5 * 60 * 1000; // 5 minutes default TTL
    
    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  // Create caching middleware
  create(options = {}) {
    const {
      ttl = this.ttl,
      keyGenerator = this.defaultKeyGenerator,
      shouldCache = this.defaultShouldCache,
      varyBy = []
    } = options;

    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Check if response should be cached
      if (!shouldCache(req)) {
        return next();
      }

      // Generate cache key
      const cacheKey = keyGenerator(req, varyBy);
      
      // Check if cached response exists
      const cached = this.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        res.status(cached.statusCode);
        
        // Set cached headers
        Object.entries(cached.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        
        return res.send(cached.body);
      }

      // Capture response
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = (body) => {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(cacheKey, {
            statusCode: res.statusCode,
            headers: this.getResponseHeaders(res),
            body,
            timestamp: Date.now()
          }, ttl);
        }
        
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        return originalSend.call(res, body);
      };

      res.json = (obj) => {
        // Cache successful JSON responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(cacheKey, {
            statusCode: res.statusCode,
            headers: this.getResponseHeaders(res),
            body: JSON.stringify(obj),
            timestamp: Date.now()
          }, ttl);
        }
        
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        return originalJson.call(res, obj);
      };

      next();
    };
  }

  // Default cache key generator
  defaultKeyGenerator(req, varyBy = []) {
    const parts = [
      req.method,
      req.originalUrl || req.url,
      JSON.stringify(req.query || {}),
      req.user?.id || 'anonymous'
    ];

    // Add vary-by headers
    varyBy.forEach(header => {
      parts.push(req.get(header) || '');
    });

    return crypto.createHash('md5').update(parts.join('|')).digest('hex');
  }

  // Default function to determine if response should be cached
  defaultShouldCache(req) {
    // Don't cache authenticated endpoints by default
    return !req.headers.authorization && 
           !req.path.includes('/api/auth/') &&
           !req.path.includes('/api/admin/');
  }

  // Get response headers to cache
  getResponseHeaders(res) {
    const headers = {};
    const headersToCache = [
      'content-type',
      'content-encoding',
      'cache-control',
      'etag',
      'last-modified'
    ];

    headersToCache.forEach(header => {
      const value = res.getHeader(header);
      if (value) {
        headers[header] = value;
      }
    });

    return headers;
  }

  // Get cached response
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached;
  }

  // Set cached response
  set(key, value, ttl = this.ttl) {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      ...value,
      ttl,
      timestamp: Date.now()
    });
  }

  // Clear cache
  clear() {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

/**
 * Database Query Optimization Middleware
 */
class QueryOptimizer {
  constructor() {
    this.queryStats = new Map();
    this.slowQueryThreshold = 1000; // 1 second
  }

  // Create query monitoring middleware
  createMonitoringMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override response methods to capture timing
      const originalSend = res.send;
      const originalJson = res.json;
      
      const finishRequest = () => {
        const duration = Date.now() - startTime;
        this.recordQuery(req.originalUrl, req.method, duration);
        
        // Log slow queries
        if (duration > this.slowQueryThreshold) {
          console.warn(`Slow query detected: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
      };
      
      res.send = function(body) {
        finishRequest();
        return originalSend.call(this, body);
      };
      
      res.json = function(obj) {
        finishRequest();
        return originalJson.call(this, obj);
      };

      next();
    };
  }

  // Record query statistics
  recordQuery(url, method, duration) {
    const key = `${method} ${url}`;
    
    if (!this.queryStats.has(key)) {
      this.queryStats.set(key, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0
      });
    }
    
    const stats = this.queryStats.get(key);
    stats.count++;
    stats.totalDuration += duration;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.avgDuration = stats.totalDuration / stats.count;
  }

  // Get query statistics
  getStats() {
    const stats = [];
    for (const [endpoint, data] of this.queryStats.entries()) {
      stats.push({
        endpoint,
        ...data
      });
    }
    
    // Sort by average duration (slowest first)
    return stats.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  // Get slow queries
  getSlowQueries() {
    return this.getStats().filter(stat => stat.avgDuration > this.slowQueryThreshold);
  }
}

/**
 * Memory Usage Optimization
 */
class MemoryOptimizer {
  constructor() {
    this.memoryStats = [];
    this.maxStatsHistory = 1000;
    
    // Monitor memory usage periodically
    setInterval(() => this.recordMemoryUsage(), 30000); // Every 30 seconds
  }

  // Record current memory usage
  recordMemoryUsage() {
    const usage = process.memoryUsage();
    
    this.memoryStats.push({
      timestamp: new Date(),
      ...usage,
      // Convert bytes to MB for readability
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
    });
    
    // Keep only recent stats
    if (this.memoryStats.length > this.maxStatsHistory) {
      this.memoryStats = this.memoryStats.slice(-this.maxStatsHistory);
    }
  }

  // Get memory statistics
  getStats() {
    if (this.memoryStats.length === 0) {
      this.recordMemoryUsage();
    }
    
    const recent = this.memoryStats.slice(-10); // Last 10 measurements
    const current = recent[recent.length - 1];
    
    return {
      current,
      recent,
      average: {
        rss: Math.round(recent.reduce((sum, stat) => sum + stat.rss, 0) / recent.length),
        heapUsed: Math.round(recent.reduce((sum, stat) => sum + stat.heapUsed, 0) / recent.length)
      }
    };
  }

  // Check if memory usage is concerning
  isMemoryUsageConcerning() {
    const stats = this.getStats();
    const current = stats.current;
    
    // Alert if heap usage is over 512MB or RSS over 1GB
    return current.heapUsed > 512 || current.rss > 1024;
  }

  // Force garbage collection if available
  forceGarbageCollection() {
    if (global.gc) {
      global.gc();
      console.log('Forced garbage collection');
    } else {
      console.warn('Garbage collection not available (start with --expose-gc)');
    }
  }
}

/**
 * Response Time Optimization
 */
function createResponseTimeMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Set start time header
    res.setHeader('X-Response-Time', '0ms');
    
    // Override response methods to set final response time
    const originalSend = res.send;
    const originalJson = res.json;
    
    const setResponseTime = () => {
      const responseTime = Date.now() - startTime;
      res.setHeader('X-Response-Time', `${responseTime}ms`);
    };
    
    res.send = function(body) {
      setResponseTime();
      return originalSend.call(this, body);
    };
    
    res.json = function(obj) {
      setResponseTime();
      return originalJson.call(this, obj);
    };

    next();
  };
}

/**
 * Static File Caching
 */
function createStaticCacheMiddleware() {
  return (req, res, next) => {
    // Set cache headers for static files
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
      // Cache static files for 1 year
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
      
      // Set ETag for better caching
      const etag = crypto.createHash('md5').update(req.url).digest('hex');
      res.setHeader('ETag', etag);
      
      // Check if client has cached version
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).send();
      }
    } else if (req.url.match(/\.(html|htm)$/)) {
      // Cache HTML files for 5 minutes
      res.setHeader('Cache-Control', 'public, max-age=300');
    } else {
      // API responses - no cache
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}

/**
 * Create complete performance middleware stack
 */
function createPerformanceMiddleware() {
  const responseCache = new ResponseCache();
  const queryOptimizer = new QueryOptimizer();
  const memoryOptimizer = new MemoryOptimizer();

  return {
    // Response compression
    compression: createCompressionMiddleware(),
    
    // Response caching
    responseCache,
    
    // Query optimization monitoring
    queryMonitoring: queryOptimizer.createMonitoringMiddleware(),
    
    // Response time tracking
    responseTime: createResponseTimeMiddleware(),
    
    // Static file caching
    staticCache: createStaticCacheMiddleware(),
    
    // Memory monitoring
    memoryOptimizer,
    
    // Utility instances
    queryOptimizer
  };
}

module.exports = {
  createCompressionMiddleware,
  ResponseCache,
  QueryOptimizer,
  MemoryOptimizer,
  createResponseTimeMiddleware,
  createStaticCacheMiddleware,
  createPerformanceMiddleware
};