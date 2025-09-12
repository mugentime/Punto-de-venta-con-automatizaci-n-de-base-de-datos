const logger = require('../utils/logger');

/**
 * Custom Error Classes
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, details = []) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details;
    }
}

class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

class AuthorizationError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT_ERROR');
    }
}

class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429, 'RATE_LIMIT_ERROR');
    }
}

/**
 * Error Handler Middleware
 * Centralized error handling for the entire application
 */
class ErrorHandler {
    constructor() {
        this.handleError = this.handleError.bind(this);
        this.handleNotFound = this.handleNotFound.bind(this);
        this.handleAsyncError = this.handleAsyncError.bind(this);
    }

    /**
     * Main error handling middleware
     */
    handleError(error, req, res, next) {
        // Ensure error has required properties
        error.statusCode = error.statusCode || 500;
        error.isOperational = error.isOperational || false;

        // Log error with correlation ID
        const correlationId = req.id || 'unknown';
        const errorLog = {
            correlationId,
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            user: req.user?.id || 'anonymous',
            timestamp: new Date().toISOString(),
            error: {
                name: error.name,
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
                stack: error.stack,
                isOperational: error.isOperational
            }
        };

        // Log based on error severity
        if (error.statusCode >= 500) {
            logger.error('Server Error', errorLog);
        } else if (error.statusCode >= 400) {
            logger.warn('Client Error', errorLog);
        } else {
            logger.info('Request Error', errorLog);
        }

        // Handle different error types
        if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
            return this._handleValidationError(error, req, res);
        }

        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return this._handleJWTError(error, req, res);
        }

        if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') {
            return this._handleDuplicateError(error, req, res);
        }

        if (error.code === 'ENOENT') {
            return this._handleFileNotFoundError(error, req, res);
        }

        if (error.name === 'MongoError' || error.name === 'PostgresError') {
            return this._handleDatabaseError(error, req, res);
        }

        // Default error response
        this._sendErrorResponse(error, req, res);
    }

    /**
     * Handle 404 Not Found errors
     */
    handleNotFound(req, res, next) {
        const error = new NotFoundError(`Route ${req.method} ${req.originalUrl}`);
        next(error);
    }

    /**
     * Async error wrapper
     * Catches async errors and passes them to error handler
     */
    handleAsyncError(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Handle validation errors
     * @private
     */
    _handleValidationError(error, req, res) {
        const statusCode = 400;
        const response = {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.details || [error.message],
            correlationId: req.id,
            timestamp: new Date().toISOString()
        };

        if (process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }

        res.status(statusCode).json(response);
    }

    /**
     * Handle JWT errors
     * @private
     */
    _handleJWTError(error, req, res) {
        let message = 'Authentication failed';
        let statusCode = 401;

        if (error.name === 'TokenExpiredError') {
            message = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
            message = 'Invalid token';
        }

        const response = {
            success: false,
            error: message,
            code: 'AUTHENTICATION_ERROR',
            correlationId: req.id,
            timestamp: new Date().toISOString()
        };

        res.status(statusCode).json(response);
    }

    /**
     * Handle duplicate entry errors
     * @private
     */
    _handleDuplicateError(error, req, res) {
        const statusCode = 409;
        const response = {
            success: false,
            error: 'Duplicate entry - resource already exists',
            code: 'CONFLICT_ERROR',
            correlationId: req.id,
            timestamp: new Date().toISOString()
        };

        if (process.env.NODE_ENV === 'development') {
            response.details = error.message;
        }

        res.status(statusCode).json(response);
    }

    /**
     * Handle file not found errors
     * @private
     */
    _handleFileNotFoundError(error, req, res) {
        const statusCode = 404;
        const response = {
            success: false,
            error: 'File or resource not found',
            code: 'NOT_FOUND_ERROR',
            correlationId: req.id,
            timestamp: new Date().toISOString()
        };

        res.status(statusCode).json(response);
    }

    /**
     * Handle database errors
     * @private
     */
    _handleDatabaseError(error, req, res) {
        const statusCode = 500;
        const response = {
            success: false,
            error: 'Database operation failed',
            code: 'DATABASE_ERROR',
            correlationId: req.id,
            timestamp: new Date().toISOString()
        };

        if (process.env.NODE_ENV === 'development') {
            response.details = error.message;
            response.stack = error.stack;
        }

        res.status(statusCode).json(response);
    }

    /**
     * Send default error response
     * @private
     */
    _sendErrorResponse(error, req, res) {
        const statusCode = error.statusCode || 500;
        const response = {
            success: false,
            error: error.isOperational 
                ? error.message 
                : (process.env.NODE_ENV === 'production' 
                    ? 'Internal server error' 
                    : error.message),
            code: error.code || 'INTERNAL_ERROR',
            correlationId: req.id,
            timestamp: new Date().toISOString()
        };

        // Include stack trace in development
        if (process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }

        res.status(statusCode).json(response);
    }

    /**
     * Handle uncaught exceptions
     */
    handleUncaughtException(error) {
        logger.error('Uncaught Exception', {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString(),
            processId: process.pid
        });

        // Graceful shutdown
        process.exit(1);
    }

    /**
     * Handle unhandled promise rejections
     */
    handleUnhandledRejection(reason, promise) {
        logger.error('Unhandled Promise Rejection', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise.toString(),
            timestamp: new Date().toISOString(),
            processId: process.pid
        });

        // Graceful shutdown
        process.exit(1);
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Export error classes and handler
module.exports = {
    // Error classes
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    
    // Middleware functions
    handleError: errorHandler.handleError,
    handleNotFound: errorHandler.handleNotFound,
    handleAsyncError: errorHandler.handleAsyncError,
    
    // Process error handlers
    handleUncaughtException: errorHandler.handleUncaughtException.bind(errorHandler),
    handleUnhandledRejection: errorHandler.handleUnhandledRejection.bind(errorHandler),
    
    // Handler instance
    errorHandler
};