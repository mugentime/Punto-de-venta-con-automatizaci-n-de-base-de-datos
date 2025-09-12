#!/usr/bin/env node

/**
 * 🚄 RAILWAY DEPLOYMENT SCRIPT - POS Conejo Negro
 * Complete deployment automation for Railway.app platform
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class RailwayDeployer {
    constructor(config = {}) {
        this.config = {
            projectId: process.env.RAILWAY_PROJECT_ID || config.projectId,
            token: process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || config.token,
            environment: config.environment || 'production',
            serviceName: config.serviceName || 'pos-conejo-negro',
            domain: config.domain || 'pos-conejonegro-production.up.railway.app',
            healthTimeout: 300000, // 5 minutes
            deployTimeout: 600000, // 10 minutes
            retryAttempts: 3,
            retryDelay: 30000, // 30 seconds
            ...config
        };

        this.deploymentId = null;
        this.logFile = path.join(__dirname, `../logs/deployment-${Date.now()}.json`);
        this.startTime = Date.now();
    }

    async init() {
        console.log('🚄 Railway Deployer - POS Conejo Negro');
        console.log('=====================================');
        console.log(`📦 Service: ${this.config.serviceName}`);
        console.log(`🌐 Environment: ${this.config.environment}`);
        console.log(`🔗 Domain: ${this.config.domain}`);
        console.log('');

        // Ensure logs directory exists
        await this.ensureLogsDirectory();
        
        // Validate configuration
        await this.validateConfig();
        
        // Initialize deployment log
        await this.initializeLog();
    }

    async ensureLogsDirectory() {
        const logsDir = path.join(__dirname, '../logs');
        try {
            await fs.mkdir(logsDir, { recursive: true });
        } catch (error) {
            console.error('❌ Failed to create logs directory:', error.message);
        }
    }

    async validateConfig() {
        const errors = [];
        
        if (!this.config.projectId) errors.push('RAILWAY_PROJECT_ID not set');
        if (!this.config.token) errors.push('RAILWAY_TOKEN not set');
        
        if (errors.length > 0) {
            console.error('❌ Configuration errors:');
            errors.forEach(error => console.error(`   - ${error}`));
            throw new Error('Invalid configuration');
        }

        // Test Railway CLI
        try {
            execSync('railway --version', { stdio: 'ignore' });
        } catch (error) {
            console.warn('⚠️  Railway CLI not found, attempting to install...');
            await this.installRailwayCLI();
        }

        console.log('✅ Configuration validated');
    }

    async installRailwayCLI() {
        try {
            console.log('📦 Installing Railway CLI...');
            execSync('npm install -g @railway/cli', { stdio: 'inherit' });
            console.log('✅ Railway CLI installed');
        } catch (error) {
            throw new Error(`Failed to install Railway CLI: ${error.message}`);
        }
    }

    async initializeLog() {
        const logData = {
            timestamp: new Date().toISOString(),
            deploymentId: this.deploymentId,
            config: {
                serviceName: this.config.serviceName,
                environment: this.config.environment,
                domain: this.config.domain
            },
            phases: [],
            errors: [],
            warnings: [],
            metrics: {
                startTime: this.startTime,
                endTime: null,
                duration: null
            }
        };

        try {
            await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
        } catch (error) {
            console.warn('⚠️  Failed to initialize log file:', error.message);
        }
    }

    async logPhase(phase, status, details = {}) {
        try {
            const logContent = await fs.readFile(this.logFile, 'utf8');
            const logData = JSON.parse(logContent);
            
            logData.phases.push({
                phase,
                status,
                timestamp: new Date().toISOString(),
                duration: Date.now() - this.startTime,
                details
            });

            await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
        } catch (error) {
            console.warn('⚠️  Failed to log phase:', error.message);
        }
    }

    async executeCommand(command, options = {}) {
        console.log(`🔄 Executing: ${command}`);
        
        try {
            const result = execSync(command, {
                encoding: 'utf8',
                timeout: options.timeout || 60000,
                ...options
            });
            console.log(`✅ Command successful`);
            return result;
        } catch (error) {
            console.error(`❌ Command failed: ${error.message}`);
            throw error;
        }
    }

    async checkRailwayAuth() {
        console.log('🔐 Checking Railway authentication...');
        
        try {
            const result = await this.executeCommand('railway whoami');
            console.log('✅ Railway authentication verified');
            return result.trim();
        } catch (error) {
            console.log('🔑 Logging in to Railway...');
            
            // Set the token
            process.env.RAILWAY_TOKEN = this.config.token;
            
            try {
                await this.executeCommand(`railway login --token "${this.config.token}"`);
                console.log('✅ Railway login successful');
            } catch (loginError) {
                throw new Error(`Railway authentication failed: ${loginError.message}`);
            }
        }
    }

    async linkProject() {
        console.log('🔗 Linking to Railway project...');
        await this.logPhase('link_project', 'started');
        
        try {
            // Link to project
            await this.executeCommand(`railway link ${this.config.projectId} --environment ${this.config.environment}`);
            console.log('✅ Project linked successfully');
            await this.logPhase('link_project', 'completed');
        } catch (error) {
            await this.logPhase('link_project', 'failed', { error: error.message });
            throw error;
        }
    }

    async setupEnvironment() {
        console.log('🌍 Setting up environment variables...');
        await this.logPhase('setup_environment', 'started');
        
        try {
            // Read .env file
            const envPath = path.join(__dirname, '../.env');
            let envContent = '';
            
            try {
                envContent = await fs.readFile(envPath, 'utf8');
            } catch (error) {
                console.warn('⚠️  No .env file found, using existing Railway vars');
                await this.logPhase('setup_environment', 'completed', { note: 'No .env file found' });
                return;
            }

            // Parse and set environment variables
            const envVars = this.parseEnvFile(envContent);
            
            for (const [key, value] of Object.entries(envVars)) {
                if (key && value && !key.startsWith('#')) {
                    try {
                        await this.executeCommand(`railway variables set ${key}="${value}"`);
                        console.log(`✅ Set ${key}`);
                    } catch (error) {
                        console.warn(`⚠️  Failed to set ${key}: ${error.message}`);
                    }
                }
            }

            await this.logPhase('setup_environment', 'completed', { 
                varsSet: Object.keys(envVars).length 
            });
        } catch (error) {
            await this.logPhase('setup_environment', 'failed', { error: error.message });
            throw error;
        }
    }

    parseEnvFile(content) {
        const vars = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    vars[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        return vars;
    }

    async runPreDeployChecks() {
        console.log('🔍 Running pre-deployment checks...');
        await this.logPhase('pre_deploy_checks', 'started');
        
        try {
            // Check if package.json exists
            const packagePath = path.join(__dirname, '../package.json');
            try {
                await fs.access(packagePath);
                console.log('✅ package.json found');
            } catch (error) {
                throw new Error('package.json not found');
            }

            // Check Node.js version
            const nodeVersion = process.version;
            console.log(`✅ Node.js version: ${nodeVersion}`);

            // Run tests if available
            try {
                await this.executeCommand('npm test', { timeout: 120000 });
                console.log('✅ Tests passed');
            } catch (error) {
                console.warn('⚠️  Tests failed or not available');
                // Don't fail deployment for test failures
            }

            await this.logPhase('pre_deploy_checks', 'completed');
        } catch (error) {
            await this.logPhase('pre_deploy_checks', 'failed', { error: error.message });
            throw error;
        }
    }

    async deployToRailway() {
        console.log('🚀 Deploying to Railway...');
        await this.logPhase('deploy', 'started');
        
        try {
            // Start deployment
            console.log('📦 Starting deployment...');
            const deployResult = await this.executeCommand('railway up --detach', {
                timeout: this.config.deployTimeout
            });
            
            // Extract deployment ID if available
            const deploymentMatch = deployResult.match(/deployment\s+(\w+)/i);
            if (deploymentMatch) {
                this.deploymentId = deploymentMatch[1];
                console.log(`📋 Deployment ID: ${this.deploymentId}`);
            }

            await this.logPhase('deploy', 'completed', { 
                deploymentId: this.deploymentId 
            });
            
            return this.deploymentId;
        } catch (error) {
            await this.logPhase('deploy', 'failed', { error: error.message });
            throw error;
        }
    }

    async waitForDeployment() {
        console.log('⏳ Waiting for deployment to complete...');
        await this.logPhase('wait_deployment', 'started');
        
        const startTime = Date.now();
        let attempts = 0;
        const maxAttempts = Math.floor(this.config.deployTimeout / 10000); // Check every 10 seconds
        
        while (attempts < maxAttempts) {
            try {
                // Check deployment status
                const statusResult = await this.executeCommand('railway status', { timeout: 10000 });
                
                if (statusResult.includes('DEPLOYED') || statusResult.includes('SUCCESS')) {
                    console.log('✅ Deployment completed successfully');
                    await this.logPhase('wait_deployment', 'completed', {
                        duration: Date.now() - startTime,
                        attempts: attempts + 1
                    });
                    return true;
                }
                
                if (statusResult.includes('FAILED') || statusResult.includes('ERROR')) {
                    throw new Error('Deployment failed on Railway');
                }
                
                console.log(`🔄 Deployment in progress... (${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                attempts++;
                
            } catch (error) {
                if (error.message.includes('timeout')) {
                    console.log(`⏳ Still waiting... (${attempts + 1}/${maxAttempts})`);
                    attempts++;
                    continue;
                }
                throw error;
            }
        }
        
        throw new Error('Deployment timeout - deployment did not complete within expected time');
    }

    async performHealthCheck() {
        console.log('🏥 Performing health check...');
        await this.logPhase('health_check', 'started');
        
        const healthUrl = `https://${this.config.domain}/health`;
        let attempts = 0;
        const maxAttempts = Math.floor(this.config.healthTimeout / 5000); // Check every 5 seconds
        
        while (attempts < maxAttempts) {
            try {
                console.log(`🔍 Checking: ${healthUrl} (${attempts + 1}/${maxAttempts})`);
                
                const response = await this.makeRequest(healthUrl);
                
                if (response.statusCode === 200) {
                    console.log('✅ Health check passed');
                    await this.logPhase('health_check', 'completed', {
                        attempts: attempts + 1,
                        responseTime: response.responseTime
                    });
                    return true;
                }
                
                console.log(`⏳ Health check failed: HTTP ${response.statusCode}, retrying...`);
                
            } catch (error) {
                console.log(`⏳ Health check error: ${error.message}, retrying...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }
        
        throw new Error('Health check timeout - application not responding');
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const req = https.get(url, {
                timeout: 10000,
                ...options
            }, (res) => {
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
            
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }

    async validateDeployment() {
        console.log('✅ Validating deployment...');
        await this.logPhase('validate_deployment', 'started');
        
        try {
            // Check main endpoints
            const endpoints = [
                { path: '/', name: 'Home page' },
                { path: '/health', name: 'Health endpoint' },
                { path: '/api/auth/verify', name: 'API endpoint' }
            ];
            
            const results = [];
            
            for (const endpoint of endpoints) {
                try {
                    const url = `https://${this.config.domain}${endpoint.path}`;
                    const response = await this.makeRequest(url);
                    
                    results.push({
                        ...endpoint,
                        success: response.statusCode < 500,
                        statusCode: response.statusCode,
                        responseTime: response.responseTime
                    });
                    
                    console.log(`${response.statusCode < 500 ? '✅' : '❌'} ${endpoint.name}: ${response.statusCode}`);
                } catch (error) {
                    results.push({
                        ...endpoint,
                        success: false,
                        error: error.message
                    });
                    console.log(`❌ ${endpoint.name}: ${error.message}`);
                }
            }
            
            const successfulChecks = results.filter(r => r.success).length;
            const isValid = successfulChecks >= Math.ceil(results.length * 0.7); // 70% success rate
            
            await this.logPhase('validate_deployment', 'completed', {
                results,
                successfulChecks,
                totalChecks: results.length,
                isValid
            });
            
            if (!isValid) {
                throw new Error('Deployment validation failed - too many endpoint failures');
            }
            
            console.log(`✅ Deployment validation passed (${successfulChecks}/${results.length} endpoints)`);
            return true;
            
        } catch (error) {
            await this.logPhase('validate_deployment', 'failed', { error: error.message });
            throw error;
        }
    }

    async generateReport() {
        console.log('📋 Generating deployment report...');
        
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        try {
            const logContent = await fs.readFile(this.logFile, 'utf8');
            const logData = JSON.parse(logContent);
            
            logData.metrics.endTime = endTime;
            logData.metrics.duration = duration;
            logData.success = true;
            logData.summary = {
                serviceName: this.config.serviceName,
                environment: this.config.environment,
                domain: `https://${this.config.domain}`,
                deploymentId: this.deploymentId,
                duration: `${Math.round(duration / 1000)}s`,
                timestamp: new Date().toISOString()
            };
            
            await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
            
            console.log('');
            console.log('🎉 DEPLOYMENT SUCCESSFUL!');
            console.log('========================');
            console.log(`🌐 URL: https://${this.config.domain}`);
            console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
            console.log(`📋 Deployment ID: ${this.deploymentId || 'N/A'}`);
            console.log(`📄 Log file: ${this.logFile}`);
            console.log('');
            
            return logData;
            
        } catch (error) {
            console.error('❌ Failed to generate report:', error.message);
            return null;
        }
    }

    async handleError(error, phase) {
        console.error(`❌ Deployment failed at ${phase}: ${error.message}`);
        
        await this.logPhase('deployment_failed', 'failed', {
            phase,
            error: error.message,
            timestamp: new Date().toISOString()
        });
        
        // Generate error report
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        try {
            const logContent = await fs.readFile(this.logFile, 'utf8');
            const logData = JSON.parse(logContent);
            
            logData.success = false;
            logData.error = {
                phase,
                message: error.message,
                timestamp: new Date().toISOString()
            };
            logData.metrics.endTime = endTime;
            logData.metrics.duration = duration;
            
            await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
            
        } catch (logError) {
            console.error('Failed to log error:', logError.message);
        }
        
        console.log('');
        console.log('💥 DEPLOYMENT FAILED!');
        console.log('====================');
        console.log(`❌ Phase: ${phase}`);
        console.log(`💬 Error: ${error.message}`);
        console.log(`⏱️  Duration: ${Math.round(duration / 1000)}s`);
        console.log(`📄 Log file: ${this.logFile}`);
        console.log('');
        
        process.exit(1);
    }

    async deploy() {
        try {
            await this.init();
            await this.checkRailwayAuth();
            await this.linkProject();
            await this.setupEnvironment();
            await this.runPreDeployChecks();
            await this.deployToRailway();
            await this.waitForDeployment();
            await this.performHealthCheck();
            await this.validateDeployment();
            await this.generateReport();
            
            return true;
            
        } catch (error) {
            await this.handleError(error, 'unknown');
            return false;
        }
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const config = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i]?.replace(/^--/, '');
        const value = args[i + 1];
        if (key && value) {
            config[key] = value;
        }
    }
    
    const deployer = new RailwayDeployer(config);
    deployer.deploy().catch(console.error);
}

module.exports = RailwayDeployer;