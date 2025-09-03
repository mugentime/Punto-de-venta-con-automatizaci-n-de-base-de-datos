/**
 * Deployment Memory Tracking System for Hive-Mind
 * Automatically tracks git operations and Railway deployments
 * Stores persistent deployment history across sessions
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, exec } = require('child_process');

class DeploymentMemoryTracker {
    constructor() {
        this.hivePath = path.join(process.cwd(), '.hive-mind');
        this.dbPath = path.join(this.hivePath, 'hive.db');
        this.memoryPath = path.join(this.hivePath, 'memory');
        this.deploymentLogPath = path.join(this.memoryPath, 'deployment-history.json');
        
        this.initializeMemorySystem();
    }

    async initializeMemorySystem() {
        try {
            // Ensure memory directory exists
            await fs.mkdir(this.memoryPath, { recursive: true });
            
            // Initialize deployment history file if it doesn't exist
            try {
                await fs.access(this.deploymentLogPath);
            } catch {
                const initialData = {
                    deployments: [],
                    gitOperations: [],
                    railwayBuilds: [],
                    metadata: {
                        created: new Date().toISOString(),
                        version: '1.0.0',
                        lastUpdated: new Date().toISOString()
                    }
                };
                await fs.writeFile(this.deploymentLogPath, JSON.stringify(initialData, null, 2));
            }
        } catch (error) {
            console.error('Failed to initialize deployment memory system:', error);
        }
    }

    /**
     * Track git push operation
     */
    async trackGitPush(commitHash, branch = 'main', remote = 'origin') {
        const gitOperation = {
            id: this.generateId(),
            type: 'git-push',
            commitHash: commitHash || this.getCurrentCommitHash(),
            branch,
            remote,
            timestamp: new Date().toISOString(),
            message: this.getCommitMessage(commitHash),
            author: this.getGitAuthor(),
            files: this.getModifiedFiles(),
            status: 'completed'
        };

        await this.storeGitOperation(gitOperation);
        console.log(`[HIVE-MIND] Tracked git push: ${commitHash} to ${remote}/${branch}`);
        return gitOperation.id;
    }

    /**
     * Track Railway deployment
     */
    async trackRailwayDeployment(gitOperationId, deploymentData = {}) {
        const deployment = {
            id: this.generateId(),
            gitOperationId,
            type: 'railway-deployment',
            timestamp: new Date().toISOString(),
            status: deploymentData.status || 'pending',
            buildId: deploymentData.buildId,
            deploymentUrl: deploymentData.url,
            buildLogs: deploymentData.logs || [],
            buildDuration: deploymentData.duration,
            environment: deploymentData.environment || 'production',
            railwayProjectId: deploymentData.projectId,
            serviceId: deploymentData.serviceId,
            triggers: deploymentData.triggers || ['git-push'],
            metadata: {
                nodeVersion: process.version,
                platform: process.platform,
                ...deploymentData.metadata
            }
        };

        await this.storeDeployment(deployment);
        console.log(`[HIVE-MIND] Tracked Railway deployment: ${deployment.id} (${deployment.status})`);
        return deployment.id;
    }

    /**
     * Update deployment status
     */
    async updateDeploymentStatus(deploymentId, status, additionalData = {}) {
        const history = await this.loadDeploymentHistory();
        const deployment = history.deployments.find(d => d.id === deploymentId);
        
        if (deployment) {
            deployment.status = status;
            deployment.lastUpdated = new Date().toISOString();
            
            if (additionalData.buildLogs) {
                deployment.buildLogs = [...(deployment.buildLogs || []), ...additionalData.buildLogs];
            }
            
            if (additionalData.duration) {
                deployment.buildDuration = additionalData.duration;
            }
            
            if (additionalData.deploymentUrl) {
                deployment.deploymentUrl = additionalData.deploymentUrl;
            }

            if (additionalData.error) {
                deployment.error = additionalData.error;
                deployment.failureReason = additionalData.failureReason;
            }

            await this.saveDeploymentHistory(history);
            console.log(`[HIVE-MIND] Updated deployment ${deploymentId} status: ${status}`);
        }
    }

    /**
     * Create deployment audit trail entry
     */
    async createAuditTrail(deploymentId, event, data = {}) {
        const history = await this.loadDeploymentHistory();
        
        if (!history.auditTrail) {
            history.auditTrail = [];
        }

        const auditEntry = {
            id: this.generateId(),
            deploymentId,
            event,
            timestamp: new Date().toISOString(),
            data,
            sessionId: this.getSessionId()
        };

        history.auditTrail.push(auditEntry);
        await this.saveDeploymentHistory(history);
        
        console.log(`[HIVE-MIND] Audit trail: ${event} for deployment ${deploymentId}`);
    }

    /**
     * Query deployment history
     */
    async queryDeployments(filters = {}) {
        const history = await this.loadDeploymentHistory();
        let deployments = history.deployments;

        if (filters.status) {
            deployments = deployments.filter(d => d.status === filters.status);
        }

        if (filters.branch) {
            deployments = deployments.filter(d => {
                const gitOp = history.gitOperations.find(g => g.id === d.gitOperationId);
                return gitOp && gitOp.branch === filters.branch;
            });
        }

        if (filters.dateFrom) {
            deployments = deployments.filter(d => new Date(d.timestamp) >= new Date(filters.dateFrom));
        }

        if (filters.dateTo) {
            deployments = deployments.filter(d => new Date(d.timestamp) <= new Date(filters.dateTo));
        }

        if (filters.limit) {
            deployments = deployments.slice(0, filters.limit);
        }

        // Sort by timestamp descending (newest first)
        deployments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return deployments;
    }

    /**
     * Get deployment with linked git operation
     */
    async getDeploymentWithGitInfo(deploymentId) {
        const history = await this.loadDeploymentHistory();
        const deployment = history.deployments.find(d => d.id === deploymentId);
        
        if (deployment) {
            const gitOperation = history.gitOperations.find(g => g.id === deployment.gitOperationId);
            return {
                ...deployment,
                gitOperation
            };
        }
        
        return null;
    }

    /**
     * Get deployment statistics
     */
    async getDeploymentStats(days = 30) {
        const history = await this.loadDeploymentHistory();
        const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
        
        const recentDeployments = history.deployments.filter(d => 
            new Date(d.timestamp) >= since
        );

        const stats = {
            total: recentDeployments.length,
            successful: recentDeployments.filter(d => d.status === 'success').length,
            failed: recentDeployments.filter(d => d.status === 'failed').length,
            pending: recentDeployments.filter(d => d.status === 'pending').length,
            averageBuildTime: this.calculateAverageBuildTime(recentDeployments),
            deploymentFrequency: recentDeployments.length / days,
            successRate: recentDeployments.length > 0 ? 
                (recentDeployments.filter(d => d.status === 'success').length / recentDeployments.length * 100).toFixed(2) + '%' : 
                '0%'
        };

        return stats;
    }

    /**
     * Store git operation
     */
    async storeGitOperation(gitOperation) {
        const history = await this.loadDeploymentHistory();
        history.gitOperations.push(gitOperation);
        history.metadata.lastUpdated = new Date().toISOString();
        await this.saveDeploymentHistory(history);
    }

    /**
     * Store deployment
     */
    async storeDeployment(deployment) {
        const history = await this.loadDeploymentHistory();
        history.deployments.push(deployment);
        history.metadata.lastUpdated = new Date().toISOString();
        await this.saveDeploymentHistory(history);
    }

    /**
     * Load deployment history from file
     */
    async loadDeploymentHistory() {
        try {
            const data = await fs.readFile(this.deploymentLogPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Failed to load deployment history:', error);
            return { deployments: [], gitOperations: [], auditTrail: [] };
        }
    }

    /**
     * Save deployment history to file
     */
    async saveDeploymentHistory(history) {
        try {
            await fs.writeFile(this.deploymentLogPath, JSON.stringify(history, null, 2));
        } catch (error) {
            console.error('Failed to save deployment history:', error);
        }
    }

    /**
     * Utility methods
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getCurrentCommitHash() {
        try {
            return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
        } catch {
            return 'unknown';
        }
    }

    getCommitMessage(commitHash) {
        try {
            const hash = commitHash || 'HEAD';
            return execSync(`git log -1 --pretty=%B ${hash}`, { encoding: 'utf8' }).trim();
        } catch {
            return 'No commit message';
        }
    }

    getGitAuthor() {
        try {
            const name = execSync('git config user.name', { encoding: 'utf8' }).trim();
            const email = execSync('git config user.email', { encoding: 'utf8' }).trim();
            return `${name} <${email}>`;
        } catch {
            return 'Unknown Author';
        }
    }

    getModifiedFiles() {
        try {
            return execSync('git diff-tree --no-commit-id --name-only -r HEAD', { encoding: 'utf8' })
                .trim()
                .split('\n')
                .filter(f => f);
        } catch {
            return [];
        }
    }

    getSessionId() {
        return process.env.HIVE_SESSION_ID || `session-${Date.now()}`;
    }

    calculateAverageBuildTime(deployments) {
        const deploymentsWithDuration = deployments.filter(d => d.buildDuration);
        if (deploymentsWithDuration.length === 0) return 0;
        
        const totalDuration = deploymentsWithDuration.reduce((sum, d) => sum + d.buildDuration, 0);
        return Math.round(totalDuration / deploymentsWithDuration.length);
    }
}

module.exports = DeploymentMemoryTracker;