/**
 * @fileoverview Railway Deployment Optimization Configuration
 * @description Memory-efficient configuration for Railway POS deployment
 * @author Performance Optimization Team
 * @version 1.0.0
 * @created 2025-09-11
 */

/**
 * Railway-specific optimization settings
 */
const RAILWAY_OPTIMIZATION = {
    // Memory management
    MEMORY: {
        MAX_OLD_SPACE_SIZE: 512,          // MB - Railway container limit optimization
        THREAD_POOL_SIZE: 4,              // Optimal for Railway CPU allocation
        GARBAGE_COLLECTION_THRESHOLD: 0.8, // Trigger GC at 80% memory usage
        HEAP_SNAPSHOT_INTERVAL: 30000     // Memory monitoring interval (ms)
    },
    
    // File system optimization
    FILE_SYSTEM: {
        CACHE_SIZE: 100,                  // Max cached objects
        CACHE_TTL: 300000,               // Cache time-to-live (5 minutes)
        MAX_CONCURRENT_FILES: 5,          // File operation concurrency limit
        READ_BUFFER_SIZE: 64 * 1024,     // 64KB read buffer
        WRITE_BUFFER_SIZE: 32 * 1024     // 32KB write buffer
    },
    
    // Connection pooling for file operations
    CONNECTION_POOL: {
        MAX_CONNECTIONS: 5,               // Max concurrent file operations
        MIN_CONNECTIONS: 1,               // Min pool size
        ACQUIRE_TIMEOUT: 10000,          // 10 seconds
        IDLE_TIMEOUT: 60000,             // 1 minute
        RETRY_DELAY: 1000                // 1 second retry delay
    },
    
    // Railway health check optimization
    HEALTH_CHECK: {
        TIMEOUT: 30000,                  // 30 seconds
        INTERVAL: 10000,                 // 10 seconds
        RETRIES: 3,                      // Max retries before failure
        MEMORY_THRESHOLD: 400 * 1024 * 1024 // 400MB alert threshold
    },
    
    // Performance monitoring
    MONITORING: {
        METRICS_INTERVAL: 30000,         // 30 seconds
        LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
        ENABLE_PROFILING: process.env.NODE_ENV !== 'production',
        MAX_LOG_SIZE: 10 * 1024 * 1024  // 10MB log rotation
    }
};

/**
 * Node.js process optimization settings
 */
const NODE_OPTIMIZATION = {
    // Node.js flags for Railway deployment
    getNodeFlags() {
        return [
            `--max-old-space-size=${RAILWAY_OPTIMIZATION.MEMORY.MAX_OLD_SPACE_SIZE}`,
            `--max-semi-space-size=64`,  // 64MB for new generation
            '--optimize-for-size',        // Optimize for memory over speed
            '--gc-interval=100',          // More frequent GC
            '--trace-warnings'            // Debug warnings in production
        ];
    },
    
    // Environment variables
    getEnvVars() {
        return {
            UV_THREADPOOL_SIZE: RAILWAY_OPTIMIZATION.MEMORY.THREAD_POOL_SIZE,
            NODE_OPTIONS: this.getNodeFlags().join(' '),
            NODE_ENV: process.env.NODE_ENV || 'production'
        };
    }
};

/**
 * Memory monitoring utilities
 */
class MemoryMonitor {
    constructor() {
        this.intervalId = null;
        this.alerts = [];
    }
    
    start() {
        if (this.intervalId) return; // Already running
        
        console.log('🔍 Starting Railway memory monitor...');
        
        this.intervalId = setInterval(() => {
            const usage = process.memoryUsage();
            const uptime = process.uptime();
            
            const metrics = {
                rss: Math.round(usage.rss / 1024 / 1024),           // MB
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
                external: Math.round(usage.external / 1024 / 1024),  // MB
                uptime: Math.round(uptime / 3600 * 100) / 100       // Hours
            };
            
            // Log metrics
            if (process.env.NODE_ENV !== 'test') {
                console.log(`📊 Memory: RSS=${metrics.rss}MB, Heap=${metrics.heapUsed}/${metrics.heapTotal}MB, Uptime=${metrics.uptime}h`);
            }
            
            // Check memory alerts
            this.checkMemoryAlerts(metrics);
            
        }, RAILWAY_OPTIMIZATION.MONITORING.METRICS_INTERVAL);
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('⏹️ Memory monitor stopped');
        }
    }
    
    checkMemoryAlerts(metrics) {
        const threshold = RAILWAY_OPTIMIZATION.HEALTH_CHECK.MEMORY_THRESHOLD / 1024 / 1024; // Convert to MB
        
        if (metrics.rss > threshold) {
            const alert = {
                timestamp: new Date().toISOString(),
                type: 'HIGH_MEMORY_USAGE',
                value: metrics.rss,
                threshold: threshold
            };
            
            this.alerts.push(alert);
            console.warn(`🚨 HIGH MEMORY ALERT: ${metrics.rss}MB > ${threshold}MB`);
            
            // Trigger garbage collection if available
            if (global.gc) {
                console.log('♻️ Triggering manual garbage collection...');
                global.gc();
            }
        }
    }
    
    getAlerts() {
        return this.alerts;
    }
    
    clearAlerts() {
        this.alerts = [];
    }
}

