/**
 * Railway Deployment Monitoring Service
 * Monitors Railway deployments and updates hive-mind memory
 */

const DeploymentMemoryTracker = require('../memory/deploymentTracker');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class RailwayMonitor {
    constructor() {
        this.tracker = new DeploymentMemoryTracker();
        this.railwayConfig = this.loadRailwayConfig();
        this.monitoringInterval = null;
        this.isMonitoring = false;
    }

    /**
     * Load Railway configuration
     */
    loadRailwayConfig() {
        try {
            const railwayJson = require(path.join(process.cwd(), 'railway.json'));
            return {
                projectId: railwayJson.projectId || process.env.RAILWAY_PROJECT_ID,
                serviceId: railwayJson.serviceId || process.env.RAILWAY_SERVICE_ID,
                environmentId: railwayJson.environmentId || process.env.RAILWAY_ENVIRONMENT_ID,
                apiUrl: process.env.RAILWAY_API_URL || 'https://backboard.railway.app',
                token: process.env.RAILWAY_TOKEN,
                appUrl: process.env.RAILWAY_APP_URL || railwayJson.url
            };
        } catch {
            return {
                projectId: process.env.RAILWAY_PROJECT_ID,
                serviceId: process.env.RAILWAY_SERVICE_ID,
                environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
                apiUrl: process.env.RAILWAY_API_URL || 'https://backboard.railway.app',
                token: process.env.RAILWAY_TOKEN,
                appUrl: process.env.RAILWAY_APP_URL
            };
        }
    }

    /**
     * Start monitoring Railway deployments
     */
    startMonitoring(intervalMs = 30000) {
        if (this.isMonitoring) {
            console.log('[HIVE-MIND] Railway monitor already running');
            return;
        }

        this.isMonitoring = true;
        console.log('[HIVE-MIND] Starting Railway deployment monitoring...');

        // Initial check
        this.checkDeploymentStatus();

        // Set up periodic monitoring
        this.monitoringInterval = setInterval(() => {
            this.checkDeploymentStatus();
        }, intervalMs);

        console.log(`[HIVE-MIND] Railway monitor started (checking every ${intervalMs}ms)`);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('[HIVE-MIND] Railway monitoring stopped');
    }

    /**
     * Check current deployment status
     */
    async checkDeploymentStatus() {
        try {
            const deploymentStatus = await this.getRailwayDeploymentStatus();
            const buildLogs = await this.getRailwayBuildLogs();
            const healthStatus = await this.checkApplicationHealth();

            // Find pending deployments in memory
            const pendingDeployments = await this.tracker.queryDeployments({ status: 'pending' });

            for (const deployment of pendingDeployments) {
                await this.updateDeploymentFromRailway(deployment, deploymentStatus, buildLogs, healthStatus);
            }

            // Log monitoring activity
            console.log(`[HIVE-MIND] Checked ${pendingDeployments.length} pending deployments`);

        } catch (error) {
            console.error('[HIVE-MIND] Error during deployment monitoring:', error);
        }
    }

    /**
     * Update deployment status from Railway data
     */
    async updateDeploymentFromRailway(deployment, railwayStatus, buildLogs, healthStatus) {
        try {
            let newStatus = deployment.status;
            let updateData = {};

            // Determine deployment status
            if (railwayStatus.status === 'SUCCESS' && healthStatus.healthy) {
                newStatus = 'success';
                updateData.deploymentUrl = healthStatus.url;
                updateData.duration = this.calculateDeploymentDuration(deployment.timestamp);
            } else if (railwayStatus.status === 'FAILED' || railwayStatus.status === 'CRASHED') {
                newStatus = 'failed';
                updateData.error = railwayStatus.error;
                updateData.failureReason = railwayStatus.failureReason;
            } else if (railwayStatus.status === 'BUILDING') {
                newStatus = 'building';
            }

            // Add build logs if available
            if (buildLogs && buildLogs.length > 0) {
                updateData.buildLogs = buildLogs;
            }

            // Update if status changed
            if (newStatus !== deployment.status) {
                await this.tracker.updateDeploymentStatus(deployment.id, newStatus, updateData);
                await this.tracker.createAuditTrail(deployment.id, 'status-change', {
                    from: deployment.status,
                    to: newStatus,
                    source: 'railway-monitor',
                    railwayStatus,
                    healthStatus
                });

                console.log(`[HIVE-MIND] Updated deployment ${deployment.id}: ${deployment.status} -> ${newStatus}`);
            }

        } catch (error) {
            console.error(`[HIVE-MIND] Error updating deployment ${deployment.id}:`, error);
        }
    }

    /**
     * Get Railway deployment status via API
     */
    async getRailwayDeploymentStatus() {
        try {
            if (!this.railwayConfig.token) {
                throw new Error('Railway API token not configured');
            }

            const response = await this.makeRailwayAPIRequest('/graphql', {
                query: `
                    query {
                        project(id: "${this.railwayConfig.projectId}") {
                            environments {
                                edges {
                                    node {
                                        id
                                        name
                                        deployments {
                                            edges {
                                                node {
                                                    id
                                                    status
                                                    createdAt
                                                    updatedAt
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                `
            });

            return this.parseRailwayResponse(response);

        } catch (error) {
            console.error('[HIVE-MIND] Error fetching Railway status:', error);
            return { status: 'UNKNOWN', error: error.message };
        }
    }

    /**
     * Get Railway build logs
     */
    async getRailwayBuildLogs() {
        try {
            // This would require Railway API access or log scraping
            // For now, return placeholder logs
            return [{
                timestamp: new Date().toISOString(),
                level: 'info',
                message: 'Build logs would be fetched from Railway API'
            }];
        } catch (error) {
            console.error('[HIVE-MIND] Error fetching build logs:', error);
            return [];
        }
    }

    /**
     * Check application health
     */
    async checkApplicationHealth() {
        const appUrl = this.railwayConfig.appUrl;
        if (!appUrl) {
            return { healthy: false, reason: 'No app URL configured' };
        }

        try {
            const healthEndpoint = `${appUrl}/health`;
            const startTime = Date.now();
            
            const response = await fetch(healthEndpoint);
            const responseTime = Date.now() - startTime;

            return {
                healthy: response.ok,
                status: response.status,
                responseTime,
                url: appUrl,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                url: appUrl,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Make API request to Railway
     */
    async makeRailwayAPIRequest(endpoint, data) {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify(data);
            const options = {
                hostname: 'backboard.railway.app',
                port: 443,
                path: endpoint,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.railwayConfig.token}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }

    /**
     * Parse Railway API response
     */
    parseRailwayResponse(response) {
        try {
            if (response.errors) {
                return { status: 'ERROR', error: response.errors[0].message };
            }

            const project = response.data?.project;
            if (!project) {
                return { status: 'UNKNOWN', error: 'No project data' };
            }

            // Get latest deployment status
            const environments = project.environments.edges;
            if (environments.length === 0) {
                return { status: 'UNKNOWN', error: 'No environments found' };
            }

            const latestDeployment = environments[0].node.deployments.edges[0]?.node;
            if (!latestDeployment) {
                return { status: 'UNKNOWN', error: 'No deployments found' };
            }

            return {
                status: latestDeployment.status,
                deploymentId: latestDeployment.id,
                createdAt: latestDeployment.createdAt,
                updatedAt: latestDeployment.updatedAt
            };

        } catch (error) {
            return { status: 'UNKNOWN', error: 'Failed to parse response' };
        }
    }

    /**
     * Calculate deployment duration
     */
    calculateDeploymentDuration(startTime) {
        const start = new Date(startTime);
        const end = new Date();
        return end.getTime() - start.getTime(); // Duration in milliseconds
    }

    /**
     * Get monitoring status
     */
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            intervalMs: this.monitoringInterval ? 30000 : 0,
            railwayConfig: {
                hasToken: !!this.railwayConfig.token,
                hasProjectId: !!this.railwayConfig.projectId,
                hasServiceId: !!this.railwayConfig.serviceId,
                appUrl: this.railwayConfig.appUrl
            }
        };
    }

    /**
     * Manually trigger deployment check
     */
    async triggerManualCheck(commitHash) {
        const gitOpId = await this.tracker.trackGitPush(commitHash);
        const deploymentId = await this.tracker.trackRailwayDeployment(gitOpId, {
            status: 'pending',
            environment: 'production',
            triggers: ['manual-trigger']
        });

        // Immediate status check
        setTimeout(() => {
            this.checkDeploymentStatus();
        }, 2000);

        return { gitOpId, deploymentId };
    }
}

module.exports = RailwayMonitor;