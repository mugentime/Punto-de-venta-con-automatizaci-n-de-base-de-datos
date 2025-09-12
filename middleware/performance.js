/**
 * @fileoverview Performance Middleware for Railway Deployment
 * @description Comprehensive performance optimizations including compression, caching, and response time monitoring
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

const compression = require('compression');
const { PERFORMANCE, HTTP_STATUS, MONITORING } = require('../config/constants');

/**
 * Response Compression Middleware
 * Enables gzip/deflate compression for responses with intelligent filtering
 * @returns {Function} Express middleware function
 */
const compressionMiddleware = () => {
  return compression({
    level: PERFORMANCE.COMPRESSION_LEVEL,
    threshold: PERFORMANCE.COMPRESSION_THRESHOLD,
    filter: (req, res) => {
      // Don't compress if the client doesn't support it
      if (!req.headers['accept-encoding']) {
        return false;
      }
      
      // Don't compress responses with the 'no-transform' directive
      if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
        return false;
      }
      
      // Don't compress small payloads
      const contentLength = res.get('Content-Length');
      if (contentLength && parseInt(contentLength) < PERFORMANCE.COMPRESSION_THRESHOLD) {
        return false;
      }
      
      // Use compression for supported content types
      return compression.filter(req, res);
    }
  });
};

/**
 * Static Asset Caching Middleware
 * Sets optimal cache headers for static assets based on content type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const staticCacheMiddleware = (req, res, next) => {
  // Only apply to static assets
  if (!req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return next();
  }
  
  const isLongTermCacheable = req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/);
  const maxAge = isLongTermCacheable ? PERFORMANCE.STATIC_MAX_AGE : PERFORMANCE.API_MAX_AGE;
  
  // Set cache headers
  res.set({
    'Cache-Control': `public, max-age=${maxAge}, immutable`,
    'Expires': new Date(Date.now() + maxAge * 1000).toUTCString()
  });
  
  if (PERFORMANCE.ENABLE_ETAG) {
    // ETags are automatically handled by Express for static files
    res.set('ETag', res.get('ETag') || `W/"${Date.now()}"`);
  }
  
  if (PERFORMANCE.ENABLE_LAST_MODIFIED) {
    res.set('Last-Modified', new Date().toUTCString());
  }
  
  next();
};

/**
 * API Response Caching Middleware
 * Sets cache headers for API responses based on content and authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const apiCacheMiddleware = (req, res, next) => {
  // Skip caching for non-GET requests
  if (req.method !== 'GET') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return next();
  }
  
  // Skip caching for authenticated requests (except certain endpoints)
  const isAuthenticated = req.headers.authorization;
  const isCacheableEndpoint = [
    '/api/health',
    '/api/version',
    '/api/build-info',
    '/api/stats'
  ].some(endpoint => req.path.startsWith(endpoint));
  
  if (isAuthenticated && !isCacheableEndpoint) {
    res.set('Cache-Control', 'private, max-age=0, no-cache');
    return next();
  }
  
  // Set appropriate cache headers for public API endpoints
  const maxAge = isCacheableEndpoint ? PERFORMANCE.API_MAX_AGE : 0;
  res.set({
    'Cache-Control': `public, max-age=${maxAge}`,
    'Vary': 'Accept-Encoding, Authorization'
  });
  
  next();
};

/**
 * Request Timeout Middleware
 * Sets timeout for requests to prevent hanging connections
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Function} Express middleware function
 */
const timeoutMiddleware = (timeout = PERFORMANCE.REQUEST_TIMEOUT) => {
  return (req, res, next) => {
    // Set timeout for the request
    req.setTimeout(timeout, () => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.GATEWAY_TIMEOUT).json({
          error: 'Request timeout',
          message: 'La solicitud tardó demasiado en procesarse',
          timeout: timeout
        });
      }
    });
    
    // Set timeout for the response
    res.setTimeout(timeout, () => {
      if (!res.headersSent) {
        res.status(HTTP_STATUS.GATEWAY_TIMEOUT).json({
          error: 'Response timeout',
          message: 'El servidor tardó demasiado en responder'
        });
      }
    });
    
    next();
  };
};

/**
 * Response Time Monitoring Middleware
 * Tracks response times and adds performance headers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const responseTimeMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  // Store start time for access in other middleware
  req.startTime = startTime;
  
  // Hook into response finish event
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const responseTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Add response time header
    res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
    
    // Log slow requests if monitoring is enabled
    if (MONITORING.ENABLE_REQUEST_LOGGING && responseTime > 1000) {
      console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${responseTime.toFixed(2)}ms`);
    }
    
    // Emit performance metrics if monitoring is enabled
    if (MONITORING.ENABLE_METRICS) {
      // You can emit to monitoring service here
      process.emit('performance-metric', {
        method: req.method,
        path: req.path,
        responseTime: responseTime,
        statusCode: res.statusCode,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
};

/**
 * Memory Usage Monitoring Middleware
 * Monitors memory usage and adds headers for debugging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const memoryMonitoringMiddleware = (req, res, next) => {
  if (MONITORING.ENABLE_METRICS) {
    const memUsage = process.memoryUsage();
    
    // Add memory usage headers in development
    if (process.env.NODE_ENV !== 'production') {
      res.set({
        'X-Memory-RSS': `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        'X-Memory-Heap-Used': `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        'X-Memory-Heap-Total': `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
      });
    }
    
    // Warn about high memory usage
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) { // 500MB threshold
      console.warn(`⚠️ High memory usage: ${Math.round(heapUsedMB)}MB heap used`);
    }
  }
  
  next();
};

/**
 * Security Headers Middleware
 * Adds security-focused performance headers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
const securityHeadersMiddleware = (req, res, next) => {
  // Add security and performance headers
  res.set({
    'X-DNS-Prefetch-Control': 'on',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-XSS-Protection': '1; mode=block'
  });
  
  // Add preload hints for critical resources
  if (req.path === '/' || req.path === '/online') {
    res.set('Link', [
      '</css/mobile-optimized.css>; rel=preload; as=style',
      '</js/mobile-enhancements.js>; rel=preload; as=script',
      '<https://fonts.googleapis.com>; rel=preconnect',
      '<https://cdnjs.cloudflare.com>; rel=preconnect'
    ].join(', '));
  }
  
  next();
};

/**
 * Request Deduplication Middleware
 * Prevents duplicate requests from overwhelming the server
 * @returns {Function} Express middleware function
 */
const deduplicationMiddleware = () => {
  const pendingRequests = new Map();
  
  return (req, res, next) => {
    // Only deduplicate GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Create request key
    const requestKey = `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    
    // Check if request is already pending
    if (pendingRequests.has(requestKey)) {
      const pendingRequest = pendingRequests.get(requestKey);
      
      // Attach to existing request
      pendingRequest.responses.push(res);
      return;
    }
    
    // Track this request
    const requestTracker = {
      responses: [res],
      startTime: Date.now()
    };
    pendingRequests.set(requestKey, requestTracker);
    
    // Override res.json to handle multiple responses
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      const tracker = pendingRequests.get(requestKey);
      if (tracker) {
        // Send response to all waiting clients
        tracker.responses.forEach((response, index) => {
          if (!response.headersSent) {
            if (index === 0) {
              originalJson(data);
            } else {
              response.json(data);
            }
          }
        });
        
        // Clean up
        pendingRequests.delete(requestKey);
      } else {
        originalJson(data);
      }
    };
    
    // Clean up on response finish
    res.on('finish', () => {
      const tracker = pendingRequests.get(requestKey);
      if (tracker && tracker.responses.length === 1) {
        pendingRequests.delete(requestKey);
      }
    });
    
    // Clean up stale requests after timeout
    setTimeout(() => {
      if (pendingRequests.has(requestKey)) {
        console.warn(`🧹 Cleaning up stale request: ${requestKey}`);
        pendingRequests.delete(requestKey);
      }
    }, PERFORMANCE.REQUEST_TIMEOUT);
    
    next();
  };
};

module.exports = {
  compressionMiddleware,
  staticCacheMiddleware,
  apiCacheMiddleware,
  timeoutMiddleware,
  responseTimeMiddleware,
  memoryMonitoringMiddleware,
  securityHeadersMiddleware,
  deduplicationMiddleware
};