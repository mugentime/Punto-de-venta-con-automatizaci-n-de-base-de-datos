// Trigger Railway redeploy by making a small change
const fs = require('fs');
const path = require('path');

console.log('🚨 FORCING RAILWAY REDEPLOY WITH DATABASE_URL...\n');

// Update server.js with timestamp to force redeploy
const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// Add a timestamp comment to force Railway to redeploy
const timestamp = new Date().toISOString();
const forceComment = `\n// FORCE REDEPLOY: ${timestamp} - Ensure DATABASE_URL is loaded\n`;

if (!content.includes('FORCE REDEPLOY:')) {
    content = content.replace(
        "require('dotenv').config();",
        "require('dotenv').config();" + forceComment
    );
} else {
    // Update existing timestamp
    content = content.replace(
        /\/\/ FORCE REDEPLOY: .+ - Ensure DATABASE_URL is loaded/,
        `// FORCE REDEPLOY: ${timestamp} - Ensure DATABASE_URL is loaded`
    );
}

fs.writeFileSync(serverPath, content);
console.log('✅ Server.js updated with redeploy trigger');

// Also ensure Railway environment detection
const railwayEnvCheck = `
// RAILWAY ENVIRONMENT DETECTION
if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('🚀 Railway environment detected');
    console.log('📊 DATABASE_URL present:', !!process.env.DATABASE_URL);
    if (process.env.DATABASE_URL) {
        console.log('🔗 Using PostgreSQL from Railway');
    } else {
        console.log('⚠️ DATABASE_URL missing in Railway environment!');
    }
} else {
    console.log('🏠 Local development environment');
}
`;

if (!content.includes('RAILWAY ENVIRONMENT DETECTION')) {
    content = content.replace(
        "require('dotenv').config();",
        "require('dotenv').config();" + railwayEnvCheck
    );
    fs.writeFileSync(serverPath, content);
    console.log('✅ Added Railway environment detection');
}

console.log('🎯 Ready to trigger Railway redeploy!');
console.log('💡 This should force Railway to reload environment variables.');