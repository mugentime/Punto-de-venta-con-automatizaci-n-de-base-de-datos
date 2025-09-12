#!/usr/bin/env node
/**
 * @fileoverview Railway Deployment Monitor for POS Conejo Negro
 * @description Comprehensive monitoring system for Railway deployment health,
 *              performance metrics, and automated alerting
 * @author Production Infrastructure Team
 * @version 1.0.0
 */

const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const MONITOR_CONFIG = {
    // Application endpoints to monitor
    endpoints: [
        '/api/health',
        '/api/version',
        '/api/stats',
        '/',
        '/online'
    ],
    
    // Monitoring intervals (in milliseconds)
    healthCheckInterval: 30000,      // 30 seconds
    metricsCollectionInterval: 60000, // 1 minute  
    alertingInterval: 300000,        // 5 minutes
    
    // Thresholds for alerting
    thresholds: {
        responseTime: 5000,          // 5 seconds
        errorRate: 0.05,             // 5% error rate
        cpuUsage: 80,                // 80% CPU usage
        memoryUsage: 85,             // 85% Memory usage
        diskUsage: 90,               // 90% Disk usage
        uptimeRequired: 0.99         // 99% uptime requirement
    },
    
    // Railway configuration
    railway: {
        baseUrl: process.env.RAILWAY_PUBLIC_DOMAIN 
                 ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
                 : 'https://pos-conejonegro.railway.app',
        projectId: process.env.RAILWAY_PROJECT_ID || 'd395ae99-1dc9-4aae-96b6-0c805960665f',
        environment: process.env.RAILWAY_ENVIRONMENT || 'production'
    }
};

// Metrics storage
class MetricsStore {
    constructor() {
        this.metrics = {
            healthChecks: [],
            responseTime: [],
            errors: [],
            uptime: [],
            resources: []
        };
        this.startTime = Date.now();
    }
    
    // Add health check result
    addHealthCheck(result) {
        this.metrics.healthChecks.push({
            timestamp: Date.now(),
            ...result
        });
        
        // Keep only last 100 health checks
        if (this.metrics.healthChecks.length > 100) {
            this.metrics.healthChecks.shift();
        }
    }
    
    // Add response time measurement
    addResponseTime(endpoint, responseTime) {
        this.metrics.responseTime.push({
            timestamp: Date.now(),
            endpoint,
            responseTime
        });
        
        // Keep only last 200 measurements
        if (this.metrics.responseTime.length > 200) {
            this.metrics.responseTime.shift();
        }
    }
    
    // Add error record
    addError(error) {
        this.metrics.errors.push({
            timestamp: Date.now(),
            ...error
        });
        
        // Keep only last 50 errors
        if (this.metrics.errors.length > 50) {
            this.metrics.errors.shift();
        }
    }
    
    // Calculate current metrics
    getCurrentMetrics() {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Filter recent data (last hour)
        const recentHealthChecks = this.metrics.healthChecks.filter(
            h => now - h.timestamp < oneHour
        );
        const recentResponseTimes = this.metrics.responseTime.filter(
            r => now - r.timestamp < oneHour
        );
        const recentErrors = this.metrics.errors.filter(
            e => now - e.timestamp < oneHour
        );
        
        // Calculate averages and percentages
        const avgResponseTime = recentResponseTimes.length > 0
            ? recentResponseTimes.reduce((sum, r) => sum + r.responseTime, 0) / recentResponseTimes.length
            : 0;
            
        const successfulHealthChecks = recentHealthChecks.filter(h => h.healthy).length;
        const uptime = recentHealthChecks.length > 0 
            ? successfulHealthChecks / recentHealthChecks.length 
            : 1;
            
        const errorRate = recentHealthChecks.length > 0
            ? recentErrors.length / recentHealthChecks.length
            : 0;
        
        return {
            uptime: uptime * 100,
            avgResponseTime,
            errorRate: errorRate * 100,
            totalHealthChecks: recentHealthChecks.length,
            totalErrors: recentErrors.length,
            monitoringDuration: now - this.startTime,
            lastUpdated: new Date().toISOString()
        };
    }
    
