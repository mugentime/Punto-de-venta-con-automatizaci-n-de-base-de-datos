#!/usr/bin/env node

/**
 * Railway Deployment Recovery Script
 * Project ID: fed11c6d-a65a-4d93-90e6-955e16b6753f
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function deployToRailway() {
    console.log('🚂 Starting Railway deployment recovery...');
    console.log('Project ID: fed11c6d-a65a-4d93-90e6-955e16b6753f');
    
    try {
        // Step 1: Login to Railway
        console.log('🔐 Logging into Railway...');
        await execAsync('railway login');
        
        // Step 2: Link to project
        console.log('🔗 Linking to project...');
        await execAsync('railway link fed11c6d-a65a-4d93-90e6-955e16b6753f');
        
        // Step 3: Set environment variables
        console.log('⚙️  Setting environment variables...');
        await execAsync('railway variables set NODE_ENV=production');
        await execAsync('railway variables set PORT=3000');
        
        // Step 4: Deploy
        console.log('🚀 Deploying to Railway...');
        const { stdout } = await execAsync('railway up --detach');
        console.log('Deploy output:', stdout);
        
        // Step 5: Get deployment URL
        console.log('🌐 Getting deployment URL...');
        const { stdout: urlOutput } = await execAsync('railway domain');
        console.log('Deployment URL:', urlOutput);
        
        console.log('✅ Railway deployment completed successfully!');
        
    } catch (error) {
        console.error('❌ Railway deployment failed:', error.message);
        
        // Recovery suggestions
        console.log('\n🔧 RECOVERY SUGGESTIONS:');
        console.log('1. Check Railway CLI installation: railway --version');
        console.log('2. Verify authentication: railway whoami');
        console.log('3. Check project permissions');
        console.log('4. Review Railway dashboard for errors');
        
        process.exit(1);
    }
}

if (require.main === module) {
    deployToRailway();
}

module.exports = { deployToRailway };
