// config/constants.js

module.exports = {
  SECURITY: {
    BCRYPT_SALT_ROUNDS: 10,
    JWT_EXPIRES_IN: '1d',
    PASSWORD_MIN_LENGTH: 8
  },
  RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // Límite de peticiones por IP
  },
  SERVER: {
    PORT: process.env.PORT || 3000,
    HEALTH_CHECK_PATHS: ['/api/health', '/api/version', '/api/sync/status'],
    AUTH_PATHS: ['/api/login', '/api/auth', '/api/register']
  },
  DATABASE: {
    TYPE: process.env.DATABASE_TYPE || 'postgres',
    URL: process.env.DATABASE_URL || ''
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
  },
  CORS: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  CSP: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  ERROR_MESSAGES: {
    GENERAL: {
      INTERNAL_ERROR: 'Error interno del servidor.',
      INVALID_TOKEN: 'Token inválido.',
      EXPIRED_TOKEN: 'Token expirado.'
    },
    AUTH: {
      CIRCUIT_BREAKER: 'Circuit breaker activado. Intenta más tarde.',
      NO_TOKEN: 'No se proporcionó token.',
      INVALID_TOKEN: 'Token de autenticación inválido.',
      EXPIRED_TOKEN: 'El token ha expirado.',
      USER_NOT_FOUND: 'Usuario no encontrado.',
      ADMIN_REQUIRED: 'Permisos de administrador requeridos.',
      MANAGER_REQUIRED: 'Permisos de gerente requeridos.',
      ACCESS_DENIED: 'Acceso denegado.'
    },
    GENERIC: 'Ocurrió un error inesperado.',
    UNAUTHORIZED: 'No autorizado.',
    NOT_FOUND: 'No encontrado.'
  },
  SUCCESS_MESSAGES: {
    OK: 'Operación exitosa.',
    CREATED: 'Recurso creado correctamente.'
  }
};
