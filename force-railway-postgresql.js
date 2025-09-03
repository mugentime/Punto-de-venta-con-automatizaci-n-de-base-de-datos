// Emergency PostgreSQL configuration for Railway
console.log('🚨 EMERGENCY: Forcing PostgreSQL configuration for Railway...\n');

// Force environment variable in server.js
const fs = require('fs');
const serverPath = './server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Inject DATABASE_URL after dotenv config
const injection = `
// 🚨 EMERGENCY: Force PostgreSQL for Railway deployment
console.log('🔍 Checking DATABASE_URL...', !!process.env.DATABASE_URL);
if (!process.env.DATABASE_URL && (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production')) {
    console.log('🚨 FORCING DATABASE_URL for Railway...');
    process.env.DATABASE_URL = 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway';
    console.log('✅ DATABASE_URL set for Railway deployment');
}
`;

if (!serverContent.includes('EMERGENCY: Force PostgreSQL')) {
    serverContent = serverContent.replace(
        "require('dotenv').config();",
        "require('dotenv').config();" + injection
    );
    fs.writeFileSync(serverPath, serverContent);
    console.log('✅ server.js updated with emergency PostgreSQL injection');
}

console.log('🎯 Emergency PostgreSQL configuration complete!');