/**
 * File system optimization utilities
 */
class FileSystemOptimizer {
    constructor() {
        this.cache = new Map();
        this.connectionPool = {
            active: 0,
            waiting: [],
            max: RAILWAY_OPTIMIZATION.CONNECTION_POOL.MAX_CONNECTIONS
        };
    }
    
    /**
     * Acquire file system connection from pool
     */
    async acquireConnection() {
        return new Promise((resolve) => {
            if (this.connectionPool.active < this.connectionPool.max) {
                this.connectionPool.active++;
                resolve(new FileSystemConnection(this));
            } else {
                this.connectionPool.waiting.push(resolve);
            }
        });
    }
    
    /**
     * Release file system connection back to pool
     */
    releaseConnection() {
        this.connectionPool.active--;
        
        if (this.connectionPool.waiting.length > 0) {
            const next = this.connectionPool.waiting.shift();
            this.connectionPool.active++;
            next(new FileSystemConnection(this));
        }
    }
    
    /**
     * Get cached data with TTL
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < RAILWAY_OPTIMIZATION.FILE_SYSTEM.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }
    
    /**
     * Set cached data
     */
    setCached(key, data) {
        // Implement LRU eviction if cache is full
        if (this.cache.size >= RAILWAY_OPTIMIZATION.FILE_SYSTEM.CACHE_SIZE) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Clear expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        const ttl = RAILWAY_OPTIMIZATION.FILE_SYSTEM.CACHE_TTL;
        
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > ttl) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Get pool statistics
     */
    getPoolStats() {
        return {
            active: this.connectionPool.active,
            waiting: this.connectionPool.waiting.length,
            cacheSize: this.cache.size,
            maxConnections: this.connectionPool.max
        };
    }
}

/**
 * File system connection wrapper
 */
class FileSystemConnection {
    constructor(optimizer) {
        this.optimizer = optimizer;
        this.id = Math.random().toString(36).substring(2);
    }
    
    async readFile(filePath, options = {}) {
        const cacheKey = `read:${filePath}`;
        const cached = this.optimizer.getCached(cacheKey);
        
        if (cached && !options.skipCache) {
            return cached;
        }
        
        try {
            const fs = require('fs').promises;
            const data = await fs.readFile(filePath, 'utf8');
            
            if (!options.skipCache) {
                this.optimizer.setCached(cacheKey, data);
            }
            
            return data;
        } finally {
            this.release();
        }
    }
    
    async writeFile(filePath, data, options = {}) {
        try {
            const fs = require('fs').promises;
            await fs.writeFile(filePath, data, 'utf8');
            
            // Invalidate cache for this file
            const cacheKey = `read:${filePath}`;
            this.optimizer.cache.delete(cacheKey);
            
        } finally {
            this.release();
        }
    }
    
    release() {
        this.optimizer.releaseConnection();
    }
}

/**
 * Railway deployment health checker
 */
class RailwayHealthChecker {
    constructor() {
        this.startTime = Date.now();
        this.memoryMonitor = new MemoryMonitor();
        this.fsOptimizer = new FileSystemOptimizer();
    }
    
    async getHealthStatus() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const memory = process.memoryUsage();
        const poolStats = this.fsOptimizer.getPoolStats();
        
        return {
            status: 'ok',
            deployment: 'railway',
            uptime: uptime,
            memory: {
                rss: Math.round(memory.rss / 1024 / 1024),
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024)
            },
            fileSystem: {
                poolActive: poolStats.active,
                poolWaiting: poolStats.waiting,
                cacheSize: poolStats.cacheSize
            },
            optimization: {
                memoryLimit: RAILWAY_OPTIMIZATION.MEMORY.MAX_OLD_SPACE_SIZE,
                threadPool: RAILWAY_OPTIMIZATION.MEMORY.THREAD_POOL_SIZE,
                cacheEnabled: true
            },
            alerts: this.memoryMonitor.getAlerts()
        };
    }
    
    start() {
        this.memoryMonitor.start();
        
        // Cache cleanup interval
        setInterval(() => {
            this.fsOptimizer.cleanupCache();
        }, RAILWAY_OPTIMIZATION.FILE_SYSTEM.CACHE_TTL);
        
        console.log('✅ Railway optimization services started');
    }
    
    stop() {
        this.memoryMonitor.stop();
        console.log('⏹️ Railway optimization services stopped');
    }
}

// Export configuration and utilities
module.exports = {
    RAILWAY_OPTIMIZATION,
    NODE_OPTIMIZATION,
    MemoryMonitor,
    FileSystemOptimizer,
    FileSystemConnection,
    RailwayHealthChecker
};