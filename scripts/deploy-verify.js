#!/usr/bin/env node
/**
 * @fileoverview Railway Deployment Verification and Rollback Script
 * @description Comprehensive deployment verification with automatic rollback capabilities
 * @author Production Infrastructure Team  
 * @version 1.0.0
 */

const https = require('https');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Deployment verification configuration
const VERIFY_CONFIG = {
    // Railway deployment settings
    railway: {
        baseUrl: process.env.RAILWAY_PUBLIC_DOMAIN 
                 ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
                 : 'https://pos-conejonegro.railway.app',
        projectId: process.env.RAILWAY_PROJECT_ID || 'd395ae99-1dc9-4aae-96b6-0c805960665f',
        environment: process.env.RAILWAY_ENVIRONMENT || 'production'
    },
    
    // Verification tests configuration
    tests: {
        healthCheck: {
            endpoint: '/api/health',
            timeout: 30000,
            expectedStatus: 200,
            required: true
        },
        versionCheck: {
            endpoint: '/api/version',
            timeout: 10000, 
            expectedStatus: 200,
            required: true
        },
        authCheck: {
            endpoint: '/api/auth/verify',
            timeout: 15000,
            expectedStatus: [200, 401], // 401 is acceptable for auth endpoint
            required: false
        },
        staticAssets: {
            endpoint: '/',
            timeout: 10000,
            expectedStatus: 200,
            required: true
        },
        apiStats: {
            endpoint: '/api/stats',
            timeout: 15000,
            expectedStatus: [200, 401], // May require authentication
            required: false
        }
    },
    
    // Performance benchmarks
    performance: {
        maxResponseTime: 5000,
        maxMemoryUsage: 512, // MB
        minUptime: 99.0,     // Percentage
        maxErrorRate: 1.0    // Percentage
    },
    
    // Rollback settings
    rollback: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 5000,
        rollbackDelay: 10000
    }
};

