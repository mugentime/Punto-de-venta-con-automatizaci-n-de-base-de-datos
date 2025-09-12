/**
 * @fileoverview Application Constants Configuration
 * @description Centralized constants for the POS system to improve maintainability and reduce magic numbers
 * @author POS System Team
 * @created 2025-09-11
 */

// ==================== SECURITY CONSTANTS ====================

/**
 * Authentication and security related constants
 * @namespace SecurityConstants
 */
const SECURITY = {
  /** BCrypt salt rounds for password hashing */
  BCRYPT_SALT_ROUNDS: 12,
  
  /** JWT token expiration time */
  JWT_EXPIRES_IN: '7d',
  
  /** Default JWT secret fallback (should be overridden by environment variable) */
  JWT_SECRET_FALLBACK: 'a3aa6a461b5ec2db6ace95b5a9612583d213a8d69df9bf1c1679bcbe8559a8fd',
  
  /** Circuit breaker limit for authentication requests */
  CIRCUIT_BREAKER_LIMIT: 50,
  
  /** Circuit breaker time window in milliseconds */
  CIRCUIT_BREAKER_WINDOW: 10000, // 10 seconds
};

// ==================== RATE LIMITING CONSTANTS ====================

/**
 * Rate limiting configuration constants
 * @namespace RateLimitConstants
 */
const RATE_LIMIT = {
  /** Rate limit window in milliseconds (15 minutes) */
  WINDOW_MS: 15 * 60 * 1000,
  
  /** Maximum requests per window */
  MAX_REQUESTS: 200,
  
  /** Standard rate limit error message */
  ERROR_MESSAGE: 'Too many requests from this IP, please try again later.',
};

// ==================== SERVER CONSTANTS ====================

/**
 * Server configuration constants
 * @namespace ServerConstants
 */
const SERVER = {
  /** Default port if not specified in environment */
  DEFAULT_PORT: 3000,
  
  /** Request body size limit */
  BODY_LIMIT: '10mb',
  
  /** Default timezone for the application */
  DEFAULT_TIMEZONE: 'America/Mexico_City',
  
  /** Health check endpoint paths that bypass rate limiting */
  HEALTH_CHECK_PATHS: ['/api/health', '/api/emergency-test'],
  
  /** Admin login endpoint paths that bypass standard rate limiting */
  AUTH_PATHS: ['/api/auth/login'],
};

// ==================== DATABASE CONSTANTS ====================

/**
 * Database configuration constants
 * @namespace DatabaseConstants
 */
const DATABASE = {
  /** Default low stock alert threshold */
  DEFAULT_LOW_STOCK_ALERT: 5,
  
  /** Default cash cut cron schedule (every 12 hours) */
  DEFAULT_CASHCUT_CRON: '0 0,12 * * *',
  
  /** Default coworking hourly rate */
  DEFAULT_COWORKING_RATE: 58,
  
  /** Default pagination limit for queries */
  DEFAULT_PAGINATION_LIMIT: 50,
  
  /** Maximum pagination limit */
  MAX_PAGINATION_LIMIT: 1000,
};

// ==================== USER ROLE CONSTANTS ====================

/**
 * User roles and permissions constants
 * @namespace UserConstants
 */
const USER = {
  /** Available user roles */
  ROLES: {
    ADMIN: 'admin',
    MANAGER: 'manager',
    EMPLOYEE: 'employee',
  },
  
  /** Default permissions for different roles */
  DEFAULT_PERMISSIONS: {
    [this.ROLES?.ADMIN]: {
      canManageInventory: true,
      canRegisterClients: true,
      canViewReports: true,
      canManageUsers: true,
      canExportData: true,
      canDeleteRecords: true,
    },
    [this.ROLES?.MANAGER]: {
      canManageInventory: true,
      canRegisterClients: true,
      canViewReports: true,
      canManageUsers: false,
      canExportData: true,
      canDeleteRecords: false,
    },
    [this.ROLES?.EMPLOYEE]: {
      canManageInventory: true,
      canRegisterClients: true,
      canViewReports: false,
      canManageUsers: false,
      canExportData: false,
      canDeleteRecords: false,
    },
  },
};

