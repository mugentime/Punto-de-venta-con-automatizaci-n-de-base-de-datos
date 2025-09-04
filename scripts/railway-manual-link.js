// Manual Railway project linking and log access
const { exec, spawn } = require('child_process');

console.log('🔗 Railway Manual Project Linking\n');

async function findPOSProject() {
    console.log('🔍 Searching for POS project...');
    
    return new Promise((resolve) => {
        exec('railway list', (error, stdout, stderr) => {
            if (error) {
                console.log('❌ Failed to list projects:', error.message);
                resolve(null);
            } else {
                console.log('📋 Available projects:');
                console.log(stdout);
                
                // Look for POS project
                const lines = stdout.split('\n');
                const posProject = lines.find(line => 
                    line.toLowerCase().includes('pos') || 
                    line.toLowerCase().includes('conejo') ||
                    line.includes('fed11c6d-a65a-4d93-90e6-955e16b6753f')
                );
                
                if (posProject) {
                    console.log('✅ Found POS project:', posProject);
                    resolve(posProject);
                } else {
                    console.log('⚠️ POS project not found in list');
                    resolve(null);
                }
            }
        });
    });
}

async function linkInteractively() {
    console.log('🎯 Starting interactive linking...');
    console.log('💡 Look for "POS" or similar project name\n');
    
    return new Promise((resolve) => {
        const linkProcess = spawn('railway', ['link'], {
            stdio: 'inherit'
        });
        
        linkProcess.on('close', (code) => {
            if (code === 0) {
                console.log('\n✅ Project linked successfully!');
                resolve(true);
            } else {
                console.log('\n❌ Project linking failed');
                resolve(false);
            }
        });
    });
}

async function getLogsAfterLink() {
    console.log('📜 Fetching logs from linked project...');
    
    // Get environment variables first
    exec('railway vars', (error, stdout, stderr) => {
        if (error) {
            console.log('⚠️ Could not get environment variables');
        } else {
            console.log('\n📊 ENVIRONMENT VARIABLES:');
            const hasDB = stdout.includes('DATABASE_URL');
            console.log('DATABASE_URL present:', hasDB ? '✅ YES' : '❌ NO');
            
            if (hasDB) {
                const lines = stdout.split('\n');
                const dbLines = lines.filter(line => line.includes('DATABASE'));
                console.log('Database-related vars:', dbLines.length);
            }
        }
    });
    
    // Get recent logs
    exec('railway logs --tail 50', (error, stdout, stderr) => {
        if (error) {
            console.log('❌ Failed to get logs:', error.message);
        } else {
            console.log('\n📜 RECENT LOGS (Last 50 lines):');
            console.log('=====================================');
            
            const lines = stdout.split('\n');
            lines.forEach((line, index) => {
                const lower = line.toLowerCase();
                
                // Highlight important lines
                if (lower.includes('database') || lower.includes('postgres')) {
                    console.log(`🗄️  ${line}`);
                } else if (lower.includes('environment') || lower.includes('railway')) {
                    console.log(`🌍 ${line}`);
                } else if (lower.includes('error') || lower.includes('failed')) {
                    console.log(`❌ ${line}`);
                } else if (lower.includes('file-based') || lower.includes('postgresql')) {
                    console.log(`🎯 ${line}`);
                } else if (line.trim()) {
                    console.log(`   ${line}`);
                }
            });
            
            console.log('\n=====================================');
            
            // Analyze for DATABASE_URL issues
            const dbMessages = lines.filter(line => 
                line.toLowerCase().includes('database') || 
                line.toLowerCase().includes('postgres')
            );
            
            console.log('🔍 ANALYSIS:');
            console.log(`   Database-related log lines: ${dbMessages.length}`);
            console.log(`   Total log lines: ${lines.length}`);
            
            if (dbMessages.length === 0) {
                console.log('   💡 No database messages in recent logs');
                console.log('   🎯 This suggests the issue might be:');
                console.log('      - Silent DATABASE_URL injection failure');
                console.log('      - App starts without database connection attempts');
                console.log('      - Need to check startup logs specifically');
            }
        }
    });
}

// Main execution
async function main() {
    try {
        // First try to find the project automatically
        await findPOSProject();
        
        console.log('\n🔗 Attempting to link to POS project...');
        
        // Try interactive linking
        const linked = await linkInteractively();
        
        if (linked) {
            console.log('\n🎉 Ready to analyze logs!');
            await getLogsAfterLink();
        } else {
            console.log('\n❌ Could not link to project');
            console.log('💡 Try manual steps:');
            console.log('   1. railway link');
            console.log('   2. Select your POS project');
            console.log('   3. railway logs');
        }
        
    } catch (error) {
        console.error('🚨 Manual linking failed:', error);
    }
}

main();