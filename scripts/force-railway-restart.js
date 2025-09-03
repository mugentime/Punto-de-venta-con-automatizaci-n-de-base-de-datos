// Force Railway service restart by creating deployment trigger
const fs = require('fs');
const path = require('path');

console.log('🔄 Forcing Railway service restart...\n');

// Method 1: Update package.json with restart trigger
const packagePath = path.join(__dirname, '..', 'package.json');
let packageContent = fs.readFileSync(packagePath, 'utf8');
const packageJson = JSON.parse(packageContent);

// Add a restart timestamp to force Railway to redeploy
const restartTimestamp = new Date().toISOString();
packageJson.railway_restart_trigger = restartTimestamp;

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json with restart trigger');

// Method 2: Create a new empty commit to trigger redeploy
const { execSync } = require('child_process');

try {
    // Add the updated package.json
    execSync('git add package.json', { stdio: 'inherit' });
    
    // Create commit with timestamp
    const commitMessage = `Force Railway restart: ${restartTimestamp}`;
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    console.log('✅ Created restart commit');
    
    // Push to trigger Railway redeploy
    execSync('git push origin main', { stdio: 'inherit' });
    
    console.log('✅ Pushed restart trigger to GitHub');
    console.log('\n🚀 Railway should now redeploy with environment variables reload');
    console.log('⏱️  Wait 2-3 minutes for deployment to complete');
    console.log('🔍 Then run: node scripts/railway-environment-debug.js');
    
} catch (error) {
    console.error('❌ Git operations failed:', error.message);
    console.log('\n💡 Alternative: Manually trigger redeploy in Railway Dashboard');
    console.log('   1. Go to Railway Dashboard');
    console.log('   2. Click on your service');
    console.log('   3. Go to "Deployments" tab');
    console.log('   4. Click "Redeploy" on the latest deployment');
}