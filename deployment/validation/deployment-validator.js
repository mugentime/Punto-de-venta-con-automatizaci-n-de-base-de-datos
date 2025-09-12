#!/usr/bin/env node

/**
 * Railway Deployment Validator
 * Comprehensive validation with rollback capabilities
 */

const { exec } = require('child_process');
const fs = require('fs').promises;

class DeploymentValidator {
    constructor() {
        this.config = {
            validationTimeout: 300000, // 5 minutes
            healthCheckRetries: 5,
            performanceThresholds: {
                maxResponseTime: 3000,
                minSuccessRate: 0.95,
                maxErrorRate: 0.05
            },
            rollbackTriggers: {
                healthCheckFailures: 3,
                criticalErrors: ['ECONNREFUSED', 'timeout', '5xx'],
                performanceDegradation: 0.3
            }
        };
        
        this.validationResults = {
            startTime: Date.now(),
            tests: [],
            metrics: {},
            status: 'running',
            recommendations: []
        };
        
        this.serviceUrl = null;
        this.previousDeploymentMetrics = null;
    }
    
    /**
     * Execute comprehensive deployment validation
     */
    async validateDeployment() {
        console.log('🔍 Starting comprehensive deployment validation');
        
        try {
            // Load previous metrics for comparison
            await this.loadPreviousMetrics();
            
            // Get current service information
            await this.getServiceInfo();
            
            // Execute validation test suite
            await this.runValidationSuite();
            
            // Analyze results and make recommendations
            await this.analyzeResults();
            
            // Generate final report
            const report = await this.generateValidationReport();
            
            console.log('✅ Deployment validation completed');
            return report;
            
        } catch (error) {
            console.error('❌ Validation failed:', error.message);
            
            this.validationResults.status = 'failed';
            this.validationResults.error = error.message;
            
            // Check if rollback is needed
            if (await this.shouldRollback(error)) {
                await this.initiateRollback();
            }
            
            throw error;
        }
    }
    
    /**
     * Load previous deployment metrics for comparison
     */
    async loadPreviousMetrics() {
        try {
            const files = await fs.readdir('deployment/monitoring');
            const metricFiles = files
                .filter(f => f.startsWith('monitoring-report-'))
                .sort()
                .slice(-5); // Get last 5 reports
            
            if (metricFiles.length > 0) {
                const latestFile = `deployment/monitoring/${metricFiles[metricFiles.length - 1]}`;
                const content = await fs.readFile(latestFile, 'utf8');
                this.previousDeploymentMetrics = JSON.parse(content);
                console.log('📊 Previous metrics loaded for comparison');
            }
        } catch (error) {
            console.log('⚠️ No previous metrics found for comparison');
        }
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
                this.serviceUrl = 'https://pos-conejo-negro.railway.app';
                this.serviceName = 'POS-CONEJONEGRO';
            }
            
