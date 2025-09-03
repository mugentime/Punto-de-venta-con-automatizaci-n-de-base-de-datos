#!/usr/bin/env node

/**
 * Setup Git Hooks for POS Validation Protocol
 * Installs post-commit and post-merge hooks to automatically trigger validation
 */

const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const hooksDir = path.join(projectRoot, '.git', 'hooks');

const hooks = {
  'post-commit': `#!/bin/sh
# POS Post-Commit Hook - Triggers validation protocol after every commit

echo "🚀 Post-commit hook: Triggering POS validation protocol..."

# Execute the validation protocol
node scripts/pos-validation-protocol.js

# Store hook execution in memory
echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) [POST-COMMIT] Validation protocol triggered" >> .hive-mind/hook-logs.txt

echo "✅ Post-commit validation complete"
`,
  
  'post-merge': `#!/bin/sh
# POS Post-Merge Hook - Triggers validation protocol after merges

echo "🔀 Post-merge hook: Triggering POS validation protocol..."

# Execute the validation protocol
node scripts/pos-validation-protocol.js

# Store hook execution in memory
echo "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) [POST-MERGE] Validation protocol triggered" >> .hive-mind/hook-logs.txt

echo "✅ Post-merge validation complete"
`
};

function setupHooks() {
  console.log('🔧 Setting up POS validation git hooks...');
  
  // Ensure hooks directory exists
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  
  // Install each hook
  Object.entries(hooks).forEach(([hookName, hookContent]) => {
    const hookPath = path.join(hooksDir, hookName);
    
    // Write hook file
    fs.writeFileSync(hookPath, hookContent);
    
    // Make executable (on Unix-like systems)
    try {
      fs.chmodSync(hookPath, 0o755);
      console.log(`✅ Installed ${hookName} hook`);
    } catch (error) {
      console.log(`✅ Installed ${hookName} hook (chmod not supported on this system)`);
    }
  });
  
  // Create hive-mind directory if it doesn't exist
  const hiveMindDir = path.join(projectRoot, '.hive-mind');
  if (!fs.existsSync(hiveMindDir)) {
    fs.mkdirSync(hiveMindDir, { recursive: true });
  }
  
  // Initialize hook logs file
  const hookLogsPath = path.join(hiveMindDir, 'hook-logs.txt');
  if (!fs.existsSync(hookLogsPath)) {
    const initMessage = `${new Date().toISOString()} [INIT] POS validation hooks initialized\n`;
    fs.writeFileSync(hookLogsPath, initMessage);
  }
  
  console.log('🎯 Git hooks setup complete!');
  console.log('   - post-commit: Validates after every commit');
  console.log('   - post-merge: Validates after merge operations');
  console.log('   - Logs stored in: .hive-mind/hook-logs.txt');
}

// Execute if called directly
if (require.main === module) {
  setupHooks();
}

module.exports = { setupHooks };