/**
 * @fileoverview Database Connection Pool Manager
 * @description Optimized connection pooling for PostgreSQL with Railway deployment support
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

const { Pool } = require('pg');
const { DATABASE, RAILWAY, MONITORING } = require('../config/constants');

/**
 * Connection Pool Manager Class
 * Manages PostgreSQL connections with intelligent pooling and monitoring
 */
class ConnectionPoolManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      errors: 0,
      queries: 0,
      avgQueryTime: 0
    };
    this.queryTimes = [];
  }

  /**
   * Initialize the connection pool with optimized settings
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.pool) {
      console.log('🔄 Connection pool already initialized');
      return;
    }

    const isRailway = RAILWAY.ENVIRONMENT_DETECTED;
    const databaseUrl = RAILWAY.DATABASE_URL || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for PostgreSQL connection pool');
    }

    console.log(`🚀 Initializing ${isRailway ? 'Railway' : 'local'} PostgreSQL connection pool...`);

    // Parse connection URL for Railway compatibility
    const connectionConfig = this.parseConnectionUrl(databaseUrl);

    // Optimize pool settings for Railway environment
    const poolConfig = {
      ...connectionConfig,
      min: DATABASE.POOL_MIN,
      max: isRailway ? Math.min(DATABASE.POOL_MAX, 10) : DATABASE.POOL_MAX, // Railway has connection limits
      idleTimeoutMillis: DATABASE.POOL_IDLE_TIMEOUT,
      connectionTimeoutMillis: DATABASE.CONNECTION_TIMEOUT,
      query_timeout: DATABASE.QUERY_TIMEOUT,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: DATABASE.SSL_ENABLED ? { rejectUnauthorized: false } : false,
      
      // Railway-specific optimizations
      ...(isRailway && {
        ssl: { rejectUnauthorized: false },
        keepAlive: true,
        keepAliveInitialDelayMillis: 0
      })
    };

    try {
      this.pool = new Pool(poolConfig);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Test connection
      await this.testConnection();
      
      this.isConnected = true;
      console.log('✅ PostgreSQL connection pool initialized successfully');
      
      // Start monitoring if enabled
      if (MONITORING.ENABLE_METRICS) {
        this.startMetricsCollection();
      }
      
    } catch (error) {
      console.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Parse database connection URL
   * @param {string} url - Database connection URL
   * @returns {Object} Connection configuration object
   */
  parseConnectionUrl(url) {
    const urlObj = new URL(url);
    
    return {
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 5432,
      database: urlObj.pathname.slice(1),
      user: urlObj.username,
      password: urlObj.password,
      
      // Connection optimizations
      statement_timeout: DATABASE.QUERY_TIMEOUT,
      idle_in_transaction_session_timeout: 10000,
      application_name: `pos-conejo-negro-${process.env.NODE_ENV || 'development'}`
    };
  }

  /**
   * Set up pool event handlers for monitoring and error handling
   */
  setupEventHandlers() {
    this.pool.on('connect', (client) => {
      this.metrics.totalConnections++;
      console.log('🔗 New client connected to PostgreSQL');
      
      // Set client-specific optimizations
      client.query('SET application_name = $1', [`pos-system-${Date.now()}`]);
    });

    this.pool.on('acquire', (client) => {
      this.metrics.activeConnections++;
      console.log('📤 Client acquired from pool');
    });

    this.pool.on('release', (err, client) => {
      this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
      this.metrics.idleConnections++;
      
      if (err) {
        console.error('⚠️ Client released with error:', err.message);
        this.metrics.errors++;
      }
    });

    this.pool.on('error', (err, client) => {
      console.error('❌ Unexpected error on idle client:', err);
      this.metrics.errors++;
      
      // Attempt reconnection if error is connection-related
      if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
        console.log('🔄 Attempting to reconnect due to connection error...');
        this.reconnect();
      }
    });

    this.pool.on('remove', (client) => {
      console.log('🗑️ Client removed from pool');
      this.metrics.totalConnections = Math.max(0, this.metrics.totalConnections - 1);
    });
  }

  /**
   * Test database connection
   * @returns {Promise<void>}
   */
  async testConnection() {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT NOW() as server_time, version() as server_version');
      console.log('🏥 Database connection test successful');
      console.log('   Server time:', result.rows[0].server_time);
      console.log('   PostgreSQL version:', result.rows[0].server_version.split(' ')[1]);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query with performance monitoring
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    if (!this.isConnected) {
      throw new Error('Database connection pool not initialized');
    }

    const startTime = process.hrtime.bigint();
    let result;

    try {
      result = await this.pool.query(text, params);
      this.metrics.queries++;
      
      // Track query performance
      const endTime = process.hrtime.bigint();
      const queryTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      this.updateQueryMetrics(queryTime);
      
      // Log slow queries
      if (queryTime > 1000 && MONITORING.ENABLE_REQUEST_LOGGING) {
        console.warn(`🐌 Slow query (${queryTime.toFixed(2)}ms):`, text.substring(0, 100));
      }
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      console.error('❌ Query error:', error.message);
      console.error('   Query:', text.substring(0, 100));
      throw error;
    }
  }

  /**
   * Execute a transaction with automatic rollback on error
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<any>} Transaction result
   */
  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database connection pool not initialized');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.metrics.errors++;
      console.error('❌ Transaction rolled back:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool for manual transaction management
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    if (!this.isConnected) {
      throw new Error('Database connection pool not initialized');
    }
    
    return await this.pool.connect();
  }

  /**
   * Update query performance metrics
   * @param {number} queryTime - Query execution time in milliseconds
   */
  updateQueryMetrics(queryTime) {
    this.queryTimes.push(queryTime);
    
    // Keep only last 1000 query times for average calculation
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }
    
    // Calculate average query time
    this.metrics.avgQueryTime = this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length;
  }

  /**
   * Start metrics collection interval
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectPoolMetrics();
    }, MONITORING.METRICS_INTERVAL);
  }

  /**
   * Collect pool metrics
   */
  collectPoolMetrics() {
    if (!this.pool) return;

    const poolInfo = {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      ...this.metrics,
      timestamp: new Date().toISOString()
    };

    // Emit metrics event
    process.emit('database-metrics', poolInfo);

    // Log metrics in development
    if (process.env.NODE_ENV !== 'production' && MONITORING.ENABLE_METRICS) {
      console.log('📊 Pool Metrics:', {
        total: poolInfo.totalCount,
        idle: poolInfo.idleCount,
        waiting: poolInfo.waitingCount,
        queries: poolInfo.queries,
        avgTime: poolInfo.avgQueryTime.toFixed(2) + 'ms',
        errors: poolInfo.errors
      });
    }
  }

  /**
   * Get current pool status
   * @returns {Object} Pool status information
   */
  getStatus() {
    if (!this.pool) {
      return { connected: false, error: 'Pool not initialized' };
    }

    return {
      connected: this.isConnected,
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingConnections: this.pool.waitingCount,
      metrics: this.metrics
    };
  }

  /**
   * Attempt to reconnect the pool
   */
  async reconnect() {
    console.log('🔄 Attempting to reconnect connection pool...');
    
    if (this.connectionAttempts >= DATABASE.RETRY_ATTEMPTS) {
      console.error('❌ Maximum reconnection attempts reached');
      return;
    }

    this.connectionAttempts++;
    
    try {
      if (this.pool) {
        await this.pool.end();
      }
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, DATABASE.RETRY_DELAY));
      
      // Reinitialize
      this.pool = null;
      this.isConnected = false;
      await this.initialize();
      
      this.connectionAttempts = 0;
      console.log('✅ Connection pool reconnected successfully');
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message);
      
      // Schedule another reconnection attempt
      setTimeout(() => {
        this.reconnect();
      }, DATABASE.RETRY_DELAY * this.connectionAttempts);
    }
  }

  /**
   * Gracefully close all connections
   * @returns {Promise<void>}
   */
  async close() {
    if (this.pool) {
      console.log('🔌 Closing database connection pool...');
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      console.log('✅ Connection pool closed successfully');
    }
  }

  /**
   * Health check for the connection pool
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    if (!this.isConnected) {
      return {
        healthy: false,
        message: 'Connection pool not initialized',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const startTime = Date.now();
      await this.query('SELECT 1 as health_check');
      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        message: 'Connection pool is healthy',
        responseTime: responseTime,
        poolStatus: this.getStatus(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${error.message}`,
        error: error.code,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Singleton instance
let poolManagerInstance = null;

/**
 * Get the singleton connection pool manager instance
 * @returns {ConnectionPoolManager} Pool manager instance
 */
function getConnectionPool() {
  if (!poolManagerInstance) {
    poolManagerInstance = new ConnectionPoolManager();
  }
  return poolManagerInstance;
}

module.exports = {
  ConnectionPoolManager,
  getConnectionPool
};