// ==================== BUSINESS LOGIC CONSTANTS ====================

/**
 * Business logic constants
 * @namespace BusinessConstants
 */
const BUSINESS = {
  /** Available product categories */
  PRODUCT_CATEGORIES: {
    CAFETERIA: 'cafetería',
    REFRIGERADOR: 'refrigerador',
  },
  
  /** Available service types */
  SERVICE_TYPES: {
    COWORKING: 'coworking',
    CAFETERIA: 'cafetería',
    EVENTOS: 'eventos',
    REUNION: 'reunión',
  },
  
  /** Available payment methods */
  PAYMENT_METHODS: {
    CASH: 'efectivo',
    CARD: 'tarjeta',
    TRANSFER: 'transferencia',
    MIXED: 'mixto',
  },
  
  /** Available client types */
  CLIENT_TYPES: {
    REGULAR: 'regular',
    MEMBER: 'miembro',
    VISITOR: 'visitante',
    CORPORATE: 'corporativo',
  },
  
  /** Cash cut status options */
  CASHCUT_STATUS: {
    OPEN: 'open',
    CLOSED: 'closed',
    PENDING: 'pending',
  },
  
  /** Coworking session status options */
  SESSION_STATUS: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    PAUSED: 'paused',
  },
};

// ==================== HTTP STATUS CONSTANTS ====================

/**
 * HTTP status codes for consistent API responses
 * @namespace HttpStatusConstants
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ==================== CORS CONSTANTS ====================

/**
 * CORS configuration constants
 * @namespace CorsConstants
 */
const CORS = {
  /** Development origins */
  DEV_ORIGINS: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  
  /** Allowed HTTP methods */
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  
  /** Allowed headers */
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
  
  /** Options success status for legacy browsers */
  OPTIONS_SUCCESS_STATUS: 200,
};

// ==================== CONTENT SECURITY POLICY CONSTANTS ====================

/**
 * Content Security Policy configuration constants
 * @namespace CSPConstants
 */
const CSP = {
  /** CSP directive sources */
  SOURCES: {
    SELF: "'self'",
    UNSAFE_INLINE: "'unsafe-inline'",
    UNSAFE_EVAL: "'unsafe-eval'",
    UNSAFE_HASHES: "'unsafe-hashes'",
    DATA: "data:",
    HTTPS: "https:",
  },
  
  /** Allowed external domains for scripts and styles */
  EXTERNAL_DOMAINS: {
    CDNJS: 'https://cdnjs.cloudflare.com',
    JSDELIVR: 'https://cdn.jsdelivr.net',
    GOOGLE_FONTS: 'https://fonts.googleapis.com',
    GOOGLE_FONTS_STATIC: 'https://fonts.gstatic.com',
  },
};

// ==================== VALIDATION CONSTANTS ====================

/**
 * Validation rules and constraints
 * @namespace ValidationConstants
 */
const VALIDATION = {
  /** Password requirements */
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: false,
  },
  
  /** Username/email requirements */
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 255,
  },
  
  /** Product name requirements */
  PRODUCT_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
  },
  
  /** Client name requirements */
  CLIENT_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 255,
  },
  
  /** Price/amount validation */
  PRICE: {
    MIN_VALUE: 0,
    MAX_VALUE: 999999.99,
    DECIMAL_PLACES: 2,
  },
};

// ==================== ERROR MESSAGES ====================

/**
 * Standardized error messages
 * @namespace ErrorMessages
 */
