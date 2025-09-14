#!/usr/bin/env node

/**
 * Railway API Monitoring and Status Detection Tool
 * Monitors Railway deployment endpoints to detect API placeholder issues
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class RailwayAPIMonitor {
    constructor() {
        this.railwayUrl = 'https://pos-conejonegro-production.up.railway.app';
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.monitoringInterval = 30000; // 30 seconds
        this.logFile = path.join(__dirname, '../tests/railway-api-monitor.log');
        this.statusFile = path.join(__dirname, '../tests/railway-api-status.json');
        this.alertThreshold = 3; // Number of consecutive failures before alert
        this.consecutiveFailures = 0;
        this.isRunning = false;
    }

    async log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        
        console.log(`${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️'} ${message}`);
        
        // Ensure tests directory exists
        const testsDir = path.dirname(this.logFile);
        if (!fs.existsSync(testsDir)) {
            fs.mkdirSync(testsDir, { recursive: true });
        }
        
        fs.appendFileSync(this.logFile, logEntry);
    }

    async makeHttpRequest(url, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                timeout: timeout,
                headers: {
                    'User-Agent': 'Railway-API-Monitor/1.0.0'
                }
            }, (response) => {
                let data = '';
                
                response.on('data', chunk => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: data,
                        responseTime: Date.now() - startTime
                    });
                });
            });
            
            const startTime = Date.now();
            
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
            
            request.on('error', reject);
        });
    }

    detectApiPlaceholder(response) {
        const body = response.body.toLowerCase();
        const indicators = [
            'api is working',
            '{"message":"api is working"}',
            'api placeholder',
            'default api response',
            'railway placeholder',
            'service not available'
        ];
        
        return indicators.some(indicator => body.includes(indicator));
    }

    detectPosApplication(response) {
        const body = response.body.toLowerCase();
        const posIndicators = [
            'conejo negro',
            'pos system',
            'point of sale',
            'dashboard',
            'login',
            'authentication',
            'products',
            'records'
        ];
        
        return posIndicators.some(indicator => body.includes(indicator));
    }

    async checkEndpoint(endpoint = '') {
        const url = `${this.railwayUrl}${endpoint}`;
        
        try {
            const response = await this.makeHttpRequest(url);
            
            const isApiPlaceholder = this.detectApiPlaceholder(response);
            const isPosApplication = this.detectPosApplication(response);
            
            return {
                success: true,
                url: url,
                statusCode: response.statusCode,
                responseTime: response.responseTime,
                bodySize: response.body.length,
                isApiPlaceholder,
                isPosApplication,
                isHealthy: !isApiPlaceholder && (response.statusCode < 400 || endpoint.includes('api')),
                headers: {
                    server: response.headers.server,
                    contentType: response.headers['content-type'],
                    contentLength: response.headers['content-length']
                }
            };
        } catch (error) {
            return {
                success: false,
                url: url,
                error: error.message,
                isHealthy: false
            };
        }
    }

    async performHealthCheck() {
        this.log('🏥 Performing comprehensive health check...');
        
        const endpoints = [
            '',              // Root endpoint
            '/api/health',   // Health endpoint
            '/api/status',   // Status endpoint
            '/api/version',  // Version endpoint
            '/online'        // Online POS interface
        ];
        
        const results = {
            timestamp: new Date().toISOString(),
            overall: {
                healthy: true,
                issues: []
            },
            endpoints: {}
        };
        
        for (const endpoint of endpoints) {
            const result = await this.checkEndpoint(endpoint);
            results.endpoints[endpoint || 'root'] = result;
            
            if (!result.isHealthy) {
                results.overall.healthy = false;
            }
            
            if (result.isApiPlaceholder) {
                results.overall.issues.push(`API placeholder detected at ${endpoint || 'root'}`);
                this.log(`🚨 API placeholder detected at: ${result.url}`, 'error');
            } else if (result.isPosApplication) {
                this.log(`✅ POS application detected at: ${result.url}`);
            }
            
            if (result.success) {
                this.log(`✅ ${endpoint || 'root'}: ${result.statusCode} (${result.responseTime}ms)`);
            } else {
                this.log(`❌ ${endpoint || 'root'}: ${result.error}`, 'error');
            }
        }
        
        // Update consecutive failures counter
        if (!results.overall.healthy) {
            this.consecutiveFailures++;
            this.log(`⚠️ Consecutive failures: ${this.consecutiveFailures}`, 'warn');
        } else {
            this.consecutiveFailures = 0;
        }
        
        // Check if alert threshold reached
        if (this.consecutiveFailures >= this.alertThreshold) {
            this.log(`🚨 ALERT: ${this.consecutiveFailures} consecutive failures detected!`, 'error');
            await this.generateAlert(results);
        }
        
        // Save status to file
        fs.writeFileSync(this.statusFile, JSON.stringify(results, null, 2));
        
        return results;
    }

    async generateAlert(healthCheckResults) {
        const alertData = {
            timestamp: new Date().toISOString(),
            alertType: 'CONSECUTIVE_FAILURES',
            consecutiveFailures: this.consecutiveFailures,
            threshold: this.alertThreshold,
            projectId: this.projectId,
            railwayUrl: this.railwayUrl,
            issues: healthCheckResults.overall.issues,
            lastResults: healthCheckResults
        };
        
        const alertFile = path.join(__dirname, '../tests/railway-alert.json');
        fs.writeFileSync(alertFile, JSON.stringify(alertData, null, 2));
        
        this.log(`🚨 Alert generated: ${alertFile}`, 'error');
        
        // Could integrate with external alerting systems here
        // e.g., email, Slack, webhook, etc.
    }

    async generateDailyReport() {
        this.log('📊 Generating daily monitoring report...');
        
        const reportData = {
            date: new Date().toISOString().split('T')[0],
            projectId: this.projectId,
            railwayUrl: this.railwayUrl,
            monitoringConfig: {
                interval: this.monitoringInterval,
                alertThreshold: this.alertThreshold
            },
            currentStatus: {
                consecutiveFailures: this.consecutiveFailures,
                lastCheck: new Date().toISOString()
            },
            recommendations: []
        };
        
        // Add recommendations based on current status
        if (this.consecutiveFailures > 0) {
            reportData.recommendations.push('Investigate deployment configuration');
            reportData.recommendations.push('Check Railway build logs for errors');
            reportData.recommendations.push('Verify Dockerfile and railway.json settings');
        }
        
        const reportFile = path.join(__dirname, '../tests/railway-daily-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        
        this.log(`📊 Daily report saved: ${reportFile}`);
    }

    async start() {
        if (this.isRunning) {
            this.log('⚠️ Monitor is already running', 'warn');
            return;
        }
        
        this.isRunning = true;
        this.log('🚀 Starting Railway API Monitor...');
        this.log(`Monitoring URL: ${this.railwayUrl}`);
        this.log(`Check interval: ${this.monitoringInterval / 1000} seconds`);
        this.log(`Alert threshold: ${this.alertThreshold} consecutive failures`);
        
        // Initial health check
        await this.performHealthCheck();
        
        // Set up recurring health checks
        const intervalId = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(intervalId);
                return;
            }
            
            try {
                await this.performHealthCheck();
            } catch (error) {
                this.log(`❌ Health check error: ${error.message}`, 'error');
            }
        }, this.monitoringInterval);
        
        // Set up daily report generation (at midnight)
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();
        
        setTimeout(() => {
            this.generateDailyReport();
            // Then every 24 hours
            setInterval(() => this.generateDailyReport(), 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
        
        this.log('✅ Railway API Monitor started successfully');
        this.log('Press Ctrl+C to stop monitoring');
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.stop();
        });
        
        process.on('SIGTERM', () => {
            this.stop();
        });
    }

    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.log('🛑 Stopping Railway API Monitor...');
        this.generateDailyReport();
        this.log('✅ Monitor stopped');
        process.exit(0);
    }

    async runSingleCheck() {
        this.log('🔍 Running single health check...');
        const results = await this.performHealthCheck();
        
        console.log('\n📊 HEALTH CHECK SUMMARY:');
        console.log(`Overall Status: ${results.overall.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`Issues Found: ${results.overall.issues.length}`);
        
        if (results.overall.issues.length > 0) {
            console.log('\n🚨 Issues:');
            results.overall.issues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        console.log(`\nDetailed results saved to: ${this.statusFile}`);
        return results;
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new RailwayAPIMonitor();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            monitor.start();
            break;
        case 'check':
            monitor.runSingleCheck().then(() => process.exit(0));
            break;
        default:
            console.log('Railway API Monitor');
            console.log('Usage:');
            console.log('  node railway-api-monitor.js start  - Start continuous monitoring');
            console.log('  node railway-api-monitor.js check  - Run single health check');
            process.exit(1);
    }
}

module.exports = RailwayAPIMonitor;