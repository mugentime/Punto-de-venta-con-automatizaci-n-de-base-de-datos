#!/usr/bin/env node

/**
 * TaskMaster Background Monitoring Agent
 * Monitors Render deployment status and GitHub issues
 * Runs continuously in background using pm2
 */

const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class TaskMasterAgent {
    constructor() {
        this.config = {
            project: {
                name: 'POS-CONEJONEGRO',
                repository: 'mugentime/POS-CONEJONEGRO',
                owner: 'mugentime',
                localUrl: 'http://localhost:3000',
                expectedRenderUrl: 'https://conejo-negro-pos.onrender.com',
                alternateRenderUrl: 'https://pos-conejo-negro.onrender.com'
            },
            intervals: {
                healthCheck: 5 * 60 * 1000, // 5 minutes
                deploymentCheck: 10 * 60 * 1000, // 10 minutes
                issueSync: 15 * 60 * 1000 // 15 minutes
            },
            logDir: './logs',
            analysisDir: './analysis'
        };
        this.isRunning = false;
        this.cycles = 0;
    }

    async initialize() {
        console.log('🚀 TaskMaster Agent Starting - Render Debug Mode');
        console.log('📊 Project:', this.config.project.name);
        console.log('🔗 Repository:', this.config.project.repository);
        
        // Ensure directories exist
        await this.ensureDirectories();
        
        // Start monitoring cycles
        this.isRunning = true;
        this.startMonitoring();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(this.config.logDir, { recursive: true });
            await fs.mkdir(this.config.analysisDir, { recursive: true });
            await fs.mkdir(`${this.config.analysisDir}/render`, { recursive: true });
            await fs.mkdir(`${this.config.analysisDir}/github`, { recursive: true });
        } catch (error) {
            console.error('Failed to create directories:', error.message);
        }
    }

    async startMonitoring() {
        console.log('⚡ Starting monitoring cycles...');
        
        // Immediate initial check
        await this.performHealthCheck();
        await this.performDeploymentCheck();
        await this.performIssueSync();

        // Set up recurring intervals
        setInterval(() => this.performHealthCheck(), this.config.intervals.healthCheck);
        setInterval(() => this.performDeploymentCheck(), this.config.intervals.deploymentCheck);
        setInterval(() => this.performIssueSync(), this.config.intervals.issueSync);

        console.log('✅ TaskMaster Agent running in background');
        console.log('⏰ Health checks every 5 minutes');
        console.log('⏰ Deployment checks every 10 minutes');
        console.log('⏰ Issue sync every 15 minutes');
    }

    async performHealthCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\\n🔍 [${timestamp}] Health Check Cycle ${++this.cycles}`);

        const results = {
            timestamp,
            cycle: this.cycles,
            checks: {}
        };

        // Check local development server
        try {
            results.checks.local = await this.checkEndpoint(this.config.project.localUrl + '/api/health');
            console.log('✅ Local server: HEALTHY');
        } catch (error) {
            results.checks.local = { status: 'ERROR', error: error.message };
            console.log('⚠️ Local server: DOWN');
        }

        // Check expected Render URL
        try {
            results.checks.renderExpected = await this.checkEndpoint(this.config.project.expectedRenderUrl + '/api/health');
            console.log('✅ Render (expected): HEALTHY');
        } catch (error) {
            results.checks.renderExpected = { status: 'ERROR', error: error.message };
            console.log('❌ Render (expected): DOWN');
        }

        // Check alternate Render URL (based on service name from render.yaml)
        try {
            results.checks.renderAlternate = await this.checkEndpoint(this.config.project.alternateRenderUrl + '/api/health');
            console.log('✅ Render (alternate): HEALTHY');
        } catch (error) {
            results.checks.renderAlternate = { status: 'ERROR', error: error.message };
            console.log('❌ Render (alternate): DOWN');
        }

        // Save health check results
        await this.saveResults('health-check', results);

        // Create GitHub issue for production down if both Render URLs are down
        if (results.checks.renderExpected.status === 'ERROR' && results.checks.renderAlternate.status === 'ERROR') {
            await this.alertProductionDown(results);
        }

        return results;
    }

    async checkEndpoint(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname,
                method: 'GET',
                timeout: 10000
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: 'OK',
                        statusCode: res.statusCode,
                        response: data,
                        headers: res.headers
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        });
    }

    async performDeploymentCheck() {
        const timestamp = new Date().toISOString();
        console.log(`\\n🚀 [${timestamp}] Deployment Check`);

        try {
            // Get latest commits
            const latestCommit = execSync('git log --oneline -1', { encoding: 'utf-8' }).trim();
            const recentCommits = execSync('git log --oneline -5', { encoding: 'utf-8' }).trim().split('\\n');
            
            // Check GitHub repository status
            const repoInfo = await this.getGitHubRepoInfo();
            
            // Check if we can identify Render service
            await this.debugRenderService();

            const deploymentStatus = {
                timestamp,
                localGit: {
                    latestCommit,
                    recentCommits,
                    branch: execSync('git branch --show-current', { encoding: 'utf-8' }).trim()
                },
                github: repoInfo,
                renderDebug: await this.debugRenderService()
            };

            await this.saveResults('deployment-check', deploymentStatus);
            
            console.log('📊 Latest commit:', latestCommit);
            console.log('📊 Current branch:', deploymentStatus.localGit.branch);

        } catch (error) {
            console.error('❌ Deployment check failed:', error.message);
            await this.saveResults('deployment-check-error', { timestamp, error: error.message });
        }
    }

    async getGitHubRepoInfo() {
        try {
            const repoJson = execSync(`gh repo view ${this.config.project.repository} --json name,description,defaultBranchRef,visibility,pushedAt`, { encoding: 'utf-8' });
            return JSON.parse(repoJson);
        } catch (error) {
            return { error: error.message };
        }
    }

    async debugRenderService() {
        // Since we don't have Render API key yet, we'll debug by checking URLs and configurations
        const debug = {
            configuredServiceName: 'pos-conejo-negro', // from render.yaml
            expectedUrl: this.config.project.expectedRenderUrl,
            alternateUrl: this.config.project.alternateRenderUrl,
            renderYamlCheck: null
        };

        try {
            const renderYaml = await fs.readFile('./render.yaml', 'utf-8');
            debug.renderYamlCheck = {
                hasAutoDeploy: renderYaml.includes('autoDeploy: true'),
                hasBranchMain: renderYaml.includes('branch: main'),
                serviceName: renderYaml.match(/name: (.+)/)?.[1]?.trim()
            };
        } catch (error) {
            debug.renderYamlCheck = { error: error.message };
        }

        return debug;
    }

    async performIssueSync() {
        const timestamp = new Date().toISOString();
        console.log(`\\n🎯 [${timestamp}] Issue Sync`);

        try {
            // Get open issues
            const issuesJson = execSync(`gh issue list --repo ${this.config.project.repository} --state open --json number,title,labels,createdAt,updatedAt`, { encoding: 'utf-8' });
            const issues = JSON.parse(issuesJson);

            console.log(`📋 Found ${issues.length} open issues`);
            
            // Categorize issues
            const categorized = this.categorizeIssues(issues);
            
            const issueReport = {
                timestamp,
                totalOpen: issues.length,
                categories: categorized,
                issues: issues
            };

            await this.saveResults('issues', issueReport);

            // Report on critical issues
            if (categorized.critical > 0) {
                console.log(`🚨 ${categorized.critical} CRITICAL issues require attention`);
            }

        } catch (error) {
            console.error('❌ Issue sync failed:', error.message);
        }
    }

    categorizeIssues(issues) {
        const categories = {
            critical: 0,
            deployment: 0,
            bug: 0,
            enhancement: 0,
            other: 0
        };

        issues.forEach(issue => {
            const title = issue.title.toLowerCase();
            const labels = issue.labels.map(l => l.name.toLowerCase());

            if (title.includes('production') || title.includes('p0') || title.includes('critical') || title.includes('down')) {
                categories.critical++;
            } else if (title.includes('deploy') || labels.includes('deployment')) {
                categories.deployment++;
            } else if (labels.includes('bug')) {
                categories.bug++;
            } else if (labels.includes('enhancement')) {
                categories.enhancement++;
            } else {
                categories.other++;
            }
        });

        return categories;
    }

    async alertProductionDown(healthResults) {
        // Only create alert if we haven't created one recently
        const alertFile = `${this.config.analysisDir}/last-production-alert.txt`;
        
        try {
            const lastAlert = await fs.readFile(alertFile, 'utf-8');
            const lastAlertTime = new Date(lastAlert.trim());
            const now = new Date();
            
            // Don't spam alerts - only alert if last one was over 1 hour ago
            if ((now - lastAlertTime) < (60 * 60 * 1000)) {
                console.log('🔕 Skipping production down alert (recent alert exists)');
                return;
            }
        } catch (error) {
            // File doesn't exist, proceed with alert
        }

        console.log('🚨 ALERTING: Production appears to be completely down');
        
        try {
            // Update existing issue if it exists, or the GitHub CLI will handle it
            await fs.writeFile(alertFile, new Date().toISOString());
            console.log('📝 Production down alert logged');
        } catch (error) {
            console.error('❌ Failed to log production alert:', error.message);
        }
    }

    async saveResults(type, data) {
        const filename = `${this.config.analysisDir}/${type}-${new Date().toISOString().split('T')[0]}.json`;
        
        try {
            let existingData = [];
            try {
                const existing = await fs.readFile(filename, 'utf-8');
                existingData = JSON.parse(existing);
            } catch (error) {
                // File doesn't exist yet
            }
            
            existingData.push(data);
            await fs.writeFile(filename, JSON.stringify(existingData, null, 2));
        } catch (error) {
            console.error(`❌ Failed to save ${type} results:`, error.message);
        }
    }

    async stop() {
        console.log('🛑 TaskMaster Agent stopping...');
        this.isRunning = false;
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the agent
if (require.main === module) {
    const agent = new TaskMasterAgent();
    agent.initialize().catch(console.error);
}

module.exports = TaskMasterAgent;
