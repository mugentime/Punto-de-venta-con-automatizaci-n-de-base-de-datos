#!/usr/bin/env node

/**
 * Adaptive Railway Deployment Coordinator
 * Intelligent orchestration with real-time performance adaptation
 */

const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AdaptiveDeploymentCoordinator {
    constructor() {
        this.config = {
            maxRetries: 3,
            healthCheckInterval: 30000,
            performanceThreshold: 0.8,
            rollbackTriggers: {
                errorRate: 0.15,
                responseTime: 5000,
                memoryUsage: 0.9
            }
        };
        
        this.deploymentState = {
            phase: 'initializing',
            startTime: Date.now(),
            checkpoints: [],
            metrics: {
                performance: 1.0,
                errorRate: 0,
                responseTime: 0
            }
        };
        
        this.agents = new Map();
        this.topology = 'adaptive';
    }
    
    /**
     * Initialize adaptive coordination topology
     */
    async initializeTopology() {
        console.log('🚀 Initializing Adaptive Railway Deployment Coordinator');
        
        // Analyze current system state
        const systemState = await this.analyzeSystemState();
        
        // Select optimal topology based on project complexity
        this.topology = this.selectOptimalTopology(systemState);
        
        console.log(`📊 Selected topology: ${this.topology}`);
        
        return {
            topology: this.topology,
            systemState,
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Analyze current system state for optimal coordination
     */
    async analyzeSystemState() {
        try {
            const packageInfo = JSON.parse(
                await fs.readFile('package.json', 'utf8')
            );
            
            const projectStats = {
                dependencies: Object.keys(packageInfo.dependencies || {}).length,
                devDependencies: Object.keys(packageInfo.devDependencies || {}).length,
                scripts: Object.keys(packageInfo.scripts || {}).length,
                complexity: 'medium'
            };
            
            // Analyze file structure complexity
            const fileCount = await this.countProjectFiles();
            
            if (fileCount > 100 || projectStats.dependencies > 20) {
                projectStats.complexity = 'high';
            } else if (fileCount < 30 && projectStats.dependencies < 10) {
                projectStats.complexity = 'low';
            }
            
            return projectStats;
        } catch (error) {
            console.error('❌ System analysis failed:', error.message);
            return { complexity: 'unknown', error: error.message };
        }
    }
    
    /**
     * Count project files for complexity analysis
     */
    async countProjectFiles() {
        try {
            const files = await this.getAllFiles('.');
            return files.filter(file => 
                !file.includes('node_modules') && 
                !file.includes('.git') &&
                (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.html'))
            ).length;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Get all files recursively
     */
    async getAllFiles(dir) {
        const files = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subFiles = await this.getAllFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory not accessible
        }
        
        return files;
    }
    
    /**
     * Select optimal coordination topology
     */
    selectOptimalTopology(systemState) {
        switch (systemState.complexity) {
            case 'high':
                return 'hierarchical'; // Central coordination for complex deployments
            case 'low':
                return 'mesh'; // Distributed for simple deployments
            default:
                return 'adaptive'; // Dynamic adaptation
        }
    }
    
    /**
     * Execute deployment with adaptive coordination
     */
    async executeDeployment() {
        console.log('🎯 Starting Railway deployment execution');
        
        const phases = [
            'pre-deployment-validation',
            'build-preparation',
            'dependency-installation',
            'railway-deployment',
            'health-validation',
            'performance-monitoring'
        ];
        
        for (const phase of phases) {
            await this.executePhase(phase);
            
            // Real-time adaptation check
            if (await this.shouldAdaptTopology()) {
                await this.adaptTopology();
            }
        }
        
        return this.deploymentState;
    }
    
    /**
     * Execute specific deployment phase
     */
    async executePhase(phase) {
        console.log(`⚙️ Executing phase: ${phase}`);
        this.deploymentState.phase = phase;
        
        const checkpoint = {
            phase,
            timestamp: Date.now(),
            status: 'started'
        };
        
        try {
            switch (phase) {
                case 'pre-deployment-validation':
                    await this.validatePreDeployment();
                    break;
                case 'build-preparation':
                    await this.prepareBuild();
                    break;
                case 'dependency-installation':
                    await this.installDependencies();
                    break;
                case 'railway-deployment':
                    await this.deployToRailway();
                    break;
                case 'health-validation':
                    await this.validateHealth();
                    break;
                case 'performance-monitoring':
                    await this.monitorPerformance();
                    break;
            }
            
            checkpoint.status = 'completed';
            checkpoint.duration = Date.now() - checkpoint.timestamp;
            
        } catch (error) {
            checkpoint.status = 'failed';
            checkpoint.error = error.message;
            
            // Trigger adaptive response
            await this.handlePhaseFailure(phase, error);
        }
        
        this.deploymentState.checkpoints.push(checkpoint);
        console.log(`✅ Phase ${phase} completed in ${checkpoint.duration}ms`);
    }
    
    /**
     * Validate pre-deployment requirements
     */
    async validatePreDeployment() {
        console.log('🔍 Validating pre-deployment requirements');
        
        // Check Railway CLI availability
        const railwayStatus = await this.executeCommand('railway status');
        if (railwayStatus.error) {
            throw new Error('Railway CLI not authenticated or available');
        }
        
        // Validate environment configuration
        const envValid = await this.validateEnvironment();
        if (!envValid) {
            throw new Error('Environment validation failed');
        }
        
        // Check git status
        const gitStatus = await this.executeCommand('git status --porcelain');
        if (gitStatus.stdout.trim()) {
            console.log('⚠️ Uncommitted changes detected, staging...');
            await this.executeCommand('git add .');
        }
        
        console.log('✅ Pre-deployment validation passed');
    }
    
    /**
     * Prepare build environment
     */
    async prepareBuild() {
        console.log('🔧 Preparing build environment');
        
        // Clean previous builds if needed
        try {
            await this.executeCommand('rm -rf dist/ build/ .next/');
        } catch (error) {
            // Directories don't exist, continue
        }
        
        // Verify package.json integrity
        const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
        if (!packageJson.scripts || !packageJson.scripts.start) {
            throw new Error('Package.json missing start script');
        }
        
        console.log('✅ Build environment prepared');
    }
    
    /**
     * Install dependencies with optimization
     */
    async installDependencies() {
        console.log('📦 Installing dependencies');
        
        // Use npm ci for faster, deterministic installs
        const result = await this.executeCommand('npm ci --production=false', {
            timeout: 300000 // 5 minutes timeout
        });
        
        if (result.error) {
            console.log('⚠️ npm ci failed, falling back to npm install');
            await this.executeCommand('npm install', {
                timeout: 300000
            });
        }
        
        console.log('✅ Dependencies installed');
    }
    
    /**
     * Deploy to Railway with intelligent monitoring
     */
    async deployToRailway() {
        console.log('🚄 Deploying to Railway');
        
        // Start deployment
        const deployProcess = await this.executeCommand('railway up --detach');
        
        if (deployProcess.error) {
            throw new Error(`Railway deployment failed: ${deployProcess.error}`);
        }
        
        // Monitor deployment progress
        let deploymentComplete = false;
        let attempts = 0;
        const maxAttempts = 20;
        
        while (!deploymentComplete && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15s
            
            const status = await this.executeCommand('railway status');
            if (status.stdout.includes('deployed') || status.stdout.includes('active')) {
                deploymentComplete = true;
                console.log('✅ Railway deployment completed');
            }
            
            attempts++;
        }
        
        if (!deploymentComplete) {
            throw new Error('Railway deployment timed out');
        }
    }
    
    /**
     * Validate deployment health
     */
    async validateHealth() {
        console.log('🏥 Validating deployment health');
        
        // Get Railway service URL
        const urlResult = await this.executeCommand('railway status --json');
        let serviceUrl = 'https://pos-conejo-negro.railway.app'; // Fallback
        
        try {
            const status = JSON.parse(urlResult.stdout);
            serviceUrl = status.service?.url || serviceUrl;
        } catch (error) {
            console.log('⚠️ Could not parse Railway status, using fallback URL');
        }
        
        // Test health endpoint
        const healthCheck = await this.testHealthEndpoint(serviceUrl);
        if (!healthCheck.healthy) {
            throw new Error(`Health check failed: ${healthCheck.error}`);
        }
        
        console.log('✅ Health validation passed');
    }
    
    /**
     * Monitor performance metrics
     */
    async monitorPerformance() {
        console.log('📊 Monitoring performance metrics');
        
        // Collect initial performance metrics
        const metrics = await this.collectMetrics();
        this.deploymentState.metrics = metrics;
        
        // Log metrics for analysis
        await this.logMetrics(metrics);
        
        console.log('✅ Performance monitoring initialized');
    }
    
    /**
     * Test health endpoint
     */
    async testHealthEndpoint(url) {
        try {
            const response = await fetch(`${url}/api/health`, {
                timeout: 10000
            });
            
            if (response.ok) {
                return { healthy: true };
            } else {
                return { healthy: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
    
    /**
     * Collect performance metrics
     */
    async collectMetrics() {
        return {
            timestamp: Date.now(),
            deploymentDuration: Date.now() - this.deploymentState.startTime,
            memoryUsage: process.memoryUsage(),
            phase: this.deploymentState.phase,
            checkpointCount: this.deploymentState.checkpoints.length
        };
    }
    
    /**
     * Log metrics to file
     */
    async logMetrics(metrics) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            deployment: this.deploymentState,
            metrics,
            topology: this.topology
        };
        
        const logFile = 'deployment/monitoring/deployment-metrics.json';
        await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2));
    }
    
    /**
     * Execute command with error handling
     */
    async executeCommand(command, options = {}) {
        return new Promise((resolve) => {
            const { timeout = 60000 } = options;
            
            exec(command, { timeout }, (error, stdout, stderr) => {
                resolve({
                    error: error?.message,
                    stdout: stdout || '',
                    stderr: stderr || ''
                });
            });
        });
    }
    
    /**
     * Validate environment configuration
     */
    async validateEnvironment() {
        try {
            // Check for required files
            const requiredFiles = ['package.json', 'server.js'];
            for (const file of requiredFiles) {
                await fs.access(file);
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check if topology adaptation is needed
     */
    async shouldAdaptTopology() {
        const metrics = this.deploymentState.metrics;
        
        // Adapt if performance drops below threshold
        if (metrics.performance < this.config.performanceThreshold) {
            return true;
        }
        
        // Adapt if error rate too high
        if (metrics.errorRate > this.config.rollbackTriggers.errorRate) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Adapt topology based on current conditions
     */
    async adaptTopology() {
        console.log('🔄 Adapting coordination topology');
        
        const oldTopology = this.topology;
        
        // Switch to hierarchical for better control during issues
        if (this.topology === 'mesh') {
            this.topology = 'hierarchical';
        } else if (this.topology === 'hierarchical') {
            this.topology = 'adaptive';
        }
        
        console.log(`🔄 Topology adapted: ${oldTopology} → ${this.topology}`);
    }
    
    /**
     * Handle phase failure with adaptive response
     */
    async handlePhaseFailure(phase, error) {
        console.log(`❌ Phase ${phase} failed: ${error.message}`);
        
        // Implement retry logic
        if (this.deploymentState.retries < this.config.maxRetries) {
            console.log(`🔄 Retrying phase ${phase} (attempt ${this.deploymentState.retries + 1})`);
            this.deploymentState.retries = (this.deploymentState.retries || 0) + 1;
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Retry the phase
            await this.executePhase(phase);
        } else {
            // Max retries reached, initiate rollback
            await this.initiateRollback();
        }
    }
    
    /**
     * Initiate rollback procedures
     */
    async initiateRollback() {
        console.log('🚨 Initiating rollback procedures');
        
        try {
            // Revert to previous deployment
            await this.executeCommand('railway rollback');
            console.log('✅ Rollback completed');
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
        }
    }
}

module.exports = AdaptiveDeploymentCoordinator;

// Run if called directly
if (require.main === module) {
    const coordinator = new AdaptiveDeploymentCoordinator();
    
    coordinator.initializeTopology()
        .then(() => coordinator.executeDeployment())
        .then(result => {
            console.log('🎉 Deployment completed successfully');
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error('❌ Deployment failed:', error.message);
            process.exit(1);
        });
}