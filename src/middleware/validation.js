const { ValidationError } = require('./errorHandler');

/**
 * Validation and Sanitization Middleware
 * Provides comprehensive input validation and sanitization
 */
class ValidationMiddleware {
    /**
     * Validate request body against schema
     */
    static validateBody(schema) {
        return (req, res, next) => {
            try {
                const { error, value } = ValidationMiddleware._validateSchema(req.body, schema);
                
                if (error) {
                    const details = error.map(err => ({
                        field: err.field,
                        message: err.message,
                        value: err.value
                    }));
                    
                    throw new ValidationError('Request body validation failed', details);
                }

                req.body = value; // Use sanitized values
                next();
            } catch (err) {
                next(err);
            }
        };
    }

    /**
     * Validate query parameters against schema
     */
    static validateQuery(schema) {
        return (req, res, next) => {
            try {
                const { error, value } = ValidationMiddleware._validateSchema(req.query, schema);
                
                if (error) {
                    const details = error.map(err => ({
                        field: err.field,
                        message: err.message,
                        value: err.value
                    }));
                    
                    throw new ValidationError('Query parameters validation failed', details);
                }

                req.query = value; // Use sanitized values
                next();
            } catch (err) {
                next(err);
            }
        };
    }

    /**
     * Validate route parameters against schema
     */
    static validateParams(schema) {
        return (req, res, next) => {
            try {
                const { error, value } = ValidationMiddleware._validateSchema(req.params, schema);
                
                if (error) {
                    const details = error.map(err => ({
                        field: err.field,
                        message: err.message,
                        value: err.value
                    }));
                    
                    throw new ValidationError('Route parameters validation failed', details);
                }

                req.params = value; // Use sanitized values
                next();
            } catch (err) {
                next(err);
            }
        };
    }

    /**
     * Internal schema validation method
     * @private
     */
    static _validateSchema(data, schema) {
        const errors = [];
        const result = {};

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            
            try {
                result[field] = ValidationMiddleware._validateField(field, value, rules);
            } catch (error) {
                errors.push({
                    field,
                    message: error.message,
                    value
                });
            }
        }

