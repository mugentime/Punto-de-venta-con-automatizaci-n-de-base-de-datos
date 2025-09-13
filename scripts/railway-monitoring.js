/**
 * Railway Monitoring System
 * Real-time monitoring and alerting for Railway deployment
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class RailwayMonitor {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.RAILWAY_URL || 'https://pos-conejonegro-production.up.railway.app';
    this.checkInterval = config.checkInterval || 60000; // 1 minute
    this.timeout = config.timeout || 30000;
    this.maxFailures = config.maxFailures || 3;
    this.alertCooldown = config.alertCooldown || 300000; // 5 minutes
    
    this.state = {
      isRunning: false,
      consecutiveFailures: 0,
      lastSuccessTime: null,
      lastFailureTime: null,
      lastAlertTime: null,
      totalChecks: 0,
      totalFailures: 0,
      uptime: 0,
      downtimeStart: null,
      metrics: {
        responseTime: [],
        availability: [],
        errorRates: []
      }
    };
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      validateStatus: () => true
    });
    
    this.logFile = path.join(__dirname, '..', 'logs', 'railway-monitoring.log');
    this.metricsFile = path.join(__dirname, '..', 'logs', 'railway-metrics.json');
  }

  async log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;
    
    console.log(`[${level}] ${message}`);
    if (data) console.log(data);
    
    try {
      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
      await fs.appendFile(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  async saveMetrics() {
    try {
      await fs.mkdir(path.dirname(this.metricsFile), { recursive: true });
      await fs.writeFile(this.metricsFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        state: this.state,
        summary: this.getSummary()
      }, null, 2));
    } catch (error) {
      console.error('Failed to save metrics:', error.message);
    }
  }

  async performHealthCheck() {
    const startTime = Date.now();
    const checkResult = {
      timestamp: new Date().toISOString(),
      success: false,
      responseTime: 0,
      status: null,
      error: null,
      details: {}
    };

    try {
      // Primary health check
      const healthResponse = await this.client.get('/api/health');
      checkResult.responseTime = Date.now() - startTime;
      checkResult.status = healthResponse.status;
      
      if (healthResponse.status === 200) {
        checkResult.success = true;
        checkResult.details.health = healthResponse.data;
        
        // Additional checks for comprehensive monitoring
        await this.performAdditionalChecks(checkResult);
        
      } else {
        checkResult.error = `Health check returned status ${healthResponse.status}`;
        checkResult.details.response = healthResponse.data;
      }
      
    } catch (error) {
      checkResult.responseTime = Date.now() - startTime;
      checkResult.error = error.message;
      checkResult.details.errorCode = error.code;
      checkResult.details.errorType = error.constructor.name;
    }

    return checkResult;
  }

  async performAdditionalChecks(checkResult) {
    try {
      // Check authentication endpoint
      const authStart = Date.now();
      const authResponse = await this.client.get('/api/version');
      checkResult.details.authCheck = {
        responseTime: Date.now() - authStart,
        status: authResponse.status,
        success: authResponse.status === 200
      };

      // Check database connectivity through debug endpoint
      const dbStart = Date.now();
      const dbResponse = await this.client.get('/api/debug/users');
      checkResult.details.databaseCheck = {
        responseTime: Date.now() - dbStart,
        status: dbResponse.status,
        success: dbResponse.status === 200,
        userCount: dbResponse.data?.count || dbResponse.data?.userCount || 0
      };

      // Check static assets
      const staticStart = Date.now();
      const staticResponse = await this.client.get('/');
      checkResult.details.staticCheck = {
        responseTime: Date.now() - staticStart,
        status: staticResponse.status,
        success: staticResponse.status === 200,
        contentLength: staticResponse.data?.length || 0
      };

    } catch (error) {
      checkResult.details.additionalChecksError = error.message;
    }
  }

  updateState(checkResult) {
    this.state.totalChecks++;
    
    if (checkResult.success) {
      this.state.consecutiveFailures = 0;
      this.state.lastSuccessTime = checkResult.timestamp;
      
      if (this.state.downtimeStart) {
        const downtime = Date.now() - this.state.downtimeStart;
        this.log('INFO', `Service recovered after ${this.formatDuration(downtime)} of downtime`);
        this.state.downtimeStart = null;
      }
      
    } else {
      this.state.consecutiveFailures++;
      this.state.totalFailures++;
      this.state.lastFailureTime = checkResult.timestamp;
      
      if (!this.state.downtimeStart) {
        this.state.downtimeStart = Date.now();
      }
    }
    
    // Update metrics
    this.state.metrics.responseTime.push({
      timestamp: checkResult.timestamp,
      value: checkResult.responseTime
    });
    
    this.state.metrics.availability.push({
      timestamp: checkResult.timestamp,
      value: checkResult.success ? 1 : 0
    });
    
    // Keep only last 100 metrics to prevent memory bloat
    if (this.state.metrics.responseTime.length > 100) {
      this.state.metrics.responseTime = this.state.metrics.responseTime.slice(-100);
      this.state.metrics.availability = this.state.metrics.availability.slice(-100);
    }
  }

  async checkForAlerts(checkResult) {
    const now = Date.now();
    const shouldAlert = this.state.consecutiveFailures >= this.maxFailures &&
                       (!this.state.lastAlertTime || 
                        now - this.state.lastAlertTime > this.alertCooldown);

    if (shouldAlert) {
      await this.sendAlert(checkResult);
      this.state.lastAlertTime = now;
    }
  }

  async sendAlert(checkResult) {
    const alertData = {
      timestamp: checkResult.timestamp,
      severity: 'CRITICAL',
      service: 'Railway POS Application',
      url: this.baseUrl,
      consecutiveFailures: this.state.consecutiveFailures,
      lastError: checkResult.error,
      totalDowntime: this.state.downtimeStart ? 
        this.formatDuration(Date.now() - this.state.downtimeStart) : 'N/A',
      summary: this.getSummary()
    };

    this.log('ALERT', `🚨 SERVICE DOWN - ${this.state.consecutiveFailures} consecutive failures`, alertData);
    
    // In a real implementation, you could send alerts via:
    // - Email (nodemailer)
    // - Slack webhook
    // - Discord webhook
    // - SMS (Twilio)
    // - PagerDuty
    
    // For now, we'll create an alert file
    const alertFile = path.join(path.dirname(this.logFile), `alert-${Date.now()}.json`);
    try {
      await fs.writeFile(alertFile, JSON.stringify(alertData, null, 2));
      this.log('INFO', `Alert saved to ${alertFile}`);
    } catch (error) {
      this.log('ERROR', 'Failed to save alert file', error.message);
    }
  }

  getSummary() {
    const now = Date.now();
    const availability = this.state.totalChecks > 0 ? 
      ((this.state.totalChecks - this.state.totalFailures) / this.state.totalChecks * 100).toFixed(2) : 0;
    
    const avgResponseTime = this.state.metrics.responseTime.length > 0 ?
      this.state.metrics.responseTime.reduce((sum, m) => sum + m.value, 0) / this.state.metrics.responseTime.length : 0;

    return {
      status: this.state.consecutiveFailures === 0 ? 'HEALTHY' : 'DEGRADED',
      availability: `${availability}%`,
      averageResponseTime: `${Math.round(avgResponseTime)}ms`,
      totalChecks: this.state.totalChecks,
      totalFailures: this.state.totalFailures,
      consecutiveFailures: this.state.consecutiveFailures,
      currentDowntime: this.state.downtimeStart ? 
        this.formatDuration(now - this.state.downtimeStart) : null,
      lastCheck: this.state.lastSuccessTime || this.state.lastFailureTime,
      uptime: this.formatDuration(now - (this.startTime || now))
    };
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  async start() {
    if (this.state.isRunning) {
      this.log('WARN', 'Monitor is already running');
      return;
    }

    this.state.isRunning = true;
    this.startTime = Date.now();
    
    this.log('INFO', `🚀 Starting Railway monitor for ${this.baseUrl}`);
    this.log('INFO', `Check interval: ${this.formatDuration(this.checkInterval)}`);
    this.log('INFO', `Alert threshold: ${this.maxFailures} consecutive failures`);
    
    this.monitorInterval = setInterval(async () => {
      try {
        const checkResult = await this.performHealthCheck();
        this.updateState(checkResult);
        
        const summary = this.getSummary();
        
        if (checkResult.success) {
          this.log('INFO', `✅ Health check passed (${checkResult.responseTime}ms) - ${summary.status}`);
        } else {
          this.log('ERROR', `❌ Health check failed (${checkResult.responseTime}ms)`, {
            error: checkResult.error,
            consecutiveFailures: this.state.consecutiveFailures
          });
        }
        
        await this.checkForAlerts(checkResult);
        await this.saveMetrics();
        
        // Log summary every 10 checks
        if (this.state.totalChecks % 10 === 0) {
          this.log('INFO', '📊 Monitor summary', summary);
        }
        
      } catch (error) {
        this.log('ERROR', 'Monitor check failed', error.message);
      }
    }, this.checkInterval);
  }

  async stop() {
    if (!this.state.isRunning) {
      this.log('WARN', 'Monitor is not running');
      return;
    }

    this.state.isRunning = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    const summary = this.getSummary();
    this.log('INFO', '🛑 Railway monitor stopped', summary);
    await this.saveMetrics();
  }

  async getStatus() {
    return {
      isRunning: this.state.isRunning,
      summary: this.getSummary(),
      recentMetrics: {
        responseTime: this.state.metrics.responseTime.slice(-10),
        availability: this.state.metrics.availability.slice(-10)
      }
    };
  }

  async generateDashboard() {
    const summary = this.getSummary();
    const status = await this.getStatus();
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Monitoring Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            padding: 2rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            text-align: center;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header .url { font-size: 1.2rem; opacity: 0.9; }
        
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1.5rem;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1rem;
            margin: 1rem 0;
        }
        .status-badge.healthy { background: #d4edda; color: #155724; }
        .status-badge.degraded { background: #f8d7da; color: #721c24; }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .metric-card {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            text-align: center;
        }
        .metric-card .value {
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        .metric-card .label {
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-size: 0.9rem;
        }
        
        .chart-container {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .chart-container h3 {
            margin-bottom: 1rem;
            color: #495057;
        }
        
        .footer {
            text-align: center;
            color: #6c757d;
            margin-top: 2rem;
        }
        
        .refresh-note {
            background: #e2e3e5;
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 2rem;
            color: #495057;
        }
    </style>
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Railway Monitoring Dashboard</h1>
            <div class="url">${this.baseUrl}</div>
            <div class="status-badge ${summary.status.toLowerCase()}">
                ${summary.status} ${summary.status === 'HEALTHY' ? '✅' : '⚠️'}
            </div>
        </div>
        
        <div class="refresh-note">
            📊 Live monitoring data • Auto-refresh in 30s • Last updated: ${new Date().toLocaleString()}
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="value">${summary.availability}</div>
                <div class="label">Availability</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.averageResponseTime}</div>
                <div class="label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.totalChecks}</div>
                <div class="label">Total Checks</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.totalFailures}</div>
                <div class="label">Total Failures</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.consecutiveFailures}</div>
                <div class="label">Consecutive Failures</div>
            </div>
            <div class="metric-card">
                <div class="value">${summary.uptime}</div>
                <div class="label">Monitor Uptime</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h3>📈 Recent Response Times (Last 10 checks)</h3>
            <div style="font-family: monospace; line-height: 1.8;">
                ${status.recentMetrics.responseTime.map(m => 
                  `${new Date(m.timestamp).toLocaleTimeString()}: ${m.value}ms`
                ).join('<br>')}
            </div>
        </div>
        
        <div class="chart-container">
            <h3>🔄 Recent Availability (Last 10 checks)</h3>
            <div style="font-family: monospace; line-height: 1.8;">
                ${status.recentMetrics.availability.map(m => 
                  `${new Date(m.timestamp).toLocaleTimeString()}: ${m.value ? '✅ UP' : '❌ DOWN'}`
                ).join('<br>')}
            </div>
        </div>
        
        ${summary.currentDowntime ? `
            <div class="chart-container" style="background: #fff5f5; border: 2px solid #feb2b2;">
                <h3 style="color: #c53030;">🚨 Current Downtime</h3>
                <div style="font-size: 1.5rem; font-weight: bold; color: #c53030;">
                    ${summary.currentDowntime}
                </div>
            </div>
        ` : ''}
        
        <div class="footer">
            <p>Railway Monitoring System v1.0 • Status: ${status.isRunning ? 'RUNNING' : 'STOPPED'}</p>
        </div>
    </div>
</body>
</html>`;

    const dashboardPath = path.join(__dirname, '..', 'reports', 'railway-dashboard.html');
    await fs.mkdir(path.dirname(dashboardPath), { recursive: true });
    await fs.writeFile(dashboardPath, html);
    
    return dashboardPath;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const config = {
    baseUrl: args[1] || process.env.RAILWAY_URL
  };
  
  const monitor = new RailwayMonitor(config);
  
  switch (command) {
    case 'start':
      monitor.start().then(() => {
        console.log('Railway monitor started. Press Ctrl+C to stop.');
        
        process.on('SIGINT', async () => {
          console.log('\nShutting down monitor...');
          await monitor.stop();
          process.exit(0);
        });
      });
      break;
      
    case 'status':
      monitor.getStatus().then(status => {
        console.log(JSON.stringify(status, null, 2));
        process.exit(0);
      });
      break;
      
    case 'dashboard':
      monitor.generateDashboard().then(path => {
        console.log(`Dashboard generated: ${path}`);
        process.exit(0);
      });
      break;
      
    default:
      console.log(`
Railway Monitoring System

Usage:
  node railway-monitoring.js start [url]     - Start monitoring
  node railway-monitoring.js status [url]    - Get current status
  node railway-monitoring.js dashboard [url] - Generate dashboard

Examples:
  node railway-monitoring.js start
  node railway-monitoring.js start https://your-app.up.railway.app
  node railway-monitoring.js dashboard
      `);
      process.exit(1);
  }
}

module.exports = RailwayMonitor;