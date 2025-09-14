#!/usr/bin/env node

/**
 * Railway Deployment Verification and Troubleshooting Tool
 * Project ID: fed11c6d-a65a-4d93-90e6-955e16b6753f
 * 
 * This script provides comprehensive verification and troubleshooting
 * for Railway deployment issues including the persistent API placeholder problem.
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const util = require('util');

const execAsync = util.promisify(exec);

class RailwayVerificationTool {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.railwayUrl = 'https://pos-conejonegro-production.up.railway.app';
        this.logFile = path.join(__dirname, '../tests/railway-verification.log');
        this.reportFile = path.join(__dirname, '../tests/railway-verification-report.json');
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

    async makeHttpRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, {
                timeout: 30000,
                ...options
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
                        url: url
                    });
                });
            });
            
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
            
            request.on('error', reject);
        });
    }

    async checkRailwayStatus() {
        this.log('🚂 Checking Railway deployment status...');
        
        try {
            const { stdout } = await execAsync('railway status');
            this.log(`Railway Status Output:\n${stdout}`);
            return { success: true, output: stdout };
        } catch (error) {
            this.log(`Railway status check failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async checkRailwayLogs(lines = 100) {
        this.log('📜 Fetching Railway deployment logs...');
        
        try {
            const { stdout } = await execAsync(`railway logs -n ${lines}`);
            this.log(`Recent Railway Logs (${lines} lines):\n${stdout}`);
            return { success: true, logs: stdout };
        } catch (error) {
            this.log(`Failed to fetch Railway logs: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async checkHealthEndpoints() {
        this.log('🏥 Testing Railway health endpoints...');
        
        const endpoints = [
            '/api/health',
            '/api/status',
            '/api/version',
            '/api/emergency-test',
            '/api/build-info'
        ];

        const results = {};

        for (const endpoint of endpoints) {
            const url = `${this.railwayUrl}${endpoint}`;
            this.log(`Testing: ${url}`);
            
            try {
                const response = await this.makeHttpRequest(url);
                results[endpoint] = {
                    success: true,
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: response.body.substring(0, 500) + (response.body.length > 500 ? '...' : ''),
                    isApiPlaceholder: response.body.includes('API is working') || 
                                     response.body.includes('{"message":"API is working"}') ||
                                     response.statusCode === 404
                };
                
                if (results[endpoint].isApiPlaceholder) {
                    this.log(`❌ ${endpoint}: API placeholder detected!`, 'error');
                } else {
                    this.log(`✅ ${endpoint}: Proper response received`);
                }
            } catch (error) {
                results[endpoint] = {
                    success: false,
                    error: error.message
                };
                this.log(`❌ ${endpoint}: ${error.message}`, 'error');
            }
        }

        return results;
    }

    async checkRootEndpoint() {
        this.log('🌐 Testing Railway root endpoint...');
        
        try {
            const response = await this.makeHttpRequest(this.railwayUrl);
            const isApiPlaceholder = response.body.includes('API is working') || 
                                   response.body.includes('{"message":"API is working"}');
            
            if (isApiPlaceholder) {
                this.log('❌ CRITICAL: Railway is serving API placeholder instead of POS application!', 'error');
                this.log('Response body preview:', 'error');
                this.log(response.body.substring(0, 200), 'error');
            } else {
                this.log('✅ Railway is serving the correct application');
            }
            
            return {
                success: true,
                statusCode: response.statusCode,
                isApiPlaceholder,
                bodyLength: response.body.length,
                bodyPreview: response.body.substring(0, 500)
            };
        } catch (error) {
            this.log(`❌ Root endpoint test failed: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async checkRailwayConfiguration() {
        this.log('🔧 Checking Railway configuration files...');
        
        const configFiles = [
            'railway.json',
            'Dockerfile',
            'package.json'
        ];
        
        const configStatus = {};
        
        for (const file of configFiles) {
            const filePath = path.join(__dirname, '..', file);
            
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    configStatus[file] = {
                        exists: true,
                        content: file.endsWith('.json') ? JSON.parse(content) : content
                    };
                    this.log(`✅ ${file}: Found and valid`);
                } catch (error) {
                    configStatus[file] = {
                        exists: true,
                        error: error.message
                    };
                    this.log(`❌ ${file}: Found but invalid - ${error.message}`, 'error');
                }
            } else {
                configStatus[file] = { exists: false };
                this.log(`❌ ${file}: Not found`, 'error');
            }
        }
        
        return configStatus;
    }

    async checkEnvironmentVariables() {
        this.log('🌍 Checking Railway environment variables...');
        
        try {
            const { stdout } = await execAsync('railway variables');
            this.log('Environment variables checked successfully');
            
            // Extract key variables for verification
            const envVars = {
                hasJWT: stdout.includes('JWT_SECRET'),
                hasDBUrl: stdout.includes('DATABASE_URL'),
                hasNodeEnv: stdout.includes('NODE_ENV'),
                hasRailwayEnv: stdout.includes('RAILWAY_ENVIRONMENT'),
                rawOutput: stdout
            };
            
            return { success: true, variables: envVars };
        } catch (error) {
            this.log(`Failed to check environment variables: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async triggerRedeployment() {
        this.log('🔄 Attempting to trigger Railway redeployment...');
        
        try {
            // Create a simple trigger file
            const triggerFile = path.join(__dirname, '../railway-deploy-trigger.txt');
            const triggerContent = `Deployment trigger: ${new Date().toISOString()}`;
            fs.writeFileSync(triggerFile, triggerContent);
            
            // Commit and push to trigger redeployment
            await execAsync('git add railway-deploy-trigger.txt');
            await execAsync('git commit -m "trigger: Force Railway redeployment"');
            await execAsync('git push origin main');
            
            this.log('✅ Redeployment trigger committed and pushed');
            return { success: true, triggerFile };
        } catch (error) {
            this.log(`Failed to trigger redeployment: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async generateActionPlan(results) {
        this.log('📋 Generating action plan based on verification results...');
        
        const actionPlan = {
            criticalIssues: [],
            recommendations: [],
            nextSteps: []
        };
        
        // Check for API placeholder issue
        if (results.rootEndpoint?.isApiPlaceholder || 
            Object.values(results.healthEndpoints || {}).some(ep => ep.isApiPlaceholder)) {
            actionPlan.criticalIssues.push('Railway is serving API placeholder instead of POS application');
            actionPlan.recommendations.push('Check deployment build process and start command');
            actionPlan.recommendations.push('Verify railway.json configuration');
            actionPlan.recommendations.push('Review Dockerfile and build steps');
        }
        
        // Check configuration issues
        if (!results.configuration?.['railway.json']?.exists) {
            actionPlan.criticalIssues.push('railway.json configuration file missing');
            actionPlan.recommendations.push('Create proper railway.json with correct build and deploy configuration');
        }
        
        if (!results.configuration?.['Dockerfile']?.exists) {
            actionPlan.criticalIssues.push('Dockerfile missing');
            actionPlan.recommendations.push('Ensure Dockerfile is present and properly configured');
        }
        
        // Environment variable issues
        if (!results.environmentVariables?.variables?.hasJWT) {
            actionPlan.criticalIssues.push('JWT_SECRET environment variable missing');
            actionPlan.recommendations.push('Set JWT_SECRET in Railway environment variables');
        }
        
        // Next steps
        actionPlan.nextSteps = [
            'Review and fix configuration files',
            'Verify environment variables are properly set',
            'Test deployment with simplified configuration',
            'Monitor logs during deployment process',
            'Implement rollback procedure if needed'
        ];
        
        return actionPlan;
    }

    async generateReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            projectId: this.projectId,
            railwayUrl: this.railwayUrl,
            verification: results,
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                criticalIssues: 0
            }
        };
        
        // Calculate summary statistics
        Object.values(results).forEach(result => {
            if (typeof result === 'object' && result !== null) {
                if (result.success === true) report.summary.passedTests++;
                else if (result.success === false) report.summary.failedTests++;
                report.summary.totalTests++;
            }
        });
        
        if (results.rootEndpoint?.isApiPlaceholder) report.summary.criticalIssues++;
        
        // Write report to file
        fs.writeFileSync(this.reportFile, JSON.stringify(report, null, 2));
        this.log(`📊 Verification report saved to: ${this.reportFile}`);
        
        return report;
    }

    async run() {
        this.log('🚀 Starting Railway Deployment Verification...');
        this.log(`Project ID: ${this.projectId}`);
        this.log(`Railway URL: ${this.railwayUrl}`);
        
        const results = {};
        
        // Clear previous log file
        if (fs.existsSync(this.logFile)) {
            fs.unlinkSync(this.logFile);
        }
        
        try {
            // Step 1: Check Railway status
            results.railwayStatus = await this.checkRailwayStatus();
            
            // Step 2: Check logs
            results.railwayLogs = await this.checkRailwayLogs(50);
            
            // Step 3: Check configuration
            results.configuration = await this.checkRailwayConfiguration();
            
            // Step 4: Check environment variables
            results.environmentVariables = await this.checkEnvironmentVariables();
            
            // Step 5: Test endpoints
            results.healthEndpoints = await this.checkHealthEndpoints();
            results.rootEndpoint = await this.checkRootEndpoint();
            
            // Step 6: Generate action plan
            results.actionPlan = await this.generateActionPlan(results);
            
            // Step 7: Generate final report
            const report = await this.generateReport(results);
            
            // Display summary
            this.log('\n🔍 VERIFICATION SUMMARY:');
            this.log(`✅ Tests Passed: ${report.summary.passedTests}`);
            this.log(`❌ Tests Failed: ${report.summary.failedTests}`);
            this.log(`🚨 Critical Issues: ${report.summary.criticalIssues}`);
            
            if (report.summary.criticalIssues > 0) {
                this.log('\n🚨 CRITICAL ISSUES FOUND:');
                results.actionPlan.criticalIssues.forEach(issue => {
                    this.log(`  - ${issue}`, 'error');
                });
                
                this.log('\n💡 RECOMMENDATIONS:');
                results.actionPlan.recommendations.forEach(rec => {
                    this.log(`  - ${rec}`);
                });
            }
            
            this.log(`\n📊 Full report: ${this.reportFile}`);
            this.log(`📜 Detailed logs: ${this.logFile}`);
            
            return report;
            
        } catch (error) {
            this.log(`❌ Verification failed: ${error.message}`, 'error');
            throw error;
        }
    }
}

// CLI interface
if (require.main === module) {
    const tool = new RailwayVerificationTool();
    
    tool.run().then((report) => {
        process.exit(report.summary.criticalIssues > 0 ? 1 : 0);
    }).catch((error) => {
        console.error('❌ Verification tool failed:', error.message);
        process.exit(1);
    });
}

module.exports = RailwayVerificationTool;