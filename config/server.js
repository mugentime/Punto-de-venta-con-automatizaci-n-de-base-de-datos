/**
 * @fileoverview Server Configuration for Railway Deployment
 * @description Optimized server settings for production Railway deployment
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

const cluster = require('cluster');
const os = require('os');
const { PERFORMANCE, RAILWAY, SERVER } = require('./constants');

/**
 * Server Configuration Class
 * Manages server settings and cluster configuration
 */
class ServerConfig {
  constructor() {
    this.settings = {
      // Core settings
      port: SERVER.PORT,
      host: SERVER.HOST,
      env: SERVER.NODE_ENV,
      
      // Performance settings
      keepAliveTimeout: PERFORMANCE.KEEPALIVE_TIMEOUT,
      headersTimeout: PERFORMANCE.HEADERS_TIMEOUT,
      requestTimeout: PERFORMANCE.REQUEST_TIMEOUT,
      maxHeaderSize: 8192, // 8KB
      maxConnections: RAILWAY.ENVIRONMENT_DETECTED ? 1000 : 0, // Railway has connection limits
      
      // Memory and process limits
      maxOldSpaceSize: RAILWAY.ENVIRONMENT_DETECTED ? 512 : 2048, // MB
      maxSemiSpaceSize: 16, // MB
      
      // Cluster settings
      enableClustering: false, // Disabled for Railway single-instance deployment
      workers: Math.min(os.cpus().length, 4),
      
      // SSL settings (if needed)
      ssl: {
        enabled: false,
        cert: null,
        key: null
      }
    };
  }

  /**
   * Apply optimizations for Railway deployment
   */
  applyRailwayOptimizations() {
    if (!RAILWAY.ENVIRONMENT_DETECTED) {
      return this.settings;
    }

    console.log('🚀 Applying Railway-specific optimizations...');

    // Railway-specific memory limits
    this.settings.maxOldSpaceSize = 400; // Conservative for Railway
    this.settings.maxSemiSpaceSize = 8;
    
    // Connection limits for Railway
    this.settings.maxConnections = 500;
    this.settings.keepAliveTimeout = 60000; // 60 seconds
    this.settings.headersTimeout = 61000; // 61 seconds
    
    // Disable clustering on Railway (single instance)
    this.settings.enableClustering = false;
    
    // Enable trust proxy for Railway
    this.settings.trustProxy = true;
    
    console.log('✅ Railway optimizations applied');
    
    return this.settings;
  }

  /**
   * Get optimized Node.js flags for Railway
   * @returns {Array<string>} Node.js flags
   */
  getNodeFlags() {
    const flags = [
      '--max-old-space-size=' + this.settings.maxOldSpaceSize,
      '--max-semi-space-size=' + this.settings.maxSemiSpaceSize,
      '--optimize-for-size',
      '--gc-interval=100',
      '--expose-gc'
    ];

    if (RAILWAY.ENVIRONMENT_DETECTED) {
      flags.push(
        '--max-http-header-size=8192',
        '--http-server-default-timeout=30000',
        '--unhandled-rejections=strict'
      );
    }

    return flags;
  }

  /**
   * Configure Express app with optimized settings
   * @param {Object} app - Express application
   */
  configureExpress(app) {
    console.log('⚙️ Configuring Express with performance optimizations...');

    // Trust proxy for Railway
    if (RAILWAY.ENVIRONMENT_DETECTED) {
      app.set('trust proxy', true);
    }

    // Disable unnecessary headers
    app.disable('x-powered-by');
    app.disable('etag'); // We handle ETags manually

    // Set limits
    app.set('json spaces', process.env.NODE_ENV === 'production' ? 0 : 2);
    
    // Configure view engine (if using)
    app.set('view cache', process.env.NODE_ENV === 'production');
    
    console.log('✅ Express configuration applied');
  }

