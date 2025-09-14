#!/usr/bin/env node

/**
 * Railway Deployment Rollback Tool
 * Provides rollback capabilities for Railway deployments when issues are detected
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

class RailwayRollbackTool {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.railwayUrl = 'https://pos-conejonegro-production.up.railway.app';
        this.backupDir = path.join(__dirname, '../deployment/backups');
        this.logFile = path.join(__dirname, '../tests/railway-rollback.log');
        this.knownWorkingCommits = [];
        
        this.ensureDirectories();
        this.loadKnownWorkingCommits();
    }

    ensureDirectories() {
        const dirs = [
            this.backupDir,
            path.dirname(this.logFile)
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadKnownWorkingCommits() {
        const commitFile = path.join(this.backupDir, 'working-commits.json');
        if (fs.existsSync(commitFile)) {
            try {
                this.knownWorkingCommits = JSON.parse(fs.readFileSync(commitFile, 'utf8'));
            } catch (error) {
                console.warn('Failed to load known working commits:', error.message);
                this.knownWorkingCommits = [];
            }
        }
    }

    saveKnownWorkingCommits() {
        const commitFile = path.join(this.backupDir, 'working-commits.json');
        fs.writeFileSync(commitFile, JSON.stringify(this.knownWorkingCommits, null, 2));
    }

    async log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
        
        console.log(`${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️'} ${message}`);
        fs.appendFileSync(this.logFile, logEntry);
    }

    async getCurrentCommit() {
        try {
            const { stdout } = await execAsync('git rev-parse HEAD');
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to get current commit: ${error.message}`);
        }
    }

    async getCommitInfo(commitHash) {
        try {
            const { stdout } = await execAsync(`git show --no-patch --format="%H|%an|%ad|%s" ${commitHash}`);
            const [hash, author, date, message] = stdout.trim().split('|');
            return { hash, author, date, message };
        } catch (error) {
            throw new Error(`Failed to get commit info for ${commitHash}: ${error.message}`);
        }
    }

    async getRecentCommits(count = 10) {
        try {
            const { stdout } = await execAsync(`git log --oneline -${count} --format="%H|%an|%ad|%s"`);
            return stdout.trim().split('\n').map(line => {
                const [hash, author, date, message] = line.split('|');
                return { hash, author, date, message };
            });
        } catch (error) {
            throw new Error(`Failed to get recent commits: ${error.message}`);
        }
    }

    async createConfigBackup(commitHash) {
        this.log(`💾 Creating configuration backup for commit ${commitHash}...`);
        
        const backupData = {
            commitHash,
            timestamp: new Date().toISOString(),
            files: {}
        };
        
        const configFiles = [
            'railway.json',
            'Dockerfile',
            'package.json',
            'server.js'
        ];
        
        for (const file of configFiles) {
            const filePath = path.join(__dirname, '..', file);
            if (fs.existsSync(filePath)) {
                backupData.files[file] = fs.readFileSync(filePath, 'utf8');
                this.log(`  ✅ Backed up: ${file}`);
            } else {
                this.log(`  ⚠️ File not found: ${file}`, 'warn');
            }
        }
        
        const backupFile = path.join(this.backupDir, `config-backup-${commitHash.substring(0, 8)}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
        
        this.log(`✅ Configuration backup saved: ${backupFile}`);
        return backupFile;
    }

    async restoreConfigBackup(backupFile) {
        this.log(`🔄 Restoring configuration from backup: ${backupFile}`);
        
        try {
            const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            
            for (const [filename, content] of Object.entries(backupData.files)) {
                const filePath = path.join(__dirname, '..', filename);
                fs.writeFileSync(filePath, content);
                this.log(`  ✅ Restored: ${filename}`);
            }
            
            this.log('✅ Configuration restored successfully');
            return true;
        } catch (error) {
            this.log(`❌ Failed to restore configuration: ${error.message}`, 'error');
            return false;
        }
    }

    async markCommitAsWorking(commitHash, deploymentTest = null) {
        const commitInfo = await this.getCommitInfo(commitHash);
        
        const workingCommit = {
            hash: commitHash,
            timestamp: new Date().toISOString(),
            author: commitInfo.author,
            date: commitInfo.date,
            message: commitInfo.message,
            deploymentTest: deploymentTest
        };
        
        // Remove if already exists and add at the beginning
        this.knownWorkingCommits = this.knownWorkingCommits.filter(c => c.hash !== commitHash);
        this.knownWorkingCommits.unshift(workingCommit);
        
        // Keep only last 20 working commits
        if (this.knownWorkingCommits.length > 20) {
            this.knownWorkingCommits = this.knownWorkingCommits.slice(0, 20);
        }
        
        this.saveKnownWorkingCommits();
        this.log(`✅ Marked commit as working: ${commitHash.substring(0, 8)} - ${commitInfo.message}`);
    }

    async findLastWorkingCommit() {
        if (this.knownWorkingCommits.length === 0) {
            this.log('⚠️ No known working commits found', 'warn');
            return null;
        }
        
        return this.knownWorkingCommits[0];
    }

    async rollbackToCommit(commitHash, reason = 'Manual rollback') {
        this.log(`🔄 Starting rollback to commit: ${commitHash}`);
        this.log(`Reason: ${reason}`);
        
        try {
            // Create backup of current state
            const currentCommit = await this.getCurrentCommit();
            await this.createConfigBackup(currentCommit);
            
            // Get commit info
            const commitInfo = await this.getCommitInfo(commitHash);
            this.log(`Target commit: ${commitInfo.message} by ${commitInfo.author}`);
            
            // Perform git reset
            this.log('🔄 Resetting Git to target commit...');
            await execAsync(`git reset --hard ${commitHash}`);
            
            // Force push to trigger redeployment
            this.log('🚀 Force pushing to trigger Railway redeployment...');
            await execAsync('git push --force-with-lease origin main');
            
            // Log rollback activity
            const rollbackRecord = {
                timestamp: new Date().toISOString(),
                fromCommit: currentCommit,
                toCommit: commitHash,
                reason: reason,
                commitInfo: commitInfo
            };
            
            const rollbackLogFile = path.join(this.backupDir, 'rollback-history.json');
            let rollbackHistory = [];
            
            if (fs.existsSync(rollbackLogFile)) {
                rollbackHistory = JSON.parse(fs.readFileSync(rollbackLogFile, 'utf8'));
            }
            
            rollbackHistory.unshift(rollbackRecord);
            if (rollbackHistory.length > 50) {
                rollbackHistory = rollbackHistory.slice(0, 50);
            }
            
            fs.writeFileSync(rollbackLogFile, JSON.stringify(rollbackHistory, null, 2));
            
            this.log('✅ Rollback completed successfully');
            this.log('🚀 Railway redeployment triggered');
            this.log('⏳ Please wait 2-3 minutes for deployment to complete');
            
            return {
                success: true,
                fromCommit: currentCommit,
                toCommit: commitHash,
                rollbackRecord
            };
            
        } catch (error) {
            this.log(`❌ Rollback failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async rollbackToLastWorking() {
        const lastWorking = await this.findLastWorkingCommit();
        
        if (!lastWorking) {
            throw new Error('No known working commits found');
        }
        
        this.log(`🔄 Rolling back to last known working commit: ${lastWorking.hash.substring(0, 8)}`);
        return await this.rollbackToCommit(lastWorking.hash, 'Automatic rollback to last working commit');
    }

    async createQuickFix() {
        this.log('🔧 Creating quick fix deployment...');
        
        try {
            // Create minimal railway.json
            const minimalConfig = {
                "$schema": "https://railway.app/railway.schema.json",
                "build": {
                    "builder": "dockerfile",
                    "dockerfilePath": "Dockerfile"
                },
                "deploy": {
                    "startCommand": "npm start",
                    "restartPolicyType": "on_failure"
                }
            };
            
            fs.writeFileSync(
                path.join(__dirname, '../railway.json'),
                JSON.stringify(minimalConfig, null, 2)
            );
            
            // Create minimal Dockerfile
            const minimalDockerfile = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;
            
            fs.writeFileSync(
                path.join(__dirname, '../Dockerfile'),
                minimalDockerfile
            );
            
            // Commit and push
            await execAsync('git add railway.json Dockerfile');
            await execAsync('git commit -m "fix: Quick fix deployment with minimal configuration"');
            await execAsync('git push origin main');
            
            this.log('✅ Quick fix deployment triggered');
            return true;
            
        } catch (error) {
            this.log(`❌ Quick fix failed: ${error.message}`, 'error');
            return false;
        }
    }

    async generateRollbackReport() {
        const rollbackLogFile = path.join(this.backupDir, 'rollback-history.json');
        let rollbackHistory = [];
        
        if (fs.existsSync(rollbackLogFile)) {
            rollbackHistory = JSON.parse(fs.readFileSync(rollbackLogFile, 'utf8'));
        }
        
        const report = {
            timestamp: new Date().toISOString(),
            projectId: this.projectId,
            currentCommit: await this.getCurrentCommit(),
            knownWorkingCommits: this.knownWorkingCommits,
            rollbackHistory: rollbackHistory.slice(0, 10),
            recommendations: []
        };
        
        if (this.knownWorkingCommits.length < 3) {
            report.recommendations.push('Build up a history of known working commits');
        }
        
        if (rollbackHistory.length > 5) {
            report.recommendations.push('Frequent rollbacks detected - investigate deployment pipeline');
        }
        
        const reportFile = path.join(this.backupDir, 'rollback-report.json');
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        this.log(`📊 Rollback report generated: ${reportFile}`);
        return report;
    }

    async listCommits() {
        console.log('\n📋 RECENT COMMITS:');
        const commits = await this.getRecentCommits(15);
        
        commits.forEach((commit, index) => {
            const isWorking = this.knownWorkingCommits.some(w => w.hash === commit.hash);
            const prefix = isWorking ? '✅' : '  ';
            console.log(`${prefix} ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message}`);
        });
        
        console.log('\n📋 KNOWN WORKING COMMITS:');
        this.knownWorkingCommits.slice(0, 5).forEach((commit, index) => {
            console.log(`✅ ${index + 1}. ${commit.hash.substring(0, 8)} - ${commit.message}`);
        });
    }
}

// CLI interface
if (require.main === module) {
    const tool = new RailwayRollbackTool();
    const command = process.argv[2];
    const arg = process.argv[3];
    
    (async () => {
        try {
            switch (command) {
                case 'rollback':
                    if (!arg) {
                        console.error('❌ Please specify a commit hash');
                        process.exit(1);
                    }
                    await tool.rollbackToCommit(arg, 'Manual rollback via CLI');
                    break;
                    
                case 'rollback-last':
                    await tool.rollbackToLastWorking();
                    break;
                    
                case 'mark-working':
                    const currentCommit = await tool.getCurrentCommit();
                    await tool.markCommitAsWorking(currentCommit);
                    break;
                    
                case 'quick-fix':
                    await tool.createQuickFix();
                    break;
                    
                case 'list':
                    await tool.listCommits();
                    break;
                    
                case 'report':
                    await tool.generateRollbackReport();
                    break;
                    
                default:
                    console.log('Railway Rollback Tool');
                    console.log('Usage:');
                    console.log('  node railway-rollback.js rollback <commit-hash>  - Rollback to specific commit');
                    console.log('  node railway-rollback.js rollback-last           - Rollback to last working commit');
                    console.log('  node railway-rollback.js mark-working            - Mark current commit as working');
                    console.log('  node railway-rollback.js quick-fix               - Deploy quick fix configuration');
                    console.log('  node railway-rollback.js list                    - List recent commits');
                    console.log('  node railway-rollback.js report                  - Generate rollback report');
                    process.exit(1);
            }
        } catch (error) {
            console.error('❌ Operation failed:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = RailwayRollbackTool;