            console.log(`🎯 Validating service: ${this.serviceName} at ${this.serviceUrl}`);
            
        } catch (error) {
            this.serviceUrl = 'https://pos-conejo-negro.railway.app';
            this.serviceName = 'POS-CONEJONEGRO';
        }
    }
    
    /**
     * Run comprehensive validation suite
     */
    async runValidationSuite() {
        const tests = [
            { name: 'Service Availability', fn: this.testServiceAvailability },
            { name: 'Health Endpoint', fn: this.testHealthEndpoint },
            { name: 'API Functionality', fn: this.testApiFunctionality },
            { name: 'Authentication System', fn: this.testAuthenticationSystem },
            { name: 'Database Connectivity', fn: this.testDatabaseConnectivity },
            { name: 'Performance Metrics', fn: this.testPerformanceMetrics },
            { name: 'Security Headers', fn: this.testSecurityHeaders },
            { name: 'Error Handling', fn: this.testErrorHandling }
        ];
        
        for (const test of tests) {
            console.log(`🧪 Running test: ${test.name}`);
            
            const testResult = {
                name: test.name,
                startTime: Date.now(),
                status: 'running'
            };
            
            try {
                const result = await test.fn.call(this);
                testResult.status = result.success ? 'passed' : 'failed';
                testResult.result = result;
                testResult.duration = Date.now() - testResult.startTime;
                
                if (result.success) {
                    console.log(`✅ ${test.name}: PASSED`);
                } else {
                    console.log(`❌ ${test.name}: FAILED - ${result.error}`);
                }
                
            } catch (error) {
                testResult.status = 'error';
                testResult.error = error.message;
                testResult.duration = Date.now() - testResult.startTime;
                
                console.log(`💥 ${test.name}: ERROR - ${error.message}`);
            }
            
            this.validationResults.tests.push(testResult);
        }
    }
    
    /**
     * Test service availability
     */
    async testServiceAvailability() {
        try {
            const response = await this.fetchWithTimeout(this.serviceUrl, 10000);
            
            return {
                success: response.ok,
                status: response.status,
                responseTime: response.responseTime,
                error: response.ok ? null : `HTTP ${response.status}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Test health endpoint
     */
    async testHealthEndpoint() {
        try {
            const response = await this.fetchWithTimeout(`${this.serviceUrl}/api/health`, 10000);
            
            if (!response.ok) {
                return {
                    success: false,
                    error: `Health endpoint returned HTTP ${response.status}`
                };
            }
            
            const healthData = await response.json().catch(() => ({}));
            
            return {
                success: true,
                status: response.status,
                healthData,
                responseTime: response.responseTime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Test API functionality
     */
    async testApiFunctionality() {
        const endpoints = [
            '/api/status',
            '/api/health'
        ];
        
        const results = [];
        
        for (const endpoint of endpoints) {
            try {
                const response = await this.fetchWithTimeout(`${this.serviceUrl}${endpoint}`, 10000);
                results.push({
                    endpoint,
                    success: response.ok,
                    status: response.status,
                    responseTime: response.responseTime
                });
            } catch (error) {
                results.push({
                    endpoint,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successfulEndpoints = results.filter(r => r.success).length;
        const successRate = successfulEndpoints / results.length;
        
        return {
            success: successRate >= 0.8, // 80% of endpoints should work
            successRate,
            results,
            error: successRate < 0.8 ? `Only ${successfulEndpoints}/${results.length} endpoints working` : null
        };
    }
    
    /**
     * Test authentication system
     */
    async testAuthenticationSystem() {
        try {
            // Test login endpoint accessibility (without credentials)
            const response = await this.fetchWithTimeout(`${this.serviceUrl}/api/login`, 10000);
            
            // Should return 400 or 401, not 500 or connection error
            const validStatusCodes = [400, 401, 405]; // Bad request, unauthorized, method not allowed
            
            return {
                success: validStatusCodes.includes(response.status),
                status: response.status,
                error: validStatusCodes.includes(response.status) ? null : `Unexpected status: ${response.status}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Test database connectivity
     */
    async testDatabaseConnectivity() {
        try {
            // Test an endpoint that requires database access
            const response = await this.fetchWithTimeout(`${this.serviceUrl}/api/health`, 10000);
            
            if (!response.ok) {
                return {
                    success: false,
                    error: `Database health check failed: HTTP ${response.status}`
                };
            }
            
            const healthData = await response.json().catch(() => ({}));
            
            // Check if health data includes database status
            const dbConnected = healthData.database !== false && 
                              !healthData.error && 
                              healthData.status !== 'error';
            
            return {
                success: dbConnected,
                healthData,
                error: dbConnected ? null : 'Database connectivity issues detected'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Test performance metrics
     */
    async testPerformanceMetrics() {
        const performanceTests = [];
        
        // Run multiple requests to measure performance
        for (let i = 0; i < 5; i++) {
            const startTime = Date.now();
            try {
                const response = await this.fetchWithTimeout(`${this.serviceUrl}/api/health`, 10000);
                const responseTime = Date.now() - startTime;
                
                performanceTests.push({
                    success: response.ok,
                    responseTime,
                    status: response.status
                });
            } catch (error) {
                performanceTests.push({
                    success: false,
                    responseTime: Date.now() - startTime,
                    error: error.message
                });
            }
        }
        
        const successfulTests = performanceTests.filter(t => t.success);
        const avgResponseTime = successfulTests.length > 0 
            ? successfulTests.reduce((sum, t) => sum + t.responseTime, 0) / successfulTests.length 
            : 0;
        
        const successRate = successfulTests.length / performanceTests.length;
        
        const performancePassed = avgResponseTime <= this.config.performanceThresholds.maxResponseTime &&
                                 successRate >= this.config.performanceThresholds.minSuccessRate;
        
        return {
            success: performancePassed,
            avgResponseTime,
            successRate,
            tests: performanceTests,
            error: performancePassed ? null : `Performance below threshold: ${avgResponseTime}ms avg, ${(successRate * 100).toFixed(1)}% success rate`
        };
    }
    
    /**
     * Test security headers
     */
    async testSecurityHeaders() {
        try {
            const response = await this.fetchWithTimeout(this.serviceUrl, 10000);
            
            const securityHeaders = [
                'x-frame-options',
                'x-content-type-options',
                'x-xss-protection',
                'strict-transport-security'
            ];
            
            const presentHeaders = securityHeaders.filter(header => 
                response.headers.get(header)
            );
            
            const securityScore = presentHeaders.length / securityHeaders.length;
            
            return {
                success: securityScore >= 0.5, // At least 50% of security headers present
                securityScore,
                presentHeaders,
                missingHeaders: securityHeaders.filter(h => !presentHeaders.includes(h)),
                error: securityScore < 0.5 ? 'Insufficient security headers' : null
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Test error handling
     */
    async testErrorHandling() {
        try {
            // Test a non-existent endpoint
            const response = await this.fetchWithTimeout(`${this.serviceUrl}/api/nonexistent`, 10000);
            
            // Should return 404, not 500
            const validErrorHandling = response.status === 404;
            
            return {
                success: validErrorHandling,
                status: response.status,
                error: validErrorHandling ? null : `Poor error handling: status ${response.status}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Analyze validation results
     */
    async analyzeResults() {
        const totalTests = this.validationResults.tests.length;
        const passedTests = this.validationResults.tests.filter(t => t.status === 'passed').length;
        const failedTests = this.validationResults.tests.filter(t => t.status === 'failed').length;
        const errorTests = this.validationResults.tests.filter(t => t.status === 'error').length;
        
        const successRate = passedTests / totalTests;
        
        this.validationResults.metrics = {
            totalTests,
            passedTests,
            failedTests,
            errorTests,
            successRate,
            validationDuration: Date.now() - this.validationResults.startTime
        };
        
        // Determine overall status
        if (successRate >= 0.9) {
            this.validationResults.status = 'excellent';
        } else if (successRate >= 0.8) {
            this.validationResults.status = 'good';
        } else if (successRate >= 0.6) {
            this.validationResults.status = 'warning';
        } else {
            this.validationResults.status = 'critical';
        }
        
        // Generate recommendations
        this.generateRecommendations();
        
        console.log(`📊 Validation Summary: ${passedTests}/${totalTests} tests passed (${(successRate * 100).toFixed(1)}%)`);
    }
    
    /**
     * Generate recommendations based on results
     */
    generateRecommendations() {
        const failedTests = this.validationResults.tests.filter(t => t.status === 'failed' || t.status === 'error');
        
        for (const test of failedTests) {
            switch (test.name) {
                case 'Service Availability':
                    this.validationResults.recommendations.push({
                        priority: 'critical',
                        message: 'Service is not accessible. Check Railway deployment status and domain configuration.'
                    });
                    break;
                    
                case 'Health Endpoint':
                    this.validationResults.recommendations.push({
                        priority: 'high',
                        message: 'Health endpoint failing. Verify application startup and database connections.'
                    });
                    break;
                    
                case 'Performance Metrics':
                    this.validationResults.recommendations.push({
                        priority: 'medium',
                        message: 'Performance below expectations. Consider optimizing database queries and response caching.'
                    });
                    break;
                    
                case 'Security Headers':
                    this.validationResults.recommendations.push({
                        priority: 'medium',
                        message: 'Security headers missing. Implement Helmet.js or equivalent security middleware.'
                    });
                    break;
            }
        }
        
        // Add performance comparison if previous metrics available
        if (this.previousDeploymentMetrics) {
            const performanceTest = this.validationResults.tests.find(t => t.name === 'Performance Metrics');
            if (performanceTest && performanceTest.result) {
                const currentAvgResponse = performanceTest.result.avgResponseTime;
                const previousAvgResponse = this.previousDeploymentMetrics.performance.averageResponseTime;
                
                if (currentAvgResponse > previousAvgResponse * 1.2) { // 20% slower
                    this.validationResults.recommendations.push({
                        priority: 'high',
                        message: `Performance degraded by ${((currentAvgResponse / previousAvgResponse - 1) * 100).toFixed(1)}% compared to previous deployment.`
                    });
                }
            }
        }
    }
    
    /**
     * Generate comprehensive validation report
     */
    async generateValidationReport() {
        const report = {
            timestamp: new Date().toISOString(),
            service: {
                name: this.serviceName,
                url: this.serviceUrl
            },
            validation: this.validationResults,
            summary: {
                status: this.validationResults.status,
                successRate: this.validationResults.metrics.successRate,
                totalDuration: this.validationResults.metrics.validationDuration,
                criticalIssues: this.validationResults.recommendations.filter(r => r.priority === 'critical').length,
                recommendations: this.validationResults.recommendations.length
            }
        };
        
        // Save report
        const reportFile = `deployment/validation/validation-report-${Date.now()}.json`;
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
        
        console.log('📋 Validation report saved:', reportFile);
        
        return report;
    }
    
    /**
     * Check if rollback should be initiated
     */
    async shouldRollback(error) {
        const criticalTests = ['Service Availability', 'Health Endpoint', 'Database Connectivity'];
        const failedCriticalTests = this.validationResults.tests.filter(
            t => criticalTests.includes(t.name) && (t.status === 'failed' || t.status === 'error')
        );
        
        // Rollback if critical tests failed
        if (failedCriticalTests.length > 0) {
            console.log('🚨 Critical tests failed, rollback recommended');
            return true;
        }
        
        // Rollback if success rate too low
        if (this.validationResults.metrics.successRate < 0.5) {
            console.log('🚨 Success rate too low, rollback recommended');
            return true;
        }
        
        return false;
    }
    
    /**
     * Initiate rollback procedures
     */
    async initiateRollback() {
        console.log('🔄 Initiating deployment rollback');
        
        try {
            const result = await this.executeCommand('railway rollback');
            
            if (result.error) {
                console.error('❌ Rollback failed:', result.error);
            } else {
                console.log('✅ Rollback completed successfully');
                
                // Wait for rollback to take effect
                await this.sleep(30000);
                
                // Validate rollback was successful
                await this.validateRollback();
            }
        } catch (error) {
            console.error('❌ Rollback error:', error.message);
        }
    }
    
    /**
     * Validate rollback was successful
     */
    async validateRollback() {
        console.log('🔍 Validating rollback success');
        
        try {
            const response = await this.fetchWithTimeout(`${this.serviceUrl}/api/health`, 10000);
            
            if (response.ok) {
                console.log('✅ Rollback validation passed - service is healthy');
            } else {
                console.log('⚠️ Rollback validation warning - service status unclear');
            }
        } catch (error) {
            console.log('❌ Rollback validation failed - service still unhealthy');
        }
    }
    
    /**
     * Fetch with timeout and response time tracking
     */
    async fetchWithTimeout(url, timeout = 10000) {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Railway-Deployment-Validator/1.0'
                }
            });
            
            clearTimeout(timeoutId);
            response.responseTime = Date.now() - startTime;
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
            exec(command, { timeout: 60000 }, (error, stdout, stderr) => {
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
}

module.exports = DeploymentValidator;

// Run if called directly
if (require.main === module) {
    const validator = new DeploymentValidator();
    
    validator.validateDeployment()
        .then(report => {
            console.log('🎉 Validation completed successfully');
            console.log(`Status: ${report.summary.status}`);
            console.log(`Success Rate: ${(report.summary.successRate * 100).toFixed(1)}%`);
            
            if (report.summary.criticalIssues > 0) {
                console.log(`⚠️ Critical Issues: ${report.summary.criticalIssues}`);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Validation failed:', error.message);
            process.exit(1);
        });
}