// HTTP request helper with detailed response info
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const reqOptions = {
            timeout: options.timeout || 10000,
            ...options
        };
        
        const req = https.get(url, reqOptions, (res) => {
            let data = '';
            
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                
                resolve({
                    statusCode: res.statusCode,
                    data: data,
                    responseTime,
                    headers: res.headers,
                    url: url
                });
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${reqOptions.timeout}ms`));
        });
        
        req.on('error', reject);
    });
}

// Execute shell command with promise
function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Deployment verification test runner
class DeploymentVerifier {
    constructor() {
        this.results = {
            startTime: Date.now(),
            tests: {},
            performance: {},
            overall: {
                success: false,
                errors: [],
                warnings: []
            }
        };
    }
    
    // Run individual test
    async runTest(testName, testConfig) {
        const url = `${VERIFY_CONFIG.railway.baseUrl}${testConfig.endpoint}`;
        
        console.log(`🧪 Running test: ${testName}`);
        console.log(`   URL: ${url}`);
        
        try {
            const response = await makeRequest(url, { timeout: testConfig.timeout });
            
            // Check if status code is acceptable
            const expectedStatuses = Array.isArray(testConfig.expectedStatus) 
                ? testConfig.expectedStatus 
                : [testConfig.expectedStatus];
            
            const statusOk = expectedStatuses.includes(response.statusCode);
            const responseTimeOk = response.responseTime <= VERIFY_CONFIG.performance.maxResponseTime;
            
            const testResult = {
                success: statusOk && responseTimeOk,
                statusCode: response.statusCode,
                responseTime: response.responseTime,
                dataSize: response.data.length,
                required: testConfig.required,
                errors: [],
                warnings: []
            };
            
            // Analyze response
            if (!statusOk) {
                const error = `Unexpected status code: ${response.statusCode} (expected: ${expectedStatuses.join(' or ')})`;
                testResult.errors.push(error);
                if (testConfig.required) {
                    this.results.overall.errors.push(`${testName}: ${error}`);
                } else {
                    this.results.overall.warnings.push(`${testName}: ${error}`);
                }
            }
            
            if (!responseTimeOk) {
                const warning = `Slow response time: ${response.responseTime}ms (max: ${VERIFY_CONFIG.performance.maxResponseTime}ms)`;
                testResult.warnings.push(warning);
                this.results.overall.warnings.push(`${testName}: ${warning}`);
            }
            
            // Parse JSON response for additional info
            if (testName === 'healthCheck' && statusOk) {
                try {
                    const healthData = JSON.parse(response.data);
                    testResult.healthInfo = {
                        isDatabaseReady: healthData.isDatabaseReady,
                        uptime: healthData.uptime,
                        environment: healthData.environment
                    };
                } catch (e) {
                    testResult.warnings.push('Could not parse health check JSON');
                }
            }
            
            if (testName === 'versionCheck' && statusOk) {
                try {
                    const versionData = JSON.parse(response.data);
                    testResult.versionInfo = {
                        version: versionData.version,
                        commit: versionData.commit,
                        buildTime: versionData.buildTime
                    };
                } catch (e) {
                    testResult.warnings.push('Could not parse version JSON');
                }
            }
            
            this.results.tests[testName] = testResult;
            
            if (testResult.success) {
                console.log(`   ✅ PASS (${response.responseTime}ms, ${response.statusCode})`);
            } else {
                console.log(`   ❌ FAIL (${response.responseTime}ms, ${response.statusCode})`);
            }
            
            return testResult;
            
        } catch (error) {
            const testResult = {
                success: false,
                error: error.message,
                required: testConfig.required,
                errors: [error.message]
            };
            
            this.results.tests[testName] = testResult;
            
            if (testConfig.required) {
                this.results.overall.errors.push(`${testName}: ${error.message}`);
            } else {
                this.results.overall.warnings.push(`${testName}: ${error.message}`);
            }
            
            console.log(`   ❌ ERROR: ${error.message}`);
            return testResult;
        }
    }
    
    // Run all verification tests
    async runAllTests() {
        console.log('🚀 Starting deployment verification...');
        console.log(`📍 Target: ${VERIFY_CONFIG.railway.baseUrl}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Run tests sequentially to avoid overwhelming the server
        for (const [testName, testConfig] of Object.entries(VERIFY_CONFIG.tests)) {
            await this.runTest(testName, testConfig);
            // Small delay between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Calculate overall success
        const requiredTests = Object.entries(this.results.tests).filter(
            ([name, result]) => result.required
        );
        
        const passedRequiredTests = requiredTests.filter(
            ([name, result]) => result.success
        );
        
        this.results.overall.success = passedRequiredTests.length === requiredTests.length;
        this.results.endTime = Date.now();
        this.results.duration = this.results.endTime - this.results.startTime;
        
        return this.results;
    }
    
    // Generate verification report
    generateReport() {
        const report = {
            deployment: {
                url: VERIFY_CONFIG.railway.baseUrl,
                environment: VERIFY_CONFIG.railway.environment,
                timestamp: new Date().toISOString(),
                duration: `${this.results.duration}ms`
            },
            summary: {
                overall: this.results.overall.success ? 'PASS' : 'FAIL',
                totalTests: Object.keys(this.results.tests).length,
                passedTests: Object.values(this.results.tests).filter(t => t.success).length,
                failedTests: Object.values(this.results.tests).filter(t => !t.success).length,
                errors: this.results.overall.errors.length,
                warnings: this.results.overall.warnings.length
            },
            tests: this.results.tests,
            issues: {
                errors: this.results.overall.errors,
                warnings: this.results.overall.warnings
            }
        };
        
        return report;
    }
    
    // Save verification report
    async saveReport(report) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(__dirname, '..', 'logs', `deployment-verification-${timestamp}.json`);
        
        try {
            await fs.mkdir(path.dirname(reportPath), { recursive: true });
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📄 Verification report saved: ${reportPath}`);
        } catch (error) {
            console.error('❌ Failed to save verification report:', error.message);
        }
    }
}

// Rollback manager
class RollbackManager {
    constructor() {
        this.rollbackAttempts = 0;
    }
    
    async executeRollback() {
        if (!VERIFY_CONFIG.rollback.enabled) {
            console.log('⚠️ Rollback is disabled in configuration');
            return false;
        }
        
        this.rollbackAttempts++;
        
        if (this.rollbackAttempts > VERIFY_CONFIG.rollback.maxRetries) {
            console.log('❌ Maximum rollback attempts exceeded');
            return false;
        }
        
        console.log(`🔄 Attempting rollback (attempt ${this.rollbackAttempts}/${VERIFY_CONFIG.rollback.maxRetries})...`);
        
        try {
            // Check if Railway CLI is available
            const { stdout } = await execCommand('railway --version');
            console.log(`📡 Railway CLI version: ${stdout.trim()}`);
            
            // Attempt to rollback to previous deployment
            console.log('⏪ Rolling back to previous deployment...');
            await execCommand('railway rollback');
            
            // Wait for rollback to complete
            console.log(`⏳ Waiting ${VERIFY_CONFIG.rollback.rollbackDelay}ms for rollback to complete...`);
            await new Promise(resolve => setTimeout(resolve, VERIFY_CONFIG.rollback.rollbackDelay));
            
            // Verify rollback success
            console.log('🧪 Verifying rollback...');
            const verifier = new DeploymentVerifier();
            const rollbackResults = await verifier.runAllTests();
            
            if (rollbackResults.overall.success) {
                console.log('✅ Rollback successful - deployment is healthy');
                return true;
            } else {
                console.log('❌ Rollback verification failed');
                return false;
            }
            
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
            return false;
        }
    }
}

// Main deployment verification orchestrator
class DeploymentOrchestrator {
    constructor() {
        this.verifier = new DeploymentVerifier();
        this.rollbackManager = new RollbackManager();
    }
    
    async verify() {
        console.log('🎯 Railway Deployment Verification Starting...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Run verification tests
        const results = await this.verifier.runAllTests();
        const report = this.verifier.generateReport();
        
        // Save report
        await this.verifier.saveReport(report);
        
        // Display results
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 VERIFICATION RESULTS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (results.overall.success) {
            console.log('🎉 DEPLOYMENT SUCCESSFUL!');
            console.log(`✅ All ${report.summary.passedTests}/${report.summary.totalTests} critical tests passed`);
        } else {
            console.log('💥 DEPLOYMENT FAILED!');
            console.log(`❌ ${report.summary.failedTests}/${report.summary.totalTests} tests failed`);
        }
        
        console.log(`⏱️ Verification duration: ${results.duration}ms`);
        console.log(`🌐 Deployment URL: ${VERIFY_CONFIG.railway.baseUrl}`);
        
        if (report.issues.errors.length > 0) {
            console.log('\\n❌ ERRORS:');
            report.issues.errors.forEach(error => console.log(`   • ${error}`));
        }
        
        if (report.issues.warnings.length > 0) {
            console.log('\\n⚠️ WARNINGS:');
            report.issues.warnings.forEach(warning => console.log(`   • ${warning}`));
        }
        
        // Handle rollback if deployment failed
        if (!results.overall.success && VERIFY_CONFIG.rollback.enabled) {
            console.log('\\n🔄 DEPLOYMENT FAILED - INITIATING ROLLBACK');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const rollbackSuccess = await this.rollbackManager.executeRollback();
            
            if (rollbackSuccess) {
                console.log('✅ Rollback completed successfully');
                return { success: true, rollback: true };
            } else {
                console.log('❌ Rollback failed - manual intervention required');
                return { success: false, rollback: false };
            }
        }
        
        return { success: results.overall.success, rollback: false };
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'verify':
            const orchestrator = new DeploymentOrchestrator();
            orchestrator.verify()
                .then(result => {
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                    if (result.success) {
                        console.log('🎯 DEPLOYMENT VERIFICATION COMPLETED SUCCESSFULLY');
                        process.exit(0);
                    } else {
                        console.log('💥 DEPLOYMENT VERIFICATION FAILED');
                        process.exit(1);
                    }
                })
                .catch(error => {
                    console.error('💥 Verification process error:', error.message);
                    process.exit(1);
                });
            break;
            
        case 'rollback':
            const rollbackManager = new RollbackManager();
            rollbackManager.executeRollback()
                .then(success => {
                    if (success) {
                        console.log('✅ Manual rollback completed successfully');
                        process.exit(0);
                    } else {
                        console.log('❌ Manual rollback failed');
                        process.exit(1);
                    }
                })
                .catch(error => {
                    console.error('💥 Rollback error:', error.message);
                    process.exit(1);
                });
            break;
            
        default:
            console.log(`
Railway Deployment Verification & Rollback Tool

Usage:
  node deploy-verify.js verify     Run deployment verification
  node deploy-verify.js rollback   Manual rollback to previous version

Environment Variables:
  RAILWAY_PUBLIC_DOMAIN    Your Railway app domain
  RAILWAY_PROJECT_ID       Your Railway project ID  
  RAILWAY_ENVIRONMENT      Environment name (default: production)

Examples:
  # Verify current deployment
  node scripts/deploy-verify.js verify
  
  # Manual rollback
  node scripts/deploy-verify.js rollback
            `);
            process.exit(1);
    }
}

module.exports = { DeploymentVerifier, RollbackManager, DeploymentOrchestrator };