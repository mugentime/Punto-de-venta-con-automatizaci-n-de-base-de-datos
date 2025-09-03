/**
 * Git Hooks Integration for Automatic Deployment Tracking
 * Automatically triggers deployment tracking on git operations
 */

const DeploymentMemoryTracker = require('../memory/deploymentTracker');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class GitHooksManager {
    constructor() {
        this.tracker = new DeploymentMemoryTracker();
        this.hooksDir = path.join(process.cwd(), '.git', 'hooks');
        this.installHooks();
    }

    /**
     * Install git hooks for automatic tracking
     */
    async installHooks() {
        try {
            // Ensure hooks directory exists
            await fs.mkdir(this.hooksDir, { recursive: true });

            // Install post-commit hook
            await this.installPostCommitHook();
            
            // Install pre-push hook
            await this.installPrePushHook();
            
            // Install post-push hook (custom)
            await this.installPostPushHook();

            console.log('[HIVE-MIND] Git hooks installed successfully');
        } catch (error) {
            console.error('Failed to install git hooks:', error);
        }
    }

    /**
     * Install post-commit hook
     */
    async installPostCommitHook() {
        const hookPath = path.join(this.hooksDir, 'post-commit');
        const hookContent = `#!/bin/bash
# Hive-Mind Post-Commit Hook
# Automatically track commits in hive-mind system

echo "[HIVE-MIND] Post-commit hook triggered"

# Get commit info
COMMIT_HASH=$(git rev-parse HEAD)
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
AUTHOR=$(git config user.name)

# Track commit in hive-mind
node -e "
const DeploymentTracker = require('./src/memory/deploymentTracker');
const tracker = new DeploymentTracker();
tracker.trackGitPush('$COMMIT_HASH', '$BRANCH', 'origin').catch(console.error);
"

echo "[HIVE-MIND] Commit $COMMIT_HASH tracked successfully"
`;

        await fs.writeFile(hookPath, hookContent);
        await this.makeExecutable(hookPath);
    }

    /**
     * Install pre-push hook
     */
    async installPrePushHook() {
        const hookPath = path.join(this.hooksDir, 'pre-push');
        const hookContent = `#!/bin/bash
# Hive-Mind Pre-Push Hook
# Prepare for deployment tracking

echo "[HIVE-MIND] Pre-push hook: Preparing deployment tracking"

# Read push information
while read local_ref local_sha remote_ref remote_sha
do
    if [ "$local_sha" = "0000000000000000000000000000000000000000" ]
    then
        # Branch being deleted
        echo "[HIVE-MIND] Branch deletion detected, skipping tracking"
    else
        echo "[HIVE-MIND] Preparing to track push: $local_sha -> $remote_ref"
        
        # Store push info for post-push processing
        echo "$local_sha,$remote_ref,$(date -Iseconds)" > .git/hive-mind-push-info
    fi
done
`;

        await fs.writeFile(hookPath, hookContent);
        await this.makeExecutable(hookPath);
    }

    /**
     * Install custom post-push hook (triggered manually or via CI)
     */
    async installPostPushHook() {
        const hookPath = path.join(this.hooksDir, 'post-push');
        const hookContent = `#!/bin/bash
# Hive-Mind Post-Push Hook
# Track successful pushes and initiate deployment monitoring

echo "[HIVE-MIND] Post-push hook triggered"

# Check if push info exists
if [ -f .git/hive-mind-push-info ]; then
    PUSH_INFO=$(cat .git/hive-mind-push-info)
    IFS=',' read -r COMMIT_HASH REMOTE_REF TIMESTAMP <<< "$PUSH_INFO"
    
    echo "[HIVE-MIND] Processing push: $COMMIT_HASH to $REMOTE_REF"
    
    # Track the push in hive-mind
    node -e "
const DeploymentTracker = require('./src/memory/deploymentTracker');
const tracker = new DeploymentTracker();

async function trackPush() {
    try {
        const gitOpId = await tracker.trackGitPush('$COMMIT_HASH', 'main', 'origin');
        console.log('[HIVE-MIND] Git operation tracked:', gitOpId);
        
        // Initiate Railway deployment monitoring
        setTimeout(async () => {
            const deploymentId = await tracker.trackRailwayDeployment(gitOpId, {
                status: 'pending',
                environment: 'production',
                triggers: ['git-push']
            });
            console.log('[HIVE-MIND] Railway deployment tracking initiated:', deploymentId);
        }, 5000);
        
    } catch (error) {
        console.error('[HIVE-MIND] Error tracking push:', error);
    }
}

trackPush();
"
    
    # Clean up push info
    rm -f .git/hive-mind-push-info
    
    echo "[HIVE-MIND] Push tracking completed"
else
    echo "[HIVE-MIND] No push info found, using current HEAD"
    
    # Fallback to current HEAD tracking
    COMMIT_HASH=$(git rev-parse HEAD)
    node -e "
const DeploymentTracker = require('./src/memory/deploymentTracker');
const tracker = new DeploymentTracker();
tracker.trackGitPush('$COMMIT_HASH', 'main', 'origin').catch(console.error);
"
fi
`;

        await fs.writeFile(hookPath, hookContent);
        await this.makeExecutable(hookPath);
    }

    /**
     * Make hook file executable
     */
    async makeExecutable(filePath) {
        if (process.platform !== 'win32') {
            execSync(`chmod +x "${filePath}"`);
        }
    }

    /**
     * Trigger post-push hook manually (for testing or CI integration)
     */
    async triggerPostPushHook() {
        const hookPath = path.join(this.hooksDir, 'post-push');
        
        try {
            if (process.platform === 'win32') {
                // Windows: run with bash if available, otherwise with node
                execSync(`bash "${hookPath}"`, { stdio: 'inherit' });
            } else {
                execSync(`"${hookPath}"`, { stdio: 'inherit' });
            }
        } catch (error) {
            console.error('Error running post-push hook:', error);
            
            // Fallback: run tracking directly
            const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
            const gitOpId = await this.tracker.trackGitPush(commitHash, 'main', 'origin');
            const deploymentId = await this.tracker.trackRailwayDeployment(gitOpId, {
                status: 'pending',
                environment: 'production',
                triggers: ['manual-trigger']
            });
            
            console.log('[HIVE-MIND] Manual tracking completed:', { gitOpId, deploymentId });
        }
    }

    /**
     * Check hook installation status
     */
    async checkHooksStatus() {
        const hooks = ['post-commit', 'pre-push', 'post-push'];
        const status = {};

        for (const hook of hooks) {
            const hookPath = path.join(this.hooksDir, hook);
            try {
                await fs.access(hookPath);
                status[hook] = 'installed';
            } catch {
                status[hook] = 'missing';
            }
        }

        return status;
    }

    /**
     * Remove hooks
     */
    async removeHooks() {
        const hooks = ['post-commit', 'pre-push', 'post-push'];
        
        for (const hook of hooks) {
            const hookPath = path.join(this.hooksDir, hook);
            try {
                await fs.unlink(hookPath);
                console.log(`[HIVE-MIND] Removed hook: ${hook}`);
            } catch (error) {
                // Hook doesn't exist, ignore
            }
        }
    }
}

module.exports = GitHooksManager;