  /**
   * Setup server with optimized settings
   * @param {Object} server - HTTP server instance
   */
  setupServer(server) {
    console.log('🔧 Setting up server with performance optimizations...');

    // Configure timeouts
    server.keepAliveTimeout = this.settings.keepAliveTimeout;
    server.headersTimeout = this.settings.headersTimeout;
    server.requestTimeout = this.settings.requestTimeout;
    
    // Configure connection limits
    if (this.settings.maxConnections > 0) {
      server.maxConnections = this.settings.maxConnections;
    }

    // Configure socket settings
    server.on('connection', (socket) => {
      // Set socket timeout
      socket.setTimeout(this.settings.requestTimeout);
      
      // Enable keep-alive
      socket.setKeepAlive(true, 30000); // 30 seconds
      
      // Disable Nagle's algorithm for low latency
      socket.setNoDelay(true);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('🚨 Server error:', error);
      
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${this.settings.port} is already in use`);
        process.exit(1);
      }
    });

    // Handle client errors
    server.on('clientError', (err, socket) => {
      console.warn('⚠️ Client error:', err.message);
      
      if (!socket.destroyed) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      }
    });

    // Graceful shutdown handling
    this.setupGracefulShutdown(server);

    console.log('✅ Server optimization setup complete');
  }

  /**
   * Setup graceful shutdown handling
   * @param {Object} server - HTTP server instance
   */
  setupGracefulShutdown(server) {
    const shutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}, shutting down gracefully...`);
      
      // Stop accepting new connections
      server.close(async (err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }

        console.log('🛑 Server closed');
        
        try {
          // Close database connections
          const { getConnectionPool } = require('../utils/connectionPool');
          const pool = getConnectionPool();
          if (pool && pool.isConnected) {
            await pool.close();
            console.log('🗄️ Database connections closed');
          }

          console.log('✅ Graceful shutdown complete');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during graceful shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('⏰ Shutdown timeout reached, forcing exit...');
        process.exit(1);
      }, 10000); // 10 seconds
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (err) => {
      console.error('🚨 Uncaught Exception:', err);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  /**
   * Initialize cluster mode (if enabled)
   * @param {Function} startServer - Function to start the server
   */
  initializeCluster(startServer) {
    if (!this.settings.enableClustering) {
      return startServer();
    }

    const numCPUs = os.cpus().length;
    const workers = Math.min(this.settings.workers, numCPUs);

    if (cluster.isMaster) {
      console.log(`🏭 Master process ${process.pid} starting ${workers} workers...`);

      // Fork workers
      for (let i = 0; i < workers; i++) {
        cluster.fork();
      }

      // Handle worker events
      cluster.on('online', (worker) => {
        console.log(`👷 Worker ${worker.process.pid} is online`);
      });

      cluster.on('exit', (worker, code, signal) => {
        console.log(`💀 Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
        cluster.fork();
      });

      // Graceful shutdown for master
      process.on('SIGTERM', () => {
        console.log('🏭 Master received SIGTERM, shutting down workers...');
        
        for (const id in cluster.workers) {
          cluster.workers[id].kill();
        }
      });

    } else {
      // Worker process
      startServer();
      console.log(`👷 Worker ${process.pid} started`);
    }
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    if (!process.env.NODE_ENV === 'production') {
      return;
    }

    const checkMemory = () => {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;

      // Warn if memory usage is high
      if (heapUsedMB > this.settings.maxOldSpaceSize * 0.8) {
        console.warn(`⚠️ High memory usage: ${heapUsedMB.toFixed(2)}MB/${this.settings.maxOldSpaceSize}MB`);
      }

      // Force GC if available and memory is very high
      if (global.gc && heapUsedMB > this.settings.maxOldSpaceSize * 0.9) {
        console.log('🧹 Forcing garbage collection...');
        global.gc();
      }
    };

    // Check memory every 30 seconds
    setInterval(checkMemory, 30000);
  }

  /**
   * Get complete server configuration
   * @returns {Object} Server configuration
   */
  getConfig() {
    return {
      ...this.settings,
      nodeFlags: this.getNodeFlags(),
      timestamp: new Date().toISOString(),
      railway: RAILWAY.ENVIRONMENT_DETECTED
    };
  }
}

// Export singleton instance
const serverConfig = new ServerConfig();

// Apply Railway optimizations if detected
if (RAILWAY.ENVIRONMENT_DETECTED) {
  serverConfig.applyRailwayOptimizations();
}

module.exports = {
  ServerConfig,
  serverConfig
};