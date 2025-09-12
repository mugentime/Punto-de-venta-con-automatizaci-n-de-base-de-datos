/**
 * @fileoverview Application Constants and Configuration
 * @description Centralized configuration for the POS system with Railway deployment optimizations
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

// Security Configuration
const SECURITY = {
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '24h',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour in milliseconds
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
  LOCKOUT_TIME: parseInt(process.env.LOCKOUT_TIME) || 900000, // 15 minutes in milliseconds
  PASSWORD_MIN_LENGTH: 8,
  REQUIRE_STRONG_PASSWORDS: process.env.NODE_ENV === 'production'
};

// Rate Limiting Configuration
const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  SKIP_SUCCESSFUL_REQUESTS: false,
  SKIP_FAILED_REQUESTS: false,
  ERROR_MESSAGE: 'Demasiadas solicitudes, intenta nuevamente más tarde'
};

// Server Configuration
const SERVER = {
  PORT: parseInt(process.env.PORT) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  TRUST_PROXY: true,
  CORS_ENABLED: true,
  COMPRESSION_ENABLED: true,
  REQUEST_SIZE_LIMIT: '50mb',
  HEALTH_CHECK_PATHS: ['/health', '/api/health', '/ping', '/status'],
  AUTH_PATHS: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh']
};

// Database Configuration
const DATABASE = {
  CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
  QUERY_TIMEOUT: parseInt(process.env.DB_QUERY_TIMEOUT) || 5000,
  POOL_MIN: parseInt(process.env.DB_POOL_MIN) || 2,
  POOL_MAX: parseInt(process.env.DB_POOL_MAX) || 20,
  POOL_IDLE_TIMEOUT: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
  RETRY_ATTEMPTS: parseInt(process.env.DB_RETRY_ATTEMPTS) || 3,
  RETRY_DELAY: parseInt(process.env.DB_RETRY_DELAY) || 2000,
  SSL_ENABLED: process.env.DB_SSL !== 'false',
  BACKUP_RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// CORS Configuration
const CORS = {
  ORIGINS: process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : process.env.NODE_ENV === 'production'
      ? [
          'https://pos-conejonegro-production.onrender.com',
          'https://pos-conejo-negro-production.up.railway.app',
          process.env.RENDER_EXTERNAL_URL,
          process.env.RAILWAY_STATIC_URL
        ].filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  CREDENTIALS: true,
  METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  ALLOWED_HEADERS: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Request-ID',
    'X-Client-Version'
  ],
  EXPOSED_HEADERS: ['X-Request-ID', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};

// Content Security Policy
const CSP = {
  DEFAULT_SRC: ["'self'"],
  SCRIPT_SRC: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
    "https://unpkg.com",
    "'sha256-*'"
  ],
  STYLE_SRC: [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net"
  ],
  FONT_SRC: [
    "'self'",
    "https://fonts.gstatic.com",
    "https://cdnjs.cloudflare.com"
  ],
  IMG_SRC: [
    "'self'",
    "data:",
    "blob:",
    "https:",
    "*.railway.app",
    "*.onrender.com"
  ],
  CONNECT_SRC: [
    "'self'",
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net",
    "wss:",
    "*.railway.app",
    "*.onrender.com"
  ],
  OBJECT_SRC: ["'none'"],
  BASE_URI: ["'self'"],
  FORM_ACTION: ["'self'"],
  FRAME_ANCESTORS: ["'none'"],
  UPGRADE_INSECURE_REQUESTS: process.env.NODE_ENV === 'production'
};

// Error Messages (Spanish)
const ERROR_MESSAGES = {
  // Authentication
  UNAUTHORIZED: 'No autorizado',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  USER_NOT_FOUND: 'Usuario no encontrado',
  TOKEN_EXPIRED: 'Sesión expirada',
  TOKEN_INVALID: 'Token inválido',
  
  // Validation
  INVALID_DATA: 'Datos inválidos',
  REQUIRED_FIELDS: 'Campos requeridos faltantes',
  INVALID_FORMAT: 'Formato inválido',
  
  // Products
  PRODUCT_NOT_FOUND: 'Producto no encontrado',
  INSUFFICIENT_STOCK: 'Stock insuficiente',
  PRODUCT_ALREADY_EXISTS: 'El producto ya existe',
  
  // Database
  DATABASE: {
    CONNECTION_FAILED: 'Error de conexión a la base de datos',
    OPERATION_FAILED: 'Operación de base de datos fallida',
    TRANSACTION_FAILED: 'Error en la transacción',
    TIMEOUT: 'Tiempo de espera agotado en la base de datos',
    QUERY_ERROR: 'Error en la consulta',
    INITIALIZED: 'Base de datos inicializada exitosamente'
  },
  
  // Server
  INTERNAL_ERROR: 'Error interno del servidor',
  SERVICE_UNAVAILABLE: 'Servicio no disponible',
  BAD_REQUEST: 'Solicitud incorrecta',
  NOT_FOUND: 'Recurso no encontrado',
  RATE_LIMITED: 'Demasiadas solicitudes'
};

// Success Messages (Spanish)
const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESS: 'Sesión cerrada exitosamente',
  TOKEN_REFRESHED: 'Token actualizado',
  
  // Products
  PRODUCT_CREATED: 'Producto creado exitosamente',
  PRODUCT_UPDATED: 'Producto actualizado exitosamente',
  PRODUCT_DELETED: 'Producto eliminado exitosamente',
  
  // Sales
  SALE_COMPLETED: 'Venta completada exitosamente',
  CASH_CUT_CREATED: 'Corte de caja creado exitosamente',
  
  // Users
  USER_CREATED: 'Usuario creado exitosamente',
  USER_UPDATED: 'Usuario actualizado exitosamente',
  
  // Database
  DATABASE: {
    INITIALIZED: 'Base de datos inicializada exitosamente',
    BACKUP_CREATED: 'Respaldo creado exitosamente',
    BACKUP_RESTORED: 'Respaldo restaurado exitosamente',
    SYNC_COMPLETED: 'Sincronización completada'
  }
};

// Performance Configuration
const PERFORMANCE = {
  ENABLE_COMPRESSION: true,
  COMPRESSION_LEVEL: 6,
  COMPRESSION_THRESHOLD: 1024,
  STATIC_MAX_AGE: 31536000, // 1 year
  API_MAX_AGE: 300, // 5 minutes
  ENABLE_ETAG: true,
  ENABLE_LAST_MODIFIED: true,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  KEEPALIVE_TIMEOUT: 65000, // 65 seconds
  HEADERS_TIMEOUT: 66000 // 66 seconds
};

// Cache Configuration
const CACHE = {
  REDIS_ENABLED: !!process.env.REDIS_URL,
  REDIS_TTL: parseInt(process.env.REDIS_TTL) || 3600,
  MEMORY_CACHE_SIZE: parseInt(process.env.MEMORY_CACHE_SIZE) || 100,
  MEMORY_CACHE_TTL: parseInt(process.env.MEMORY_CACHE_TTL) || 600,
  ENABLE_API_CACHE: process.env.ENABLE_API_CACHE !== 'false',
  ENABLE_STATIC_CACHE: process.env.ENABLE_STATIC_CACHE !== 'false'
};

// Monitoring Configuration
const MONITORING = {
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
  METRICS_INTERVAL: parseInt(process.env.METRICS_INTERVAL) || 60000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  ENABLE_REQUEST_LOGGING: process.env.ENABLE_REQUEST_LOGGING !== 'false',
  ENABLE_ERROR_REPORTING: process.env.ENABLE_ERROR_REPORTING !== 'false',
  HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000
};

// Railway Deployment Configuration
const RAILWAY = {
  ENVIRONMENT_DETECTED: !!process.env.RAILWAY_ENVIRONMENT,
  SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME || 'pos-system',
  DEPLOYMENT_ID: process.env.RAILWAY_DEPLOYMENT_ID,
  GIT_COMMIT: process.env.RAILWAY_GIT_COMMIT,
  STATIC_URL: process.env.RAILWAY_STATIC_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  PORT: process.env.PORT,
  PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN
};

module.exports = {
  SECURITY,
  RATE_LIMIT,
  SERVER,
  DATABASE,
  HTTP_STATUS,
  CORS,
  CSP,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  PERFORMANCE,
  CACHE,
  MONITORING,
  RAILWAY
};