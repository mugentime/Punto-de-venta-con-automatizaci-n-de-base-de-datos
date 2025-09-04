// Railway CLI Authentication Helper
const { spawn, exec } = require('child_process');

console.log('🚀 Railway CLI Authentication Helper\n');

// Check if already authenticated
exec('railway whoami', (error, stdout, stderr) => {
    if (error) {
        console.log('❌ Not authenticated. Starting login process...\n');
        startLogin();
    } else {
        console.log('✅ Already authenticated as:', stdout.trim());
        console.log('\n🎯 Ready to run log debugging!');
        console.log('Run: node scripts/automated-railway-debug.js');
    }
});

function startLogin() {
    console.log('🔑 Starting Railway login...');
    console.log('💡 This will provide a URL for browser authentication\n');
    
    const authProcess = spawn('railway', ['login', '--browserless'], {
        stdio: 'inherit'
    });
    
    authProcess.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Authentication successful!');
            console.log('🎯 Now you can run: node scripts/automated-railway-debug.js');
        } else {
            console.log('\n❌ Authentication failed with code:', code);
            console.log('💡 Try manual login: railway login');
        }
    });
}