const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * Security Middleware Configuration
 * Comprehensive security hardening for the POS system
 */

/**
 * Enhanced Helmet Configuration
 * Provides security headers with proper CSP for POS functionality
 */
function createSecurityHeaders() {
  return helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        
        // Scripts - allow CDNs and inline scripts for POS functionality
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for dynamic POS features
          "'unsafe-eval'", // Required for some libraries
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          // Hash-based CSP for specific inline scripts
          "'sha256-randomHashForSpecificScript'"
        ],
        
        // Styles - allow inline styles for dynamic UI
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com"
        ],
        
        // Images - allow data URLs for generated content
        imgSrc: [
          "'self'",
          "data:",
          "https:",
          "blob:"
        ],
        
        // Fonts
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "data:"
        ],
        
        // Connections - API and CDN connections
        connectSrc: [
          "'self'",
          "https://api.example.com", // External APIs if needed
          process.env.NODE_ENV === 'development' ? 'ws://localhost:*' : null
        ].filter(Boolean),
        
        // Frames - restrict iframe usage
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        
        // Base URI restriction
        baseUri: ["'self'"],
        
        // Form actions
        formAction: ["'self'"],
        
        // Upgrade insecure requests in production
        ...(process.env.NODE_ENV === 'production' && {
          upgradeInsecureRequests: []
        })
      },
      
      // Report violations in development
      ...(process.env.NODE_ENV === 'development' && {
        reportOnly: true
      })
    },
    
    // Cross Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disabled for compatibility
    
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    
    // Frame Guard
    frameguard: { action: 'deny' },
    
    // Hide X-Powered-By
    hidePoweredBy: true,
    
    // HSTS - HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    
    // IE No Open
    ieNoOpen: true,
    
    // MIME Type sniffing prevention
    noSniff: true,
    
    // Referrer Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    
    // X-XSS-Protection (deprecated but still useful for old browsers)
    xssFilter: true,
    
    // Permissions Policy
    permissionsPolicy: {
      features: {
        accelerometer: ["'none'"],
        camera: ["'none'"],
        geolocation: ["'self'"], // May be useful for location-based features
        gyroscope: ["'none'"],
        magnetometer: ["'none'"],
        microphone: ["'none'"],
        payment: ["'self'"], // For future payment integrations
        usb: ["'none'"]
      }
    }
  });
}

/**
 * Rate Limiting Configuration
 * Multiple rate limiting strategies for different endpoints
 */
class RateLimiting {
  constructor() {
    this.rateLimiters = this._createRateLimiters();
  }

  _createRateLimiters() {
    const store = new Map(); // Simple in-memory store (use Redis in production)

    return {
      // General API rate limiting
      general: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // 1000 requests per window
        message: {
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        store: store
      }),

      // Strict rate limiting for authentication endpoints
      auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // 5 login attempts per window
        message: {
          success: false,
          error: 'Too many authentication attempts, please try again later.',
          retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        store: store
      }),

      // Password reset rate limiting
      passwordReset: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 password reset attempts per hour
        message: {
          success: false,
          error: 'Too many password reset attempts, please try again later.',
          retryAfter: '1 hour'
        },
        keyGenerator: (req) => {
          // Rate limit by email address instead of IP
          return req.body.email || req.ip;
        },
        store: store
      }),

      // File upload rate limiting
      upload: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // 50 uploads per hour
        message: {
          success: false,
          error: 'Too many file uploads, please try again later.',
          retryAfter: '1 hour'
        },
        store: store
      }),

      // Database operations rate limiting
      database: rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 database operations per minute
        message: {
          success: false,
          error: 'Too many database operations, please slow down.',
          retryAfter: '1 minute'
        },
        skip: (req) => {
          // Skip rate limiting for admin users
          return req.user && req.user.role === 'admin';
        },
        store: store
      })
    };
  }

  // Get rate limiter by type
  get(type) {
    return this.rateLimiters[type] || this.rateLimiters.general;
  }

  // Create custom rate limiter
  custom(options) {
    return rateLimit(options);
  }
}

/**
 * Request Correlation and Security Headers
 */
function createCorrelationMiddleware() {
  return (req, res, next) => {
    // Generate correlation ID if not present
    if (!req.id) {
      req.id = crypto.randomUUID();
    }

    // Set correlation ID in response headers
    res.setHeader('X-Correlation-ID', req.id);
    
    // Set security headers
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Set cache control for sensitive endpoints
    if (req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}

/**
 * Input Sanitization Middleware
 */
function createSanitizationMiddleware() {
  return (req, res, next) => {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  };
}

/**
 * Recursively sanitize object properties
 * @private
 */
function sanitizeObject(obj, depth = 0) {
  // Prevent deep recursion
  if (depth > 10) return obj;

  const sanitized = {};

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);

    if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) :
        typeof item === 'object' && item !== null ? sanitizeObject(item, depth + 1) :
        item
      );
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize string input
 * @private
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // Remove null bytes
  str = str.replace(/\0/g, '');
  
  // Trim whitespace
  str = str.trim();
  
  // Limit length to prevent DoS
  if (str.length > 10000) {
    str = str.substring(0, 10000);
  }

  return str;
}

