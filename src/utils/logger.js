const fs = require('fs');
const path = require('path');

/**
 * Simple, flexible logger utility
 * Can be easily replaced with winston, pino, or other logging libraries
 */
class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logDir = path.join(__dirname, '../../logs');
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.maxFiles = 5;

        // Create logs directory if it doesn't exist
        this._ensureLogDirectory();
        
        // Define log levels
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    /**
     * Log error messages
     */
    error(message, meta = {}) {
        this._log('error', message, meta);
    }

    /**
     * Log warning messages
     */
    warn(message, meta = {}) {
        this._log('warn', message, meta);
    }

    /**
     * Log info messages
     */
    info(message, meta = {}) {
        this._log('info', message, meta);
    }

    /**
     * Log debug messages
     */
    debug(message, meta = {}) {
        this._log('debug', message, meta);
    }

    /**
     * Internal logging method
     * @private
     */
    _log(level, message, meta) {
        // Check if log level should be output
        if (this.levels[level] > this.levels[this.logLevel]) {
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...meta
        };

        // Console output with colors in development
        if (process.env.NODE_ENV !== 'production') {
            this._consoleOutput(level, logEntry);
        }

        // File output
        this._fileOutput(level, logEntry);
    }

    /**
     * Console output with colors
     * @private
     */
    _consoleOutput(level, logEntry) {
        const colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[37m'  // White
        };

        const reset = '\x1b[0m';
        const color = colors[level] || colors.info;

        const formattedMessage = `${color}[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}${reset}`;
        
        console.log(formattedMessage);

        // Print meta information if present
        if (Object.keys(logEntry).length > 3) { // More than timestamp, level, message
            const { timestamp, level: lvl, message, ...meta } = logEntry;
            console.log(`${color}Meta:${reset}`, JSON.stringify(meta, null, 2));
        }
    }

    /**
     * File output
     * @private
     */
    _fileOutput(level, logEntry) {
        try {
            const filename = this._getLogFilename(level);
            const logLine = JSON.stringify(logEntry) + '\n';

            // Check file size and rotate if necessary
            this._rotateLogIfNeeded(filename);

            // Append to file
            fs.appendFileSync(filename, logLine);
        } catch (error) {
            // Fallback to console if file logging fails
            console.error('Failed to write to log file:', error);
            console.log('Original log entry:', logEntry);
        }
    }

    /**
     * Get log filename for level
     * @private
     */
    _getLogFilename(level) {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logDir, `${level}-${date}.log`);
    }

    /**
     * Rotate log file if it exceeds max size
     * @private
     */
    _rotateLogIfNeeded(filename) {
        try {
            if (!fs.existsSync(filename)) {
                return;
            }

            const stats = fs.statSync(filename);
            if (stats.size < this.maxFileSize) {
                return;
            }

            // Rotate files
            for (let i = this.maxFiles - 1; i > 0; i--) {
                const oldFile = `${filename}.${i}`;
                const newFile = `${filename}.${i + 1}`;

                if (fs.existsSync(oldFile)) {
                    if (i === this.maxFiles - 1) {
                        fs.unlinkSync(oldFile); // Delete oldest file
                    } else {
                        fs.renameSync(oldFile, newFile);
                    }
                }
            }

            // Move current file to .1
            fs.renameSync(filename, `${filename}.1`);
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }

    /**
     * Ensure log directory exists
     * @private
     */
    _ensureLogDirectory() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (error) {
            console.warn('Could not create log directory:', error);
        }
    }

    /**
     * Create child logger with additional context
     */
    child(defaultMeta) {
        const parentLogger = this;
        
        return {
            error: (message, meta = {}) => parentLogger.error(message, { ...defaultMeta, ...meta }),
            warn: (message, meta = {}) => parentLogger.warn(message, { ...defaultMeta, ...meta }),
            info: (message, meta = {}) => parentLogger.info(message, { ...defaultMeta, ...meta }),
            debug: (message, meta = {}) => parentLogger.debug(message, { ...defaultMeta, ...meta })
        };
    }

    /**
     * Log HTTP requests (middleware friendly)
     */
    logRequest(req, res, next) {
        const start = Date.now();
        const correlationId = req.id || 'unknown';

        // Log request start
        this.info('Request started', {
            correlationId,
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            user: req.user?.id || 'anonymous'
        });

        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - start;
            const level = res.statusCode >= 400 ? 'warn' : 'info';

            this._log(level, 'Request completed', {
                correlationId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                contentLength: res.get('Content-Length'),
                user: req.user?.id || 'anonymous'
            });
        });

        next();
    }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;