/**
 * @fileoverview Data Sync Manager - Git-based persistence for free deployment
 * @description Manages data synchronization between file-based database and Git repository
 * @author TaskMaster Architecture Team
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class SyncManager {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data');
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.syncLockFile = path.join(__dirname, '..', '.sync-lock');
    }

    /**
     * Check if sync operation is in progress
     */
    async isSyncInProgress() {
        try {
            await fs.access(this.syncLockFile);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Acquire sync lock
     */
    async acquireSyncLock() {
        const lockInfo = {
            timestamp: new Date().toISOString(),
            process: process.pid,
            operation: 'data-sync'
        };
        await fs.writeFile(this.syncLockFile, JSON.stringify(lockInfo, null, 2));
    }

    /**
     * Release sync lock
     */
    async releaseSyncLock() {
        try {
            await fs.unlink(this.syncLockFile);
        } catch (error) {
            console.warn('⚠️ Could not release sync lock:', error.message);
        }
    }

    /**
     * Create backup of current data
     */
    async createBackup() {
        try {
            console.log('💾 Creating data backup...');
            
            // Ensure backup directory exists
            await fs.mkdir(this.backupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupDir, `data-backup-${timestamp}.json`);
            
            // Read all data files
            const dataFiles = ['users.json', 'products.json', 'records.json', 'cash_cuts.json', 'expenses.json'];
            const backup = {
                timestamp,
                data: {},
                metadata: {
                    version: require('../package.json').version,
                    environment: process.env.NODE_ENV || 'development',
                    dataDir: this.dataDir
                }
            };
            
            for (const file of dataFiles) {
                const filePath = path.join(this.dataDir, file);
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    backup.data[file] = JSON.parse(content);
                    console.log(`   ✅ Backed up ${file}`);
                } catch (error) {
                    console.warn(`   ⚠️ Could not backup ${file}:`, error.message);
                    backup.data[file] = [];
                }
            }
            
            await fs.writeFile(backupFile, JSON.stringify(backup, null, 2));
            console.log(`✅ Backup created: ${backupFile}`);
            
            return { success: true, backupFile, timestamp };
        } catch (error) {
            console.error('❌ Backup creation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Restore data from backup
     */
    async restoreFromBackup(backupFile = null) {
        try {
            console.log('🔄 Restoring data from backup...');
            
            let backupPath;
            if (backupFile) {
                backupPath = path.join(this.backupDir, backupFile);
            } else {
                // Find latest backup
                const backupFiles = await fs.readdir(this.backupDir);
                const dataBackups = backupFiles
                    .filter(f => f.startsWith('data-backup-') && f.endsWith('.json'))
                    .sort()
                    .reverse();
                
                if (dataBackups.length === 0) {
                    throw new Error('No backup files found');
                }
                
                backupPath = path.join(this.backupDir, dataBackups[0]);
                console.log(`   📂 Using latest backup: ${dataBackups[0]}`);
            }
            
            const backupContent = await fs.readFile(backupPath, 'utf8');
            const backup = JSON.parse(backupContent);
            
            // Restore each data file
            for (const [fileName, data] of Object.entries(backup.data)) {
                const filePath = path.join(this.dataDir, fileName);
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                console.log(`   ✅ Restored ${fileName}`);
            }
            
            console.log('✅ Data restoration completed');
            return { success: true, restored: Object.keys(backup.data).length };
        } catch (error) {
            console.error('❌ Data restoration failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync data to Git repository
     */
    async syncToGit() {
        if (await this.isSyncInProgress()) {
            return { success: false, error: 'Sync already in progress' };
        }

        try {
            await this.acquireSyncLock();
            console.log('📤 Syncing data to Git repository...');
            
            // Create backup first
            const backupResult = await this.createBackup();
            if (!backupResult.success) {
                throw new Error(`Backup failed: ${backupResult.error}`);
            }
            
            // Check if we're in a git repository
            try {
                execSync('git status', { stdio: 'ignore' });
            } catch {
                console.log('⚠️ Not in a Git repository, initializing...');
                execSync('git init', { stdio: 'ignore' });
            }
            
            // Add data files to git
            const gitCommands = [
                'git add data/',
                'git add backups/',
                `git commit -m "chore: auto-sync data backup ${backupResult.timestamp}" || echo "No changes to commit"`
            ];
            
            for (const command of gitCommands) {
                try {
                    execSync(command, { stdio: 'pipe' });
                    console.log(`   ✅ ${command.split(' ')[1]} completed`);
                } catch (error) {
                    console.log(`   ⚠️ ${command}: ${error.message}`);
                }
            }
            
            console.log('✅ Data synced to Git repository');
            return { success: true, backup: backupResult };
        } catch (error) {
            console.error('❌ Git sync failed:', error);
            return { success: false, error: error.message };
        } finally {
            await this.releaseSyncLock();
        }
    }

    /**
     * Sync data from Git repository (recovery)
     */
    async syncFromGit() {
        try {
            console.log('📥 Syncing data from Git repository...');
            
            // Pull latest changes if we have a remote
            try {
                execSync('git pull origin main 2>/dev/null || git pull 2>/dev/null || echo "No remote configured"', { stdio: 'pipe' });
                console.log('   ✅ Pulled latest changes from remote');
            } catch (error) {
                console.log('   ⚠️ Could not pull from remote:', error.message);
            }
            
            // Check if data directory exists
            try {
                await fs.access(this.dataDir);
                console.log('   ✅ Data directory found');
            } catch {
                console.log('   📁 Creating data directory...');
                await fs.mkdir(this.dataDir, { recursive: true });
            }
            
            // If no local data exists, restore from latest backup
            const dataFiles = ['users.json', 'products.json', 'records.json', 'cash_cuts.json'];
            let hasData = false;
            
            for (const file of dataFiles) {
                try {
                    await fs.access(path.join(this.dataDir, file));
                    hasData = true;
                    break;
                } catch {
                    // File doesn't exist
                }
            }
            
            if (!hasData) {
                console.log('   📂 No local data found, attempting restore from backup...');
                const restoreResult = await this.restoreFromBackup();
                if (restoreResult.success) {
                    console.log(`   ✅ Restored ${restoreResult.restored} data files`);
                } else {
                    console.log('   ⚠️ Could not restore from backup, will initialize with empty data');
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('❌ Git sync from repository failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get sync status and statistics
     */
    async getSyncStatus() {
        try {
            const status = {
                timestamp: new Date().toISOString(),
                dataDirectory: this.dataDir,
                backupDirectory: this.backupDir,
                syncInProgress: await this.isSyncInProgress(),
                dataFiles: {},
                backups: [],
                gitStatus: null
            };

            // Check data files
            const dataFiles = ['users.json', 'products.json', 'records.json', 'cash_cuts.json', 'expenses.json'];
            for (const file of dataFiles) {
                const filePath = path.join(this.dataDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf8');
                    const data = JSON.parse(content);
                    status.dataFiles[file] = {
                        exists: true,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        records: Array.isArray(data) ? data.length : Object.keys(data).length
                    };
                } catch {
                    status.dataFiles[file] = { exists: false };
                }
            }

            // Check backups
            try {
                const backupFiles = await fs.readdir(this.backupDir);
                status.backups = backupFiles
                    .filter(f => f.startsWith('data-backup-'))
                    .map(f => ({
                        file: f,
                        timestamp: f.replace('data-backup-', '').replace('.json', '').replace(/-/g, ':')
                    }))
                    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            } catch {
                status.backups = [];
            }

            // Check Git status
            try {
                const { stdout } = await execAsync('git status --porcelain');
                const { stdout: branch } = await execAsync('git branch --show-current');
                status.gitStatus = {
                    branch: branch.trim(),
                    hasChanges: stdout.trim().length > 0,
                    uncommittedFiles: stdout.trim().split('\n').filter(line => line.length > 0)
                };
            } catch {
                status.gitStatus = { error: 'Not a git repository or git not available' };
            }

            return status;
        } catch (error) {
            return { error: error.message };
        }
    }
}

module.exports = new SyncManager();