const ERROR_MESSAGES = {
  // Authentication errors
  AUTH: {
    NO_TOKEN: 'Access denied. No token provided.',
    INVALID_TOKEN: 'Invalid token.',
    EXPIRED_TOKEN: 'Token expired.',
    CIRCUIT_BREAKER: 'Authentication circuit breaker activated. Too many auth requests.',
    USER_NOT_FOUND: 'Invalid token. User not found or inactive.',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    ACCESS_DENIED: 'Access denied.',
    ADMIN_REQUIRED: 'Access denied. Admin privileges required.',
    MANAGER_REQUIRED: 'Access denied. Manager or admin privileges required.',
  },
  
  // Database errors
  DATABASE: {
    NOT_READY: 'Database service initializing. Please try again in a moment.',
    CONNECTION_FAILED: 'Database connection failed.',
    OPERATION_FAILED: 'Database operation failed.',
    RECORD_NOT_FOUND: 'Record not found.',
    DUPLICATE_ENTRY: 'Duplicate entry.',
  },
  
  // Validation errors
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required.',
    INVALID_FORMAT: 'Invalid format.',
    INVALID_EMAIL: 'Invalid email format.',
    PASSWORD_TOO_SHORT: `Password must be at least ${this.PASSWORD?.MIN_LENGTH} characters long.`,
    PRICE_INVALID: 'Price must be a positive number.',
    QUANTITY_INVALID: 'Quantity must be a positive integer.',
  },
  
  // General errors
  GENERAL: {
    INTERNAL_ERROR: 'Internal Server Error',
    BAD_REQUEST: 'Bad Request',
    NOT_FOUND: 'Endpoint not found',
    TOO_MANY_REQUESTS: 'Too many requests from this IP, please try again later.',
  },
};

// ==================== SUCCESS MESSAGES ====================

/**
 * Standardized success messages
 * @namespace SuccessMessages
 */
const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: 'Login successful.',
    LOGOUT_SUCCESS: 'Logout successful.',
    TOKEN_REFRESHED: 'Token refreshed successfully.',
  },
  
  DATABASE: {
    INITIALIZED: 'Database initialized successfully.',
    RECORD_CREATED: 'Record created successfully.',
    RECORD_UPDATED: 'Record updated successfully.',
    RECORD_DELETED: 'Record deleted successfully.',
  },
  
  GENERAL: {
    OPERATION_SUCCESS: 'Operation completed successfully.',
    SYNC_SUCCESS: 'Data synchronized successfully.',
    BACKUP_SUCCESS: 'Backup completed successfully.',
  },
};

// ==================== EXPORTS ====================

module.exports = {
  SECURITY,
  RATE_LIMIT,
  SERVER,
  DATABASE,
  USER,
  BUSINESS,
  HTTP_STATUS,
  CORS,
  CSP,
  VALIDATION,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};

// ==================== TYPE DEFINITIONS FOR BETTER IDE SUPPORT ====================

/**
 * @typedef {Object} SecurityConfig
 * @property {number} BCRYPT_SALT_ROUNDS - BCrypt salt rounds
 * @property {string} JWT_EXPIRES_IN - JWT expiration time
 * @property {string} JWT_SECRET_FALLBACK - Fallback JWT secret
 * @property {number} CIRCUIT_BREAKER_LIMIT - Circuit breaker request limit
 * @property {number} CIRCUIT_BREAKER_WINDOW - Circuit breaker time window
 */

/**
 * @typedef {Object} RateLimitConfig
 * @property {number} WINDOW_MS - Rate limit window in milliseconds
 * @property {number} MAX_REQUESTS - Maximum requests per window
 * @property {string} ERROR_MESSAGE - Rate limit error message
 */

/**
 * @typedef {Object} BusinessConfig
 * @property {Object} PRODUCT_CATEGORIES - Available product categories
 * @property {Object} SERVICE_TYPES - Available service types
 * @property {Object} PAYMENT_METHODS - Available payment methods
 * @property {Object} CLIENT_TYPES - Available client types
 * @property {Object} CASHCUT_STATUS - Cash cut status options
 * @property {Object} SESSION_STATUS - Session status options
 */