    // Export metrics to file
    async exportMetrics() {
        const metricsPath = path.join(__dirname, '..', 'logs', 'railway-metrics.json');
        const currentMetrics = this.getCurrentMetrics();
        
        try {
            await fs.mkdir(path.dirname(metricsPath), { recursive: true });
            await fs.writeFile(metricsPath, JSON.stringify({
                summary: currentMetrics,
                rawData: this.metrics,
                config: MONITOR_CONFIG
            }, null, 2));
            
            console.log('📊 Metrics exported to:', metricsPath);
        } catch (error) {
            console.error('❌ Failed to export metrics:', error.message);
        }
    }
}

// HTTP request helper with timeout
function makeRequest(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const req = https.get(url, { timeout }, (res) => {
            let data = '';
            
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                
                resolve({
                    statusCode: res.statusCode,
                    data: data,
                    responseTime,
                    headers: res.headers
                });
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        req.on('error', reject);
    });
}

// Health check implementation
class HealthChecker {
    constructor(metricsStore) {
        this.metrics = metricsStore;
    }
    
    async checkEndpoint(endpoint) {
        const url = `${MONITOR_CONFIG.railway.baseUrl}${endpoint}`;
        
        try {
            const response = await makeRequest(url, MONITOR_CONFIG.thresholds.responseTime);
            this.metrics.addResponseTime(endpoint, response.responseTime);
            
            // Parse response for additional health info
            let healthData = {};
            if (endpoint === '/api/health') {
                try {
                    healthData = JSON.parse(response.data);
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }
            
            const isHealthy = response.statusCode >= 200 && response.statusCode < 400;
            
            if (isHealthy) {
                console.log(`✅ ${endpoint}: OK (${response.responseTime}ms)`);
            } else {
                console.log(`❌ ${endpoint}: ERROR ${response.statusCode} (${response.responseTime}ms)`);
                this.metrics.addError({
                    endpoint,
                    statusCode: response.statusCode,
                    responseTime: response.responseTime,
                    error: 'HTTP Error'
                });
            }
            
            return {
                endpoint,
                healthy: isHealthy,
                statusCode: response.statusCode,
                responseTime: response.responseTime,
                ...healthData
            };
            
        } catch (error) {
            console.log(`❌ ${endpoint}: ${error.message}`);
            
            this.metrics.addError({
                endpoint,
                error: error.message,
                type: 'connection_error'
            });
            
            return {
                endpoint,
                healthy: false,
                error: error.message,
                responseTime: -1
            };
        }
    }
    
    async performHealthCheck() {
        console.log(`🏥 Starting health check at ${new Date().toISOString()}`);
        
        const results = await Promise.all(
            MONITOR_CONFIG.endpoints.map(endpoint => this.checkEndpoint(endpoint))
        );
        
        const healthyEndpoints = results.filter(r => r.healthy).length;
        const totalEndpoints = results.length;
        const overallHealth = healthyEndpoints / totalEndpoints;
        
        const healthResult = {
            healthy: overallHealth >= 0.8, // 80% of endpoints must be healthy
            healthyEndpoints,
            totalEndpoints,
            overallHealth: overallHealth * 100,
            results
        };
        
        this.metrics.addHealthCheck(healthResult);
        
        console.log(`📊 Health check complete: ${healthyEndpoints}/${totalEndpoints} endpoints healthy`);
        
        return healthResult;
    }
}

// Alert system
class AlertSystem {
    constructor(metricsStore) {
        this.metrics = metricsStore;
        this.lastAlertTime = 0;
        this.alertCooldown = 300000; // 5 minutes
    }
    
    shouldSendAlert(currentMetrics) {
        const now = Date.now();
        
        // Check cooldown period
        if (now - this.lastAlertTime < this.alertCooldown) {
            return false;
        }
        
        // Check thresholds
        const alerts = [];
        
        if (currentMetrics.uptime < (MONITOR_CONFIG.thresholds.uptimeRequired * 100)) {
            alerts.push(`Low uptime: ${currentMetrics.uptime.toFixed(2)}%`);
        }
        
        if (currentMetrics.avgResponseTime > MONITOR_CONFIG.thresholds.responseTime) {
            alerts.push(`High response time: ${currentMetrics.avgResponseTime.toFixed(0)}ms`);
        }
        
        if (currentMetrics.errorRate > (MONITOR_CONFIG.thresholds.errorRate * 100)) {
            alerts.push(`High error rate: ${currentMetrics.errorRate.toFixed(2)}%`);
        }
        
        if (alerts.length > 0) {
            this.sendAlert(alerts);
            this.lastAlertTime = now;
            return true;
        }
        
        return false;
    }
    