        return {
            error: errors.length > 0 ? errors : null,
            value: result
        };
    }

    /**
     * Validate individual field
     * @private
     */
    static _validateField(fieldName, value, rules) {
        let processedValue = value;

        // Handle required validation
        if (rules.required && (value === undefined || value === null || value === '')) {
            throw new Error(`${fieldName} is required`);
        }

        // If value is not provided and not required, return default or undefined
        if (value === undefined || value === null || value === '') {
            return rules.default !== undefined ? rules.default : undefined;
        }

        // Type validation and conversion
        if (rules.type) {
            processedValue = ValidationMiddleware._validateType(fieldName, value, rules.type);
        }

        // Length validation
        if (rules.minLength !== undefined && processedValue.length < rules.minLength) {
            throw new Error(`${fieldName} must be at least ${rules.minLength} characters long`);
        }
        if (rules.maxLength !== undefined && processedValue.length > rules.maxLength) {
            throw new Error(`${fieldName} must be at most ${rules.maxLength} characters long`);
        }

        // Numeric validation
        if (rules.min !== undefined && processedValue < rules.min) {
            throw new Error(`${fieldName} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && processedValue > rules.max) {
            throw new Error(`${fieldName} must be at most ${rules.max}`);
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(processedValue)) {
            throw new Error(`${fieldName} format is invalid`);
        }

        // Enum validation
        if (rules.enum && !rules.enum.includes(processedValue)) {
            throw new Error(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
        }

        // Custom validation
        if (rules.custom && typeof rules.custom === 'function') {
            const customResult = rules.custom(processedValue);
            if (customResult !== true) {
                throw new Error(customResult || `${fieldName} is invalid`);
            }
        }

        // Sanitization
        if (rules.sanitize) {
            processedValue = ValidationMiddleware._sanitizeValue(processedValue, rules.sanitize);
        }

        return processedValue;
    }

    /**
     * Type validation and conversion
     * @private
     */
    static _validateType(fieldName, value, type) {
        switch (type) {
            case 'string':
                if (typeof value !== 'string') {
                    return String(value);
                }
                return value;

            case 'number':
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    throw new Error(`${fieldName} must be a valid number`);
                }
                return numValue;

            case 'integer':
                const intValue = parseInt(value);
                if (isNaN(intValue) || intValue.toString() !== value.toString()) {
                    throw new Error(`${fieldName} must be a valid integer`);
                }
                return intValue;

            case 'boolean':
                if (typeof value === 'boolean') return value;
                if (value === 'true' || value === '1' || value === 1) return true;
                if (value === 'false' || value === '0' || value === 0) return false;
                throw new Error(`${fieldName} must be a valid boolean`);

            case 'email':
                const email = String(value).toLowerCase().trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    throw new Error(`${fieldName} must be a valid email address`);
                }
                return email;

            case 'date':
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    throw new Error(`${fieldName} must be a valid date`);
                }
                return date;

            case 'array':
                if (!Array.isArray(value)) {
                    throw new Error(`${fieldName} must be an array`);
                }
                return value;

            case 'object':
                if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                    throw new Error(`${fieldName} must be an object`);
                }
                return value;

            default:
                return value;
        }
    }

    /**
     * Sanitize values
     * @private
     */
    static _sanitizeValue(value, sanitizeRules) {
        let sanitized = value;

        if (sanitizeRules.includes('trim') && typeof sanitized === 'string') {
            sanitized = sanitized.trim();
        }

        if (sanitizeRules.includes('lowercase') && typeof sanitized === 'string') {
            sanitized = sanitized.toLowerCase();
        }

        if (sanitizeRules.includes('uppercase') && typeof sanitized === 'string') {
            sanitized = sanitized.toUpperCase();
        }

        if (sanitizeRules.includes('escape') && typeof sanitized === 'string') {
            sanitized = ValidationMiddleware._escapeHtml(sanitized);
        }

        return sanitized;
    }

    /**
     * Escape HTML characters
     * @private
     */
    static _escapeHtml(text) {
        const htmlEscapes = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };

        return text.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
    }
}

/**
 * Common validation schemas
 */
const ValidationSchemas = {
    // Authentication schemas
    login: {
        email: {
            type: 'email',
            required: true,
            sanitize: ['trim', 'lowercase']
        },
        password: {
            type: 'string',
            required: true,
            minLength: 1
        }
    },

    register: {
        email: {
            type: 'email',
            required: true,
            sanitize: ['trim', 'lowercase']
        },
        password: {
            type: 'string',
            required: true,
            minLength: 8,
            pattern: /^(?=.*[A-Za-z])(?=.*\d)/,
            custom: (value) => {
                if (!/^(?=.*[A-Za-z])(?=.*\d)/.test(value)) {
                    return 'Password must contain at least one letter and one number';
                }
                return true;
            }
        },
        name: {
            type: 'string',
            required: true,
            minLength: 2,
            maxLength: 50,
            sanitize: ['trim']
        },
        role: {
            type: 'string',
            enum: ['admin', 'manager', 'employee'],
            default: 'employee'
        }
    },

    changePassword: {
        currentPassword: {
            type: 'string',
            required: true
        },
        newPassword: {
            type: 'string',
            required: true,
            minLength: 8,
            pattern: /^(?=.*[A-Za-z])(?=.*\d)/
        }
    },

    // Product schemas
    createProduct: {
        name: {
            type: 'string',
            required: true,
            minLength: 2,
            maxLength: 100,
            sanitize: ['trim']
        },
        category: {
            type: 'string',
            required: true,
            enum: ['cafetería', 'refrigerador', 'otros'],
            sanitize: ['trim', 'lowercase']
        },
        quantity: {
            type: 'integer',
            min: 0,
            default: 0
        },
        cost: {
            type: 'number',
            required: true,
            min: 0
        },
        price: {
            type: 'number',
            required: true,
            min: 0
        },
        lowStockAlert: {
            type: 'integer',
            min: 1,
            default: 5
        },
        description: {
            type: 'string',
            maxLength: 500,
            sanitize: ['trim'],
            default: ''
        },
        barcode: {
            type: 'string',
            maxLength: 50,
            sanitize: ['trim'],
            default: ''
        }
    },

    updateProduct: {
        name: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            sanitize: ['trim']
        },
        category: {
            type: 'string',
            enum: ['cafetería', 'refrigerador', 'otros'],
            sanitize: ['trim', 'lowercase']
        },
        quantity: {
            type: 'integer',
            min: 0
        },
        cost: {
            type: 'number',
            min: 0
        },
        price: {
            type: 'number',
            min: 0
        },
        lowStockAlert: {
            type: 'integer',
            min: 1
        },
        description: {
            type: 'string',
            maxLength: 500,
            sanitize: ['trim']
        },
        barcode: {
            type: 'string',
            maxLength: 50,
            sanitize: ['trim']
        },
        isActive: {
            type: 'boolean'
        }
    },

    // Common parameter schemas
    idParam: {
        id: {
            type: 'string',
            required: true,
            minLength: 1
        }
    },

    // Query parameter schemas
    paginationQuery: {
        page: {
            type: 'integer',
            min: 1,
            default: 1
        },
        limit: {
            type: 'integer',
            min: 1,
            max: 100,
            default: 20
        },
        sortBy: {
            type: 'string',
            default: 'createdAt'
        },
        sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            default: 'desc'
        }
    }
};

module.exports = {
    ValidationMiddleware,
    ValidationSchemas
};