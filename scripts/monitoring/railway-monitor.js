#!/usr/bin/env node

/**
 * Railway Deployment Monitor
 * Monitors POS Conejo Negro deployment status and health
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { URL } = require('url');

class RailwayMonitor {
    constructor(config = {}) {
        this.config = {
            appUrl: 'https://pos-conejonegro-production.up.railway.app',
            healthEndpoint: '/api/health',
            checkInterval: 60000, // 1 minute
            timeout: 10000, // 10 seconds
            retries: 3,
            logDir: path.join(__dirname, '../../logs/monitoring'),
            dataDir: path.join(__dirname, '../../logs/monitoring/data'),
            alertThreshold: 3, // consecutive failures before alert
            ...config
        };
        
        this.status = {
            isHealthy: false,
            lastCheck: null,
            consecutiveFailures: 0,
            uptime: 0,
            totalChecks: 0,
            successfulChecks: 0
        };
        
        this.alerts = [];
        this.isRunning = false;
        this.intervalId = null;
    }

    async init() {
        // Create directories
        await this.ensureDirectories();
        
        // Load previous status if exists
        await this.loadStatus();
        
        console.log(`🚀 Railway Monitor initialized for: ${this.config.appUrl}`);
        console.log(`📊 Check interval: ${this.config.checkInterval / 1000}s`);
        console.log(`⏰ Timeout: ${this.config.timeout / 1000}s`);
    }

    async ensureDirectories() {
        const dirs = [this.config.logDir, this.config.dataDir];
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                console.error(`❌ Failed to create directory ${dir}:`, error.message);
            }
        }
    }

    async loadStatus() {
        try {
            const statusPath = path.join(this.config.dataDir, 'status.json');
            const data = await fs.readFile(statusPath, 'utf8');
            this.status = { ...this.status, ...JSON.parse(data) };
            console.log(`📈 Loaded previous status: ${this.status.totalChecks} total checks`);
        } catch (error) {
            console.log('📊 No previous status found, starting fresh');
        }
    }

    async saveStatus() {
        try {
            const statusPath = path.join(this.config.dataDir, 'status.json');
            await fs.writeFile(statusPath, JSON.stringify(this.status, null, 2));
        } catch (error) {
            console.error('❌ Failed to save status:', error.message);
        }
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const requestOptions = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: options.method || 'GET',
                timeout: this.config.timeout,
                headers: {
                    'User-Agent': 'Railway-Monitor/1.0',
                    'Accept': 'application/json',
                    ...options.headers
                }
            };

            const req = protocol.request(requestOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data,
                        responseTime: Date.now() - startTime
                    });
                });
            });

            const startTime = Date.now();
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout after ${this.config.timeout}ms`));
            });

            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }

    async checkHealth() {
        const checkTime = new Date();
        let result = {
            timestamp: checkTime.toISOString(),
            url: this.config.appUrl + this.config.healthEndpoint,
            success: false,
            statusCode: null,
            responseTime: null,
            error: null,
            healthData: null
        };

        try {
            console.log(`🔍 Checking health: ${result.url}`);
            
            const response = await this.makeRequest(result.url);
            result.statusCode = response.statusCode;
            result.responseTime = response.responseTime;
            
            if (response.statusCode === 200) {
                try {
                    result.healthData = JSON.parse(response.body);
                    result.success = true;
                    console.log(`✅ Health check passed (${response.responseTime}ms)`);
                } catch (parseError) {
                    result.error = 'Invalid JSON response';
                    console.log(`⚠️  Health endpoint returned non-JSON: ${response.statusCode}`);
                }
            } else {
                result.error = `HTTP ${response.statusCode}`;
                console.log(`❌ Health check failed: HTTP ${response.statusCode}`);
            }
        } catch (error) {
            result.error = error.message;
            console.log(`❌ Health check failed: ${error.message}`);
        }

        return result;
    }

    async checkDeploymentStatus() {
        const checkTime = new Date();
        let result = {
            timestamp: checkTime.toISOString(),
            url: this.config.appUrl,
            success: false,
            statusCode: null,
            responseTime: null,
            error: null,
            isDeployed: false
        };

        try {
            console.log(`🔍 Checking deployment: ${result.url}`);
            
            const response = await this.makeRequest(result.url);
            result.statusCode = response.statusCode;
            result.responseTime = response.responseTime;
            
            if (response.statusCode >= 200 && response.statusCode < 500) {
                result.success = true;
                result.isDeployed = true;
                console.log(`✅ Deployment accessible (${response.responseTime}ms)`);
            } else {
                result.error = `HTTP ${response.statusCode}`;
                console.log(`❌ Deployment check failed: HTTP ${response.statusCode}`);
            }
        } catch (error) {
            result.error = error.message;
            console.log(`❌ Deployment check failed: ${error.message}`);
        }

        return result;
    }

    async performHealthCheck() {
        const timestamp = new Date();
        console.log(`\n🕐 ${timestamp.toLocaleString()} - Starting health check #${this.status.totalChecks + 1}`);
        
        // Check both deployment and health
        const [deploymentResult, healthResult] = await Promise.all([
            this.checkDeploymentStatus(),
            this.checkHealth()
        ]);

        const overallSuccess = deploymentResult.success && (healthResult.success || healthResult.statusCode === 404);
        
        // Update status
        this.status.lastCheck = timestamp.toISOString();
        this.status.totalChecks++;
        
        if (overallSuccess) {
            this.status.isHealthy = true;
            this.status.consecutiveFailures = 0;
            this.status.successfulChecks++;
            this.status.uptime = Math.round((this.status.successfulChecks / this.status.totalChecks) * 100);
        } else {
            this.status.isHealthy = false;
            this.status.consecutiveFailures++;
        }

        // Check for alert condition
        if (this.status.consecutiveFailures >= this.config.alertThreshold) {
            await this.triggerAlert('consecutive_failures', {
                failures: this.status.consecutiveFailures,
                deploymentError: deploymentResult.error,
                healthError: healthResult.error
            });
        }

        // Log results
        await this.logResults({ deploymentResult, healthResult, overallSuccess });
        
        // Save status
        await this.saveStatus();
        
        console.log(`📊 Status: ${overallSuccess ? '✅ HEALTHY' : '❌ UNHEALTHY'} | Uptime: ${this.status.uptime}%`);
        
        return { deploymentResult, healthResult, overallSuccess };
    }

    async logResults(results) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            status: this.status,
            ...results
        };

        // Log to daily file
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.config.logDir, `health-${today}.json`);
        
        try {
            let existingData = [];
            try {
                const existing = await fs.readFile(logFile, 'utf8');
                existingData = JSON.parse(existing);
            } catch (error) {
                // File doesn't exist, start fresh
            }
            
            existingData.push(logEntry);
            await fs.writeFile(logFile, JSON.stringify(existingData, null, 2));
        } catch (error) {
            console.error('❌ Failed to write log:', error.message);
        }

        // Also append to main log file
        const mainLogFile = path.join(this.config.logDir, 'monitoring.log');
        const logLine = `${logEntry.timestamp} [${results.overallSuccess ? 'SUCCESS' : 'FAILURE'}] Deployment: ${results.deploymentResult.statusCode || 'ERROR'} | Health: ${results.healthResult.statusCode || 'ERROR'}\n`;
        
        try {
            await fs.appendFile(mainLogFile, logLine);
        } catch (error) {
            console.error('❌ Failed to append to main log:', error.message);
        }
    }

    async triggerAlert(type, details) {
        const alert = {
            id: Date.now().toString(),
            type,
            timestamp: new Date().toISOString(),
            details,
            resolved: false
        };

        // Avoid duplicate alerts
        const recentAlert = this.alerts.find(a => 
            a.type === type && 
            !a.resolved && 
            (Date.now() - new Date(a.timestamp).getTime()) < 300000 // 5 minutes
        );

        if (recentAlert) return;

        this.alerts.push(alert);
        console.log(`🚨 ALERT [${type.toUpperCase()}]:`, details);

        // Save alert to file
        const alertFile = path.join(this.config.logDir, 'alerts.json');
        try {
            await fs.writeFile(alertFile, JSON.stringify(this.alerts, null, 2));
        } catch (error) {
            console.error('❌ Failed to save alert:', error.message);
        }

        // Call alert handlers
        await this.handleAlert(alert);
    }

    async handleAlert(alert) {
        // Log alert to console with formatting
        console.log('\n' + '='.repeat(80));
        console.log(`🚨 DEPLOYMENT ALERT - ${alert.type.toUpperCase()}`);
        console.log(`⏰ Time: ${new Date(alert.timestamp).toLocaleString()}`);
        console.log(`📊 Details:`, alert.details);
        console.log('='.repeat(80) + '\n');

        // Write to alert log file
        const alertLogFile = path.join(this.config.logDir, 'alert.log');
        const alertLine = `${alert.timestamp} [${alert.type.toUpperCase()}] ${JSON.stringify(alert.details)}\n`;
        
        try {
            await fs.appendFile(alertLogFile, alertLine);
        } catch (error) {
            console.error('❌ Failed to write alert log:', error.message);
        }
    }

    async generateReport() {
        const report = {
            generatedAt: new Date().toISOString(),
            status: this.status,
            config: {
                appUrl: this.config.appUrl,
                checkInterval: this.config.checkInterval,
                alertThreshold: this.config.alertThreshold
            },
            recentAlerts: this.alerts.slice(-10),
            summary: {
                uptimePercentage: this.status.uptime,
                totalChecks: this.status.totalChecks,
                successfulChecks: this.status.successfulChecks,
                failedChecks: this.status.totalChecks - this.status.successfulChecks,
                currentStreak: this.status.consecutiveFailures === 0 ? 
                    this.status.successfulChecks : -this.status.consecutiveFailures
            }
        };

        const reportFile = path.join(this.config.dataDir, 'latest-report.json');
        try {
            await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
            console.log(`📋 Report generated: ${reportFile}`);
        } catch (error) {
            console.error('❌ Failed to generate report:', error.message);
        }

        return report;
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️  Monitor is already running');
            return;
        }

        this.isRunning = true;
        console.log(`🚀 Starting Railway monitor...`);
        
        // Perform initial check
        this.performHealthCheck();
        
        // Set up interval
        this.intervalId = setInterval(() => {
            this.performHealthCheck();
        }, this.config.checkInterval);
        
        // Generate reports every hour
        setInterval(() => {
            this.generateReport();
        }, 3600000);

        console.log(`✅ Monitor started successfully`);
    }

    stop() {
        if (!this.isRunning) {
            console.log('⚠️  Monitor is not running');
            return;
        }

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        console.log(`🛑 Monitor stopped`);
    }

    async getStatus() {
        return {
            isRunning: this.isRunning,
            status: this.status,
            lastReport: await this.generateReport()
        };
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new RailwayMonitor();
    
    async function start() {
        await monitor.init();
        monitor.start();
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down monitor...');
            monitor.stop();
            await monitor.generateReport();
            console.log('👋 Goodbye!');
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            monitor.stop();
            await monitor.generateReport();
            process.exit(0);
        });
    }
    
    start().catch(console.error);
}

module.exports = RailwayMonitor;