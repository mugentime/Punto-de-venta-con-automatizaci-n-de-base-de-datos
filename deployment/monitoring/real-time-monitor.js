#!/usr/bin/env node

/**
 * Real-Time Railway Deployment Monitor
 * Continuous monitoring with adaptive alerting
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class RealTimeDeploymentMonitor {
    constructor() {
        this.config = {
            checkInterval: 15000, // 15 seconds
            healthEndpoints: [
                '/api/health',
                '/api/status',
                '/'
            ],
            alertThresholds: {
                responseTime: 3000,
                errorRate: 0.1,
                memoryUsage: 0.85,
                cpuUsage: 0.8
            },
            retryLimit: 3
        };
        
        this.metrics = {
            uptime: 0,
            responseTime: [],
            errorCount: 0,
            successCount: 0,
            memoryUsage: [],
            alerts: []
        };
        
        this.isMonitoring = false;
        this.serviceUrl = null;
    }
    
    /**
     * Start monitoring deployment
     */
    async startMonitoring() {
        console.log('📊 Starting real-time deployment monitoring');
        
        // Get Railway service information
        await this.getServiceInfo();
        
        this.isMonitoring = true;
        this.monitoringStartTime = Date.now();
        
        // Start monitoring loops
        this.healthMonitoringLoop();
        this.performanceMonitoringLoop();
        this.alertingLoop();
        
        console.log(`✅ Monitoring started for: ${this.serviceUrl}`);
    }
    
    /**
     * Get Railway service information
     */
    async getServiceInfo() {
        try {
            const result = await this.executeCommand('railway status --json');
            
            if (result.stdout) {
                const status = JSON.parse(result.stdout);
                this.serviceUrl = status.service?.url || 'https://pos-conejo-negro.railway.app';
                this.serviceName = status.service?.name || 'POS-CONEJONEGRO';
            } else {
                // Fallback to known URL
                this.serviceUrl = 'https://pos-conejo-negro.railway.app';
                this.serviceName = 'POS-CONEJONEGRO';
            }
            
            console.log(`🎯 Monitoring service: ${this.serviceName} at ${this.serviceUrl}`);
            
        } catch (error) {
            console.log('⚠️ Could not get Railway service info, using defaults');
            this.serviceUrl = 'https://pos-conejo-negro.railway.app';
            this.serviceName = 'POS-CONEJONEGRO';
        }
    }
    
    /**
     * Health monitoring loop
     */
    async healthMonitoringLoop() {
        while (this.isMonitoring) {
            try {
                await this.performHealthCheck();
                await this.sleep(this.config.checkInterval);
            } catch (error) {
                console.error('Health monitoring error:', error.message);
                await this.sleep(5000); // Short retry delay
            }
        }
    }
    
    /**
     * Performance monitoring loop
     */
    async performanceMonitoringLoop() {
        while (this.isMonitoring) {
            try {
                await this.collectPerformanceMetrics();
                await this.sleep(this.config.checkInterval * 2); // Less frequent
            } catch (error) {
                console.error('Performance monitoring error:', error.message);
            }
        }
    }
    
    /**
     * Alerting loop
     */
    async alertingLoop() {
        while (this.isMonitoring) {
            try {
                await this.checkAlerts();
                await this.generateReport();
                await this.sleep(this.config.checkInterval * 4); // Generate reports less frequently
            } catch (error) {
                console.error('Alerting error:', error.message);
            }
        }
    }
    
    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const startTime = Date.now();
        
        for (const endpoint of this.config.healthEndpoints) {
            try {
                const url = `${this.serviceUrl}${endpoint}`;
                const response = await this.fetchWithTimeout(url, 10000);
                
                const responseTime = Date.now() - startTime;
                this.metrics.responseTime.push(responseTime);
                
                if (response.ok) {
                    this.metrics.successCount++;
                    console.log(`✅ Health check passed: ${endpoint} (${responseTime}ms)`);
                } else {
                    this.metrics.errorCount++;
                    console.log(`❌ Health check failed: ${endpoint} - HTTP ${response.status}`);
                    
                    this.addAlert('health_check_failed', {
                        endpoint,
                        status: response.status,
                        responseTime
                    });
                }
                
                // Only check first successful endpoint
                if (response.ok) break;
                
            } catch (error) {
                this.metrics.errorCount++;
                console.log(`❌ Health check error: ${endpoint} - ${error.message}`);
                
                this.addAlert('health_check_error', {
                    endpoint,
                    error: error.message
                });
            }
        }
        
        // Keep only last 100 response times
        if (this.metrics.responseTime.length > 100) {
            this.metrics.responseTime = this.metrics.responseTime.slice(-100);
        }
    }
    
    /**
     * Collect performance metrics
     */
    async collectPerformanceMetrics() {
        try {
            // Get Railway service metrics if available
            const logs = await this.getRailwayLogs();
            const parsedMetrics = this.parseLogsForMetrics(logs);
            
            if (parsedMetrics.memoryUsage) {
                this.metrics.memoryUsage.push(parsedMetrics.memoryUsage);
            }
            
            // Keep only last 50 memory readings
            if (this.metrics.memoryUsage.length > 50) {
                this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-50);
            }
            
            console.log('📈 Performance metrics collected');
            
        } catch (error) {
            console.log('⚠️ Could not collect performance metrics:', error.message);
        }
    }
    
    /**
     * Get Railway service logs
     */
    async getRailwayLogs() {
        const result = await this.executeCommand('railway logs --limit 10');
        return result.stdout || '';
    }
    
    /**
     * Parse logs for performance metrics
     */
    parseLogsForMetrics(logs) {
        const metrics = {};
        
        // Look for memory usage patterns
        const memoryMatch = logs.match(/Memory usage: (\d+\.?\d*)%/);
        if (memoryMatch) {
            metrics.memoryUsage = parseFloat(memoryMatch[1]) / 100;
        }
        
        // Look for CPU usage patterns
        const cpuMatch = logs.match(/CPU usage: (\d+\.?\d*)%/);
        if (cpuMatch) {
            metrics.cpuUsage = parseFloat(cpuMatch[1]) / 100;
        }
        
        return metrics;
    }
    
    /**
     * Check for alert conditions
     */
    async checkAlerts() {
        // Check response time alerts
        if (this.metrics.responseTime.length > 0) {
            const avgResponseTime = this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length;
            
            if (avgResponseTime > this.config.alertThresholds.responseTime) {
                this.addAlert('high_response_time', {
                    average: avgResponseTime,
                    threshold: this.config.alertThresholds.responseTime
                });
            }
        }
        
        // Check error rate alerts
        const totalRequests = this.metrics.successCount + this.metrics.errorCount;
        if (totalRequests > 0) {
            const errorRate = this.metrics.errorCount / totalRequests;
            
            if (errorRate > this.config.alertThresholds.errorRate) {
                this.addAlert('high_error_rate', {
                    errorRate,
                    threshold: this.config.alertThresholds.errorRate,
                    totalRequests
                });
            }
        }
        
        // Check memory usage alerts
        if (this.metrics.memoryUsage.length > 0) {
            const latestMemoryUsage = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];
            
            if (latestMemoryUsage > this.config.alertThresholds.memoryUsage) {
                this.addAlert('high_memory_usage', {
                    usage: latestMemoryUsage,
                    threshold: this.config.alertThresholds.memoryUsage
                });
            }
        }
    }
    
    /**
     * Add alert to metrics
     */
    addAlert(type, data) {
        const alert = {
            type,
            timestamp: new Date().toISOString(),
            data,
            resolved: false
        };
        
        this.metrics.alerts.push(alert);
        console.log(`🚨 ALERT: ${type}`, data);
        
        // Keep only last 50 alerts
        if (this.metrics.alerts.length > 50) {
            this.metrics.alerts = this.metrics.alerts.slice(-50);
        }
    }
    
    /**
     * Generate monitoring report
     */
    async generateReport() {
        const uptime = Date.now() - this.monitoringStartTime;
        const totalRequests = this.metrics.successCount + this.metrics.errorCount;
        
        const report = {
            timestamp: new Date().toISOString(),
            service: {
                name: this.serviceName,
                url: this.serviceUrl
            },
            uptime: {
                milliseconds: uptime,
                human: this.formatDuration(uptime)
            },
            health: {
                totalRequests,
                successCount: this.metrics.successCount,
                errorCount: this.metrics.errorCount,
                successRate: totalRequests > 0 ? (this.metrics.successCount / totalRequests) : 0,
                errorRate: totalRequests > 0 ? (this.metrics.errorCount / totalRequests) : 0
            },
            performance: {
                averageResponseTime: this.metrics.responseTime.length > 0 
                    ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length 
                    : 0,
                minResponseTime: Math.min(...(this.metrics.responseTime.length > 0 ? this.metrics.responseTime : [0])),
                maxResponseTime: Math.max(...(this.metrics.responseTime.length > 0 ? this.metrics.responseTime : [0])),
                memoryUsage: this.metrics.memoryUsage.length > 0 
                    ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] 
                    : null
            },
            alerts: {
                total: this.metrics.alerts.length,
                active: this.metrics.alerts.filter(a => !a.resolved).length,
                recent: this.metrics.alerts.filter(a => 
                    Date.now() - new Date(a.timestamp).getTime() < 300000 // Last 5 minutes
                )
            }
        };
        
        // Save report to file
        const reportFile = `deployment/monitoring/monitoring-report-${Date.now()}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log('📋 Monitoring report generated:', reportFile);
        
        // Display summary
        console.log(`📊 Status Summary - Success Rate: ${(report.health.successRate * 100).toFixed(1)}%, Avg Response: ${report.performance.averageResponseTime.toFixed(0)}ms, Active Alerts: ${report.alerts.active}`);
        
        return report;
    }
    
    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    /**
     * Fetch with timeout
     */
    async fetchWithTimeout(url, timeout = 10000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Railway-Deployment-Monitor/1.0'
                }
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    /**
     * Execute command with promise
     */
    async executeCommand(command) {
        return new Promise((resolve) => {
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                resolve({
                    error: error?.message,
                    stdout: stdout || '',
                    stderr: stderr || ''
                });
            });
        });
    }
    
    /**
     * Sleep utility
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        console.log('🛑 Stopping deployment monitoring');
        this.isMonitoring = false;
    }
}

module.exports = RealTimeDeploymentMonitor;

// Run if called directly
if (require.main === module) {
    const monitor = new RealTimeDeploymentMonitor();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        monitor.stopMonitoring();
        process.exit(0);
    });
    
    monitor.startMonitoring().catch(error => {
        console.error('❌ Monitoring failed:', error.message);
        process.exit(1);
    });
}