    sendAlert(alerts) {
        const alertMessage = `
🚨 RAILWAY DEPLOYMENT ALERT - POS Conejo Negro

Alerts triggered:
${alerts.map(alert => `• ${alert}`).join('\\n')}

Deployment: ${MONITOR_CONFIG.railway.baseUrl}
Environment: ${MONITOR_CONFIG.railway.environment}
Time: ${new Date().toISOString()}

Please investigate immediately.
        `;
        
        console.log(alertMessage);
        
        // In production, you would send this to:
        // - Slack webhook
        // - Email notification
        // - SMS alert
        // - PagerDuty
        
        // For now, save to alert log
        this.saveAlertLog(alertMessage);
    }
    
    async saveAlertLog(alertMessage) {
        const alertsPath = path.join(__dirname, '..', 'logs', 'railway-alerts.log');
        
        try {
            await fs.mkdir(path.dirname(alertsPath), { recursive: true });
            await fs.appendFile(alertsPath, `${new Date().toISOString()} - ${alertMessage}\\n\\n`);
        } catch (error) {
            console.error('❌ Failed to save alert log:', error.message);
        }
    }
}

// Dashboard generator
class DashboardGenerator {
    constructor(metricsStore) {
        this.metrics = metricsStore;
    }
    
    generateDashboardHTML() {
        const currentMetrics = this.metrics.getCurrentMetrics();
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Deployment Monitor - POS Conejo Negro</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .status-good { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
        .timestamp { color: #666; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚄 Railway Deployment Monitor</h1>
            <h2>POS Conejo Negro - Production Health Dashboard</h2>
            <p class="timestamp">Last updated: ${currentMetrics.lastUpdated}</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value ${currentMetrics.uptime >= 99 ? 'status-good' : currentMetrics.uptime >= 95 ? 'status-warning' : 'status-error'}">${currentMetrics.uptime.toFixed(2)}%</div>
                <div class="metric-label">Uptime (Last Hour)</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value ${currentMetrics.avgResponseTime <= 1000 ? 'status-good' : currentMetrics.avgResponseTime <= 3000 ? 'status-warning' : 'status-error'}">${currentMetrics.avgResponseTime.toFixed(0)}ms</div>
                <div class="metric-label">Average Response Time</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value ${currentMetrics.errorRate <= 1 ? 'status-good' : currentMetrics.errorRate <= 5 ? 'status-warning' : 'status-error'}">${currentMetrics.errorRate.toFixed(2)}%</div>
                <div class="metric-label">Error Rate</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value status-good">${currentMetrics.totalHealthChecks}</div>
                <div class="metric-label">Health Checks (Last Hour)</div>
            </div>
        </div>
        
        <div class="metric-card" style="margin-top: 20px;">
            <h3>🔗 Monitored Endpoints</h3>
            <ul>
                ${MONITOR_CONFIG.endpoints.map(endpoint => 
                    `<li><a href="${MONITOR_CONFIG.railway.baseUrl}${endpoint}" target="_blank">${endpoint}</a></li>`
                ).join('')}
            </ul>
        </div>
        
        <div class="metric-card" style="margin-top: 20px;">
            <h3>⚙️ Configuration</h3>
            <p><strong>Base URL:</strong> ${MONITOR_CONFIG.railway.baseUrl}</p>
            <p><strong>Environment:</strong> ${MONITOR_CONFIG.railway.environment}</p>
            <p><strong>Project ID:</strong> ${MONITOR_CONFIG.railway.projectId}</p>
            <p><strong>Monitoring Duration:</strong> ${Math.round(currentMetrics.monitoringDuration / 60000)} minutes</p>
        </div>
    </div>
    
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>
        `;
    }
    
    async saveDashboard() {
        const dashboardPath = path.join(__dirname, '..', 'public', 'railway-monitor.html');
        const html = this.generateDashboardHTML();
        
        try {
            await fs.mkdir(path.dirname(dashboardPath), { recursive: true });
            await fs.writeFile(dashboardPath, html);
            console.log('📊 Dashboard saved to:', dashboardPath);
        } catch (error) {
            console.error('❌ Failed to save dashboard:', error.message);
        }
    }
}

// Main monitor class
class RailwayMonitor {
    constructor() {
        this.metrics = new MetricsStore();
        this.healthChecker = new HealthChecker(this.metrics);
        this.alertSystem = new AlertSystem(this.metrics);
        this.dashboard = new DashboardGenerator(this.metrics);
        
        this.isRunning = false;
    }
    
    start() {
        if (this.isRunning) {
            console.log('⚠️ Monitor is already running');
            return;
        }
        
        this.isRunning = true;
        console.log('🚀 Starting Railway deployment monitor...');
        console.log(`📍 Monitoring: ${MONITOR_CONFIG.railway.baseUrl}`);
        
        // Start monitoring loops
        this.startHealthCheckLoop();
        this.startMetricsLoop();
        this.startAlertingLoop();
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }
    
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        console.log('\\n🛑 Stopping Railway deployment monitor...');
        
        // Save final metrics and dashboard
        await this.metrics.exportMetrics();
        await this.dashboard.saveDashboard();
        
        console.log('✅ Monitor stopped gracefully');
        process.exit(0);
    }
    
    startHealthCheckLoop() {
        const runHealthCheck = async () => {
            if (!this.isRunning) return;
            
            try {
                await this.healthChecker.performHealthCheck();
            } catch (error) {
                console.error('❌ Health check error:', error.message);
            }
            
            if (this.isRunning) {
                setTimeout(runHealthCheck, MONITOR_CONFIG.healthCheckInterval);
            }
        };
        
        runHealthCheck();
    }
    
    startMetricsLoop() {
        const runMetricsCollection = async () => {
            if (!this.isRunning) return;
            
            try {
                await this.metrics.exportMetrics();
                await this.dashboard.saveDashboard();
            } catch (error) {
                console.error('❌ Metrics collection error:', error.message);
            }
            
            if (this.isRunning) {
                setTimeout(runMetricsCollection, MONITOR_CONFIG.metricsCollectionInterval);
            }
        };
        
        setTimeout(runMetricsCollection, MONITOR_CONFIG.metricsCollectionInterval);
    }
    
    startAlertingLoop() {
        const runAlerting = async () => {
            if (!this.isRunning) return;
            
            try {
                const currentMetrics = this.metrics.getCurrentMetrics();
                this.alertSystem.shouldSendAlert(currentMetrics);
            } catch (error) {
                console.error('❌ Alerting error:', error.message);
            }
            
            if (this.isRunning) {
                setTimeout(runAlerting, MONITOR_CONFIG.alertingInterval);
            }
        };
        
        setTimeout(runAlerting, MONITOR_CONFIG.alertingInterval);
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            const monitor = new RailwayMonitor();
            monitor.start();
            break;
            
        case 'check':
            const healthChecker = new HealthChecker(new MetricsStore());
            healthChecker.performHealthCheck()
                .then(result => {
                    console.log('\\nHealth Check Result:', JSON.stringify(result, null, 2));
                    process.exit(result.healthy ? 0 : 1);
                })
                .catch(error => {
                    console.error('Health check failed:', error.message);
                    process.exit(1);
                });
            break;
            
        case 'dashboard':
            const dashboardGen = new DashboardGenerator(new MetricsStore());
            dashboardGen.saveDashboard()
                .then(() => {
                    console.log('✅ Dashboard generated successfully');
                    process.exit(0);
                })
                .catch(error => {
                    console.error('Dashboard generation failed:', error.message);
                    process.exit(1);
                });
            break;
            
        default:
            console.log(`
Railway Deployment Monitor - POS Conejo Negro

Usage:
  node monitor-railway.js start     Start continuous monitoring
  node monitor-railway.js check     Run single health check
  node monitor-railway.js dashboard Generate dashboard

Environment Variables:
  RAILWAY_PUBLIC_DOMAIN    Your Railway app domain
  RAILWAY_PROJECT_ID       Your Railway project ID
  RAILWAY_ENVIRONMENT      Environment name (default: production)
            `);
            process.exit(1);
    }
}

module.exports = { RailwayMonitor, HealthChecker, MetricsStore, AlertSystem };