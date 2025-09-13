/**
 * Error Tracking System for POS Railway Deployment
 * @description Comprehensive error logging, categorization, and analysis
 * @author Operational Launch Monitor
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const axios = require('axios');
const config = require('../config/monitoring-config');

class ErrorTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = { ...config, ...options };
    this.errors = new Map();
    this.errorPatterns = new Map();
    this.isRunning = false;
    this.logDirectory = path.join(__dirname, '..', 'logs', 'errors');
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    
    // Error classification patterns
    this.errorClassifications = {
      database: [/database/i, /connection/i, /timeout/i, /query/i],
      authentication: [/auth/i, /login/i, /token/i, /unauthorized/i, /forbidden/i],
      validation: [/validation/i, /invalid/i, /required/i, /format/i],
      network: [/network/i, /fetch/i, /axios/i, /request/i, /econnrefused/i],
      security: [/security/i, /csrf/i, /xss/i, /injection/i],
      business: [/product/i, /sale/i, /inventory/i, /cashcut/i, /customer/i],
      system: [/memory/i, /heap/i, /stack/i, /overflow/i],
      unknown: []
    };
  }

  /**
   * Initialize error tracker
   */
  async initialize() {
    console.log('🔍 Initializing Error Tracker');
    
    // Create log directory
    await fs.mkdir(this.logDirectory, { recursive: true });
    
    // Load existing error patterns
    await this.loadErrorPatterns();
    
    this.isRunning = true;
    console.log('✅ Error Tracker initialized');
  }

  /**
   * Track an error
   */
  async trackError(error, context = {}) {
    if (!this.isRunning) {
      await this.initialize();
    }

    const errorData = this.processError(error, context);
    const errorId = this.generateErrorId(errorData);
    
    // Store error
    this.errors.set(errorId, errorData);
    
    // Update error patterns
    this.updateErrorPatterns(errorData);
    
    // Log error to file
    await this.logErrorToFile(errorData);
    
    // Emit error event
    this.emit('error', errorData);
    
    // Check if this error pattern should trigger an alert
    await this.checkForAlert(errorData);
    
    return errorId;
  }

  /**
   * Process error into standardized format
   */
  processError(error, context) {
    const timestamp = Date.now();
    const errorData = {
      id: null, // Will be set by generateErrorId
      timestamp,
      timestampISO: new Date(timestamp).toISOString(),
      message: error.message || String(error),
      stack: error.stack || null,
      name: error.name || 'Error',
      code: error.code || null,
      statusCode: error.response?.status || error.statusCode || null,
      context: {
        url: context.url || null,
        method: context.method || null,
        userId: context.userId || null,
        userAgent: context.userAgent || null,
        ip: context.ip || null,
        sessionId: context.sessionId || null,
        ...context
      },
      classification: this.classifyError(error),
      severity: this.calculateSeverity(error, context),
      fingerprint: this.generateFingerprint(error),
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'unknown'
    };

    errorData.id = this.generateErrorId(errorData);
    return errorData;
  }

  /**
   * Classify error by type
   */
  classifyError(error) {
    const errorText = `${error.message} ${error.stack || ''}`.toLowerCase();
    
    for (const [category, patterns] of Object.entries(this.errorClassifications)) {
      if (patterns.some(pattern => pattern.test(errorText))) {
        return category;
      }
    }
    
    return 'unknown';
  }

  /**
   * Calculate error severity
   */
  calculateSeverity(error, context) {
    // Critical errors
    if (error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('database') ||
        error.statusCode >= 500 ||
        error.name === 'SyntaxError') {
      return 'critical';
    }
    
    // High severity errors
    if (error.statusCode === 401 || 
        error.statusCode === 403 ||
        error.message?.includes('timeout')) {
      return 'high';
    }
    
    // Medium severity errors
    if (error.statusCode >= 400 ||
        error.name === 'ValidationError') {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Generate error fingerprint for deduplication
   */
  generateFingerprint(error) {
    const components = [
      error.name || 'Error',
      error.message?.replace(/\d+/g, 'N')?.substring(0, 100) || 'unknown',
      error.stack?.split('\n')[1]?.replace(/:\d+:\d+/g, ':N:N') || 'unknown'
    ];
    
    return Buffer.from(components.join('|')).toString('base64').substring(0, 16);
  }

  /**
   * Generate unique error ID
   */
  generateErrorId(errorData) {
    return `err_${errorData.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update error patterns for analysis
   */
  updateErrorPatterns(errorData) {
    const pattern = errorData.fingerprint;
    
    if (this.errorPatterns.has(pattern)) {
      const existing = this.errorPatterns.get(pattern);
      existing.count++;
      existing.lastSeen = errorData.timestamp;
      existing.occurrences.push({
        timestamp: errorData.timestamp,
        context: errorData.context
      });
      
      // Keep only last 100 occurrences
      if (existing.occurrences.length > 100) {
        existing.occurrences = existing.occurrences.slice(-100);
      }
    } else {
      this.errorPatterns.set(pattern, {
        fingerprint: pattern,
        message: errorData.message,
        classification: errorData.classification,
        severity: errorData.severity,
        count: 1,
        firstSeen: errorData.timestamp,
        lastSeen: errorData.timestamp,
        occurrences: [{
          timestamp: errorData.timestamp,
          context: errorData.context
        }]
      });
    }
  }

  /**
   * Check if error should trigger an alert
   */
  async checkForAlert(errorData) {
    const pattern = this.errorPatterns.get(errorData.fingerprint);
    if (!pattern) return;

    // Alert on critical errors immediately
    if (errorData.severity === 'critical') {
      await this.triggerAlert('critical_error', {
        error: errorData,
        pattern: pattern
      });
    }

    // Alert on error spikes (same error 5+ times in 5 minutes)
    if (pattern.count >= 5) {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const recentOccurrences = pattern.occurrences.filter(
        occ => occ.timestamp > fiveMinutesAgo
      );

      if (recentOccurrences.length >= 5) {
        await this.triggerAlert('error_spike', {
          pattern: pattern,
          recentCount: recentOccurrences.length,
          timeWindow: '5 minutes'
        });
      }
    }
  }

  /**
   * Trigger alert through alert system
   */
  async triggerAlert(alertType, data) {
    try {
      const AlertSystem = require('./alert-system');
      const alertSystem = new AlertSystem();
      await alertSystem.initialize();
      await alertSystem.trigger(alertType, data);
    } catch (error) {
      console.error('❌ Failed to trigger alert:', error.message);
    }
  }

  /**
   * Log error to file
   */
  async logErrorToFile(errorData) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.logDirectory, `errors-${date}.jsonl`);
      
      // Check log file size and rotate if necessary
      await this.rotateLogIfNeeded(logFile);
      
      // Append error to log file
      const logEntry = JSON.stringify(errorData) + '\n';
      await fs.appendFile(logFile, logEntry, 'utf8');
      
    } catch (error) {
      console.error('❌ Failed to log error to file:', error.message);
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  async rotateLogIfNeeded(logFile) {
    try {
      const stats = await fs.stat(logFile);
      if (stats.size > this.maxLogSize) {
        const backupFile = logFile.replace('.jsonl', `-${Date.now()}.jsonl`);
        await fs.rename(logFile, backupFile);
        console.log(`📦 Rotated error log: ${path.basename(backupFile)}`);
      }
    } catch (error) {
      // File doesn't exist yet, no need to rotate
    }
  }

  /**
   * Load error patterns from file
   */
  async loadErrorPatterns() {
    try {
      const patternsFile = path.join(this.logDirectory, 'error-patterns.json');
      const data = await fs.readFile(patternsFile, 'utf8');
      const patterns = JSON.parse(data);
      
      for (const pattern of patterns) {
        this.errorPatterns.set(pattern.fingerprint, pattern);
      }
      
      console.log(`📊 Loaded ${patterns.length} error patterns`);
    } catch (error) {
      // No existing patterns file, start fresh
      console.log('📊 Starting with fresh error patterns');
    }
  }

  /**
   * Save error patterns to file
   */
  async saveErrorPatterns() {
    try {
      const patternsFile = path.join(this.logDirectory, 'error-patterns.json');
      const patterns = Array.from(this.errorPatterns.values());
      await fs.writeFile(patternsFile, JSON.stringify(patterns, null, 2));
      console.log(`💾 Saved ${patterns.length} error patterns`);
    } catch (error) {
      console.error('❌ Failed to save error patterns:', error.message);
    }
  }

  /**
   * Get error statistics
   */
  getStatistics(hours = 24) {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    const recentErrors = Array.from(this.errors.values())
      .filter(error => error.timestamp > cutoffTime);

    const stats = {
      total: recentErrors.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byClassification: {},
      topPatterns: [],
      timeline: []
    };

    // Count by severity
    recentErrors.forEach(error => {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
    });

    // Count by classification
    recentErrors.forEach(error => {
      stats.byClassification[error.classification] = 
        (stats.byClassification[error.classification] || 0) + 1;
    });

    // Get top error patterns
    const recentPatterns = Array.from(this.errorPatterns.values())
      .filter(pattern => pattern.lastSeen > cutoffTime)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    stats.topPatterns = recentPatterns.map(pattern => ({
      fingerprint: pattern.fingerprint,
      message: pattern.message.substring(0, 100),
      classification: pattern.classification,
      severity: pattern.severity,
      count: pattern.count,
      firstSeen: new Date(pattern.firstSeen).toISOString(),
      lastSeen: new Date(pattern.lastSeen).toISOString()
    }));

    // Create timeline (hourly buckets)
    const timeline = [];
    for (let i = hours; i > 0; i--) {
      const bucketStart = Date.now() - (i * 60 * 60 * 1000);
      const bucketEnd = bucketStart + (60 * 60 * 1000);
      const bucketErrors = recentErrors.filter(
        error => error.timestamp >= bucketStart && error.timestamp < bucketEnd
      );

      timeline.push({
        hour: new Date(bucketStart).toISOString(),
        count: bucketErrors.length,
        critical: bucketErrors.filter(e => e.severity === 'critical').length
      });
    }
    stats.timeline = timeline;

    return stats;
  }

  /**
   * Search errors by criteria
   */
  searchErrors(criteria) {
    const results = [];
    const {
      message,
      classification,
      severity,
      startTime,
      endTime,
      limit = 100
    } = criteria;

    for (const error of this.errors.values()) {
      // Filter by time range
      if (startTime && error.timestamp < startTime) continue;
      if (endTime && error.timestamp > endTime) continue;
      
      // Filter by message
      if (message && !error.message.toLowerCase().includes(message.toLowerCase())) continue;
      
      // Filter by classification
      if (classification && error.classification !== classification) continue;
      
      // Filter by severity
      if (severity && error.severity !== severity) continue;
      
      results.push(error);
      
      if (results.length >= limit) break;
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate error report
   */
  generateReport(hours = 24) {
    const stats = this.getStatistics(hours);
    const totalPatterns = this.errorPatterns.size;
    
    const report = {
      period: `${hours} hours`,
      timestamp: new Date().toISOString(),
      summary: {
        totalErrors: stats.total,
        uniquePatterns: totalPatterns,
        errorRate: stats.total > 0 ? (stats.total / hours).toFixed(2) + '/hour' : '0/hour',
        criticalErrors: stats.bySeverity.critical,
        mostCommonClassification: Object.keys(stats.byClassification)
          .sort((a, b) => stats.byClassification[b] - stats.byClassification[a])[0] || 'none'
      },
      statistics: stats,
      recommendations: this.generateRecommendations(stats),
      topIssues: stats.topPatterns.slice(0, 5).map(pattern => ({
        ...pattern,
        recommendation: this.getPatternRecommendation(pattern)
      }))
    };

    return report;
  }

  /**
   * Generate recommendations based on error patterns
   */
  generateRecommendations(stats) {
    const recommendations = [];

    // Critical error recommendation
    if (stats.bySeverity.critical > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'stability',
        title: 'Critical Errors Detected',
        description: `${stats.bySeverity.critical} critical errors found`,
        action: 'Investigate and fix critical errors immediately'
      });
    }

    // High error rate recommendation
    if (stats.total > 50) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        title: 'High Error Rate',
        description: `${stats.total} errors in the last ${24} hours`,
        action: 'Review error patterns and implement preventive measures'
      });
    }

    // Database error recommendation
    if (stats.byClassification.database > 0) {
      recommendations.push({
        priority: 'high',
        category: 'database',
        title: 'Database Errors Detected',
        description: `${stats.byClassification.database} database-related errors`,
        action: 'Check database connection and query performance'
      });
    }

    // Authentication error recommendation
    if (stats.byClassification.authentication > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'security',
        title: 'Authentication Issues',
        description: `${stats.byClassification.authentication} authentication errors`,
        action: 'Review authentication system and potential security issues'
      });
    }

    return recommendations;
  }

  /**
   * Get recommendation for specific error pattern
   */
  getPatternRecommendation(pattern) {
    const recommendations = {
      database: 'Check database connection, optimize queries, implement connection pooling',
      authentication: 'Review token validation, check session management, audit security',
      validation: 'Improve input validation, add proper error handling, update documentation',
      network: 'Check network connectivity, implement retry logic, add circuit breakers',
      security: 'Audit security measures, update dependencies, review access controls',
      business: 'Review business logic, add proper validation, improve error messages',
      system: 'Check system resources, optimize memory usage, review deployment configuration',
      unknown: 'Investigate error context, add better logging, categorize error type'
    };

    return recommendations[pattern.classification] || recommendations.unknown;
  }

  /**
   * Clean up old errors (keep last 7 days)
   */
  async cleanup() {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    let removedCount = 0;

    for (const [id, error] of this.errors.entries()) {
      if (error.timestamp < cutoffTime) {
        this.errors.delete(id);
        removedCount++;
      }
    }

    // Clean up old patterns (remove patterns not seen in 30 days)
    const patternCutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let removedPatterns = 0;

    for (const [fingerprint, pattern] of this.errorPatterns.entries()) {
      if (pattern.lastSeen < patternCutoff) {
        this.errorPatterns.delete(fingerprint);
        removedPatterns++;
      }
    }

    console.log(`🧹 Cleaned up ${removedCount} old errors and ${removedPatterns} old patterns`);
    
    // Save updated patterns
    await this.saveErrorPatterns();
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      errorsTracked: this.errors.size,
      errorPatterns: this.errorPatterns.size,
      recentErrors: this.getStatistics(1).total, // Last hour
      criticalErrors: this.getStatistics(1).bySeverity.critical
    };
  }
}

module.exports = ErrorTracker;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const tracker = new ErrorTracker();

  async function runCommand() {
    await tracker.initialize();

    switch (command) {
      case 'status':
        const status = tracker.getStatus();
        console.log('🔍 Error Tracker Status:', JSON.stringify(status, null, 2));
        break;
        
      case 'stats':
        const hours = parseInt(process.argv[3]) || 24;
        const stats = tracker.getStatistics(hours);
        console.log(`📊 Error Statistics (last ${hours} hours):`);
        console.log(JSON.stringify(stats, null, 2));
        break;
        
      case 'report':
        const reportHours = parseInt(process.argv[3]) || 24;
        const report = tracker.generateReport(reportHours);
        console.log(`📋 Error Report (last ${reportHours} hours):`);
        console.log(JSON.stringify(report, null, 2));
        break;
        
      case 'search':
        const searchTerm = process.argv[3];
        if (!searchTerm) {
          console.error('❌ Search term required');
          process.exit(1);
        }
        const results = tracker.searchErrors({ message: searchTerm, limit: 10 });
        console.log(`🔍 Search results for "${searchTerm}":`);
        console.log(JSON.stringify(results, null, 2));
        break;
        
      case 'cleanup':
        await tracker.cleanup();
        break;
        
      case 'test':
        // Track a test error
        const testError = new Error('Test error for tracking system');
        testError.code = 'TEST_ERROR';
        const errorId = await tracker.trackError(testError, {
          url: '/test',
          method: 'GET',
          userId: 'test-user'
        });
        console.log('✅ Test error tracked with ID:', errorId);
        break;
        
      default:
        console.log('Error Tracker Commands:');
        console.log('  status              - Show tracker status');
        console.log('  stats [hours]       - Show error statistics');
        console.log('  report [hours]      - Generate error report');
        console.log('  search <term>       - Search errors');
        console.log('  cleanup             - Clean up old errors');
        console.log('  test                - Track test error');
        process.exit(1);
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}