/**
 * IP Validation and Blocking
 */
class IPSecurity {
  constructor() {
    // Blocked IPs (would be loaded from database in production)
    this.blockedIPs = new Set();
    
    // Whitelisted IPs (for admin access during maintenance)
    this.whitelistedIPs = new Set([
      '127.0.0.1',
      '::1'
    ]);

    // Private IP ranges
    this.privateIPRanges = [
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00::/,
      /^fe80::/
    ];
  }

  // Create IP blocking middleware
  createBlockingMiddleware() {
    return (req, res, next) => {
      const clientIP = this.getClientIP(req);

      // Check if IP is blocked
      if (this.blockedIPs.has(clientIP)) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          code: 'IP_BLOCKED'
        });
      }

      // Add IP to request for logging
      req.clientIP = clientIP;
      req.isPrivateIP = this.isPrivateIP(clientIP);

      next();
    };
  }

  // Get client IP address
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           req.ip ||
           'unknown';
  }

  // Check if IP is private/local
  isPrivateIP(ip) {
    return this.privateIPRanges.some(range => range.test(ip));
  }

  // Block IP address
  blockIP(ip, reason = 'Manual block') {
    this.blockedIPs.add(ip);
    console.warn(`IP ${ip} blocked: ${reason}`);
  }

  // Unblock IP address
  unblockIP(ip) {
    this.blockedIPs.delete(ip);
    console.info(`IP ${ip} unblocked`);
  }

  // Check if IP is whitelisted
  isWhitelisted(ip) {
    return this.whitelistedIPs.has(ip);
  }
}

/**
 * Security Event Logging
 */
class SecurityLogger {
  constructor(logger) {
    this.logger = logger;
    this.suspiciousPatterns = [
      /\b(union|select|insert|delete|drop|alter|create|exec|script|javascript|vbscript)\b/i,
      /[<>'"]/,
      /\.\./,
      /\/etc\/passwd/,
      /cmd\.exe/,
      /powershell/
    ];
  }

  // Create security logging middleware
  createLoggingMiddleware() {
    return (req, res, next) => {
      // Log suspicious requests
      if (this.isSuspiciousRequest(req)) {
        this.logSecurityEvent('suspicious_request', {
          ip: req.clientIP || req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.originalUrl,
          body: req.body,
          headers: req.headers
        });
      }

      // Log authentication events
      if (req.path.includes('/auth/')) {
        this.logSecurityEvent('auth_attempt', {
          ip: req.clientIP || req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          email: req.body.email
        });
      }

      next();
    };
  }

  // Check if request looks suspicious
  isSuspiciousRequest(req) {
    const checkString = (str) => {
      if (!str) return false;
      return this.suspiciousPatterns.some(pattern => pattern.test(str));
    };

    // Check URL
    if (checkString(req.originalUrl)) return true;

    // Check headers
    for (const [key, value] of Object.entries(req.headers)) {
      if (checkString(key) || checkString(value)) return true;
    }

    // Check body (stringify to check nested objects)
    if (req.body && checkString(JSON.stringify(req.body))) return true;

    return false;
  }

  // Log security event
  logSecurityEvent(type, data) {
    this.logger.warn(`Security Event: ${type}`, {
      eventType: type,
      timestamp: new Date().toISOString(),
      ...data
    });
  }
}

/**
 * Create complete security middleware stack
 */
function createSecurityMiddleware(logger) {
  const rateLimiting = new RateLimiting();
  const ipSecurity = new IPSecurity();
  const securityLogger = new SecurityLogger(logger);

  return {
    // Security headers
    headers: createSecurityHeaders(),
    
    // Rate limiting
    rateLimiters: rateLimiting,
    
    // IP security
    ipBlocking: ipSecurity.createBlockingMiddleware(),
    
    // Request correlation and security headers
    correlation: createCorrelationMiddleware(),
    
    // Input sanitization
    sanitization: createSanitizationMiddleware(),
    
    // Security logging
    securityLogging: securityLogger.createLoggingMiddleware(),
    
    // Utility instances
    ipSecurity,
    securityLogger
  };
}

module.exports = {
  createSecurityHeaders,
  RateLimiting,
  createCorrelationMiddleware,
  createSanitizationMiddleware,
  IPSecurity,
  SecurityLogger,
  createSecurityMiddleware
};