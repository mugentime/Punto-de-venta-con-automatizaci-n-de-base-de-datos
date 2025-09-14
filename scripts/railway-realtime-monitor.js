#!/usr/bin/env node

/**
 * @fileoverview Railway Real-time Deployment Monitor
 * @description Real-time monitoring and API testing for Railway deployment fed11c6d-a65a-4d93-90e6-955e16b6753f
 * @version 1.0.0
 * @author TaskMaster Monitoring Agent
 * @created 2025-01-15
 */

const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class RailwayRealtimeMonitor {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.baseUrl = `https://${this.projectId}.railway.app`;
        this.apiUrl = 'https://backboard.railway.app/graphql';
        
        this.healthEndpoints = [
            '/api/health',
            '/api/status',
            '/api/version',
            '/api/emergency-test',
            '/api/debug/env'
        ];
        
        this.checkInterval = 15000; // 15 seconds
        this.isRunning = false;
        this.checks = [];
        this.alerts = [];
        this.startTime = Date.now();
        
        this.thresholds = {
            responseTime: 5000,    // 5 seconds
            errorRate: 0.1,        // 10%
            consecutiveFailures: 3  // 3 consecutive failures triggers alert
        };
    }

    /**
     * Start Real-time Monitoring
     */
    async startMonitoring() {
        console.log('🔍 RAILWAY REAL-TIME MONITOR STARTING');
        console.log('====================================');
        console.log(`📊 Project ID: ${this.projectId}`);
        console.log(`🌐 Base URL: ${this.baseUrl}`);
        console.log(`⏱️  Check interval: ${this.checkInterval / 1000}s`);
        console.log(`🎯 Monitoring ${this.healthEndpoints.length} endpoints`);
        console.log('\n📋 Health Endpoints:');
        this.healthEndpoints.forEach((endpoint, i) => {
            console.log(`  ${i + 1}. ${endpoint}`);
        });
        console.log('\n🚨 Alert Thresholds:');
        console.log(`  - Response time: ${this.thresholds.responseTime}ms`);
        console.log(`  - Error rate: ${this.thresholds.errorRate * 100}%`);
        console.log(`  - Consecutive failures: ${this.thresholds.consecutiveFailures}`);
        console.log('\n🔄 Starting continuous monitoring...\n');

        this.isRunning = true;
        
        // Start monitoring loop
        while (this.isRunning) {
            await this.performComprehensiveCheck();
            await this.checkForAlerts();
            await this.saveMonitoringReport();
            await this.sleep(this.checkInterval);
        }
    }

    /**
     * Perform Comprehensive Health Check
     */
    async performComprehensiveCheck() {
        const timestamp = new Date().toISOString();
        const checkId = `check_${Date.now()}`;
        
        console.log(`\n🏥 Health Check #${this.checks.length + 1} at ${timestamp}`);
        console.log('=' + '='.repeat(70));
        
        const checkResult = {
            id: checkId,
            timestamp,
            uptime: Date.now() - this.startTime,
            endpoints: {},
            summary: {
                total: this.healthEndpoints.length,
                success: 0,
                failed: 0,
                avgResponseTime: 0,
                totalResponseTime: 0
            },
            railwayStatus: null,
            networkTest: null
        };

        // Test all health endpoints
        for (const endpoint of this.healthEndpoints) {
            try {
                const result = await this.testEndpoint(endpoint);
                checkResult.endpoints[endpoint] = result;
                checkResult.summary.totalResponseTime += result.responseTime;
                
                if (result.success) {
                    checkResult.summary.success++;
                    console.log(`✅ ${endpoint.padEnd(20)} HTTP ${result.status} (${result.responseTime}ms)`);
                    
                    // Show response snippet for key endpoints
                    if (endpoint === '/api/health' && result.data) {
                        try {
                            const healthData = JSON.parse(result.data);
                            console.log(`   📊 Status: ${healthData.status}, DB: ${healthData.isDatabaseReady ? 'Ready' : 'Not Ready'}`);
                        } catch (e) {
                            console.log(`   📄 Response: ${result.data.substring(0, 50)}...`);
                        }
                    }
                } else {
                    checkResult.summary.failed++;
                    console.log(`❌ ${endpoint.padEnd(20)} ${result.error || 'Failed'} (${result.responseTime}ms)`);
                }
            } catch (error) {
                checkResult.endpoints[endpoint] = {
                    success: false,
                    error: error.message,
                    responseTime: -1
                };
                checkResult.summary.failed++;
                console.log(`❌ ${endpoint.padEnd(20)} ${error.message}`);
            }
        }

        // Calculate average response time
        if (checkResult.summary.success > 0) {
            checkResult.summary.avgResponseTime = Math.round(
                checkResult.summary.totalResponseTime / checkResult.summary.success
            );
        }

        // Test Railway CLI status
        checkResult.railwayStatus = await this.checkRailwayStatus();
        if (checkResult.railwayStatus.available) {
            console.log(`🚂 Railway CLI: ${checkResult.railwayStatus.status}`);
        }

        // Network connectivity test
        checkResult.networkTest = await this.testNetworkConnectivity();
        console.log(`🌐 Network: ${checkResult.networkTest.status}`);

        // Display summary
        const successRate = ((checkResult.summary.success / checkResult.summary.total) * 100).toFixed(1);
        console.log(`\n📊 Summary: ${checkResult.summary.success}/${checkResult.summary.total} success (${successRate}%)`);
        console.log(`⏱️  Avg response: ${checkResult.summary.avgResponseTime}ms`);
        console.log(`🕐 Uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s`);
        
        this.checks.push(checkResult);
    }

    /**
     * Test Individual Endpoint
     */
    async testEndpoint(endpoint) {
        const url = `${this.baseUrl}${endpoint}`;
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const requestModule = url.startsWith('https:') ? https : http;
            
            const req = requestModule.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Railway-Monitor/1.0',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            }, (res) => {
                const responseTime = Date.now() - startTime;
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        success: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        responseTime,
                        contentLength: data.length,
                        data: data.length < 1000 ? data : data.substring(0, 500) + '...',
                        headers: {
                            'content-type': res.headers['content-type'],
                            'x-request-id': res.headers['x-request-id']
                        }
                    });
                });
            });
            
            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timeout (10s)',
                    responseTime: Date.now() - startTime
                });
            });
            
            req.on('error', (error) => {
                resolve({
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - startTime
                });
            });
        });
    }

    /**
     * Check Railway CLI Status
     */
    async checkRailwayStatus() {
        try {
            const { stdout: version } = await execAsync('railway --version', { timeout: 5000 });
            const { stdout: whoami } = await execAsync('railway whoami', { timeout: 5000 });
            const { stdout: status } = await execAsync('railway status', { timeout: 5000 });
            
            return {
                available: true,
                version: version.trim(),
                user: whoami.trim(),
                status: status.trim().split('\n')[0] // First line usually contains status
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    /**
     * Test Network Connectivity
     */
    async testNetworkConnectivity() {
        const testUrls = [
            'https://railway.app',
            'https://api.railway.app',
            'https://1.1.1.1' // Cloudflare DNS for general connectivity
        ];

        let successful = 0;
        
        for (const url of testUrls) {
            try {
                const result = await this.testEndpoint(url.replace(this.baseUrl, ''));
                if (result.success || result.status < 500) {
                    successful++;
                }
            } catch (error) {
                // Ignore individual failures
            }
        }

        return {
            status: successful >= 2 ? 'Good' : successful >= 1 ? 'Limited' : 'Poor',
            successful,
            total: testUrls.length
        };
    }

    /**
     * Check for Alerts and Issues
     */
    async checkForAlerts() {
        if (this.checks.length < 2) return;

        const recentChecks = this.checks.slice(-5); // Last 5 checks
        const latestCheck = this.checks[this.checks.length - 1];
        
        // Check for consecutive failures
        const consecutiveFailures = this.getConsecutiveFailures();
        if (consecutiveFailures >= this.thresholds.consecutiveFailures) {
            this.createAlert('consecutive_failures', `${consecutiveFailures} consecutive failures detected`);
        }
        
        // Check response time
        if (latestCheck.summary.avgResponseTime > this.thresholds.responseTime) {
            this.createAlert('slow_response', `Average response time ${latestCheck.summary.avgResponseTime}ms exceeds threshold`);
        }
        
        // Check error rate
        const errorRate = latestCheck.summary.failed / latestCheck.summary.total;
        if (errorRate > this.thresholds.errorRate) {
            this.createAlert('high_error_rate', `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold`);
        }
        
        // Check for recovery
        if (consecutiveFailures === 0 && this.alerts.length > 0) {
            console.log('🎉 RECOVERY: Service appears to be healthy again');
            this.alerts = []; // Clear alerts on recovery
        }
    }

    /**
     * Get Number of Consecutive Failures
     */
    getConsecutiveFailures() {
        let failures = 0;
        for (let i = this.checks.length - 1; i >= 0; i--) {
            if (this.checks[i].summary.failed > 0) {
                failures++;
            } else {
                break;
            }
        }
        return failures;
    }

    /**
     * Create Alert
     */
    createAlert(type, message) {
        const alert = {
            type,
            message,
            timestamp: new Date().toISOString(),
            acknowledged: false
        };
        
        // Prevent duplicate alerts
        const existingAlert = this.alerts.find(a => a.type === type && !a.acknowledged);
        if (!existingAlert) {
            this.alerts.push(alert);
            console.log(`\n🚨 ALERT [${type.toUpperCase()}]: ${message}`);
        }
    }

    /**
     * Save Monitoring Report
     */
    async saveMonitoringReport() {
        const report = {
            monitoring: {
                projectId: this.projectId,
                baseUrl: this.baseUrl,
                startTime: new Date(this.startTime).toISOString(),
                uptime: Date.now() - this.startTime,
                totalChecks: this.checks.length,
                checkInterval: this.checkInterval,
                lastUpdate: new Date().toISOString()
            },
            summary: this.generateSummaryStats(),
            alerts: this.alerts,
            recentChecks: this.checks.slice(-10), // Last 10 checks
            thresholds: this.thresholds
        };

        const reportPath = path.join('C:\\Users\\je2al\\Desktop\\POS-CONEJONEGRO', 'reports', 'railway-realtime-monitoring.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }

    /**
     * Generate Summary Statistics
     */
    generateSummaryStats() {
        if (this.checks.length === 0) return {};

        const recentChecks = this.checks.slice(-20); // Last 20 checks
        const totalEndpointTests = recentChecks.length * this.healthEndpoints.length;
        let totalSuccessful = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        recentChecks.forEach(check => {
            totalSuccessful += check.summary.success;
            if (check.summary.avgResponseTime > 0) {
                totalResponseTime += check.summary.avgResponseTime;
                responseTimeCount++;
            }
        });

        return {
            overallSuccessRate: ((totalSuccessful / totalEndpointTests) * 100).toFixed(1),
            avgResponseTime: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0,
            totalAlerts: this.alerts.length,
            activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
            consecutiveFailures: this.getConsecutiveFailures(),
            uptime: ((Date.now() - this.startTime) / 1000).toFixed(0) + 's'
        };
    }

    /**
     * Generate Status Report
     */
    async generateStatusReport() {
        const summary = this.generateSummaryStats();
        
        console.log('\n📊 MONITORING STATUS REPORT');
        console.log('==========================');
        console.log(`🕐 Uptime: ${summary.uptime}`);
        console.log(`📈 Success Rate: ${summary.overallSuccessRate}%`);
        console.log(`⏱️  Avg Response: ${summary.avgResponseTime}ms`);
        console.log(`📊 Total Checks: ${this.checks.length}`);
        console.log(`🚨 Active Alerts: ${summary.activeAlerts}`);
        
        if (this.alerts.length > 0) {
            console.log('\n🚨 Recent Alerts:');
            this.alerts.slice(-5).forEach(alert => {
                const status = alert.acknowledged ? '✅' : '❌';
                console.log(`  ${status} [${alert.type}] ${alert.message}`);
            });
        }
    }

    /**
     * Stop Monitoring
     */
    stop() {
        console.log('\n🛑 STOPPING RAILWAY MONITOR');
        this.isRunning = false;
        this.generateStatusReport();
    }

    /**
     * Utility: Sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    if (global.monitor) {
        global.monitor.stop();
    }
    setTimeout(() => process.exit(0), 2000);
});

// Command line usage
if (require.main === module) {
    const monitor = new RailwayRealtimeMonitor();
    global.monitor = monitor;
    
    console.log('🎯 Railway Real-time Monitor');
    console.log('Press Ctrl+C to stop monitoring\n');
    
    monitor.startMonitoring().catch(error => {
        console.error('❌ Monitoring failed:', error);
        process.exit(1);
    });
}

module.exports = { RailwayRealtimeMonitor };