// Quick Railway logs analyzer - assumes CLI is already authenticated
const { exec } = require('child_process');

console.log('⚡ Quick Railway Logs Analysis\n');

// Function to run Railway command and analyze output
function runRailwayCommand(command, description) {
    return new Promise((resolve) => {
        console.log(`🔍 ${description}...`);
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ Failed: ${error.message}`);
                if (stderr) console.log(`   Error: ${stderr}`);
                resolve({ success: false, error: error.message });
            } else {
                console.log(`✅ Success`);
                resolve({ success: true, output: stdout });
            }
        });
    });
}

// Quick analysis function
function quickAnalyze(logs) {
    console.log('\n📊 QUICK LOG ANALYSIS:\n');
    
    const lines = logs.split('\n');
    let findings = {
        databaseMessages: 0,
        postgresMessages: 0,
        environmentMessages: 0,
        errorMessages: 0,
        railwayMessages: 0
    };
    
    const importantLines = [];
    
    lines.forEach((line, index) => {
        const lower = line.toLowerCase();
        
        if (lower.includes('database')) findings.databaseMessages++;
        if (lower.includes('postgres')) findings.postgresMessages++;
        if (lower.includes('environment') || lower.includes('env')) findings.environmentMessages++;
        if (lower.includes('error') || lower.includes('failed')) findings.errorMessages++;
        if (lower.includes('railway')) findings.railwayMessages++;
        
        // Capture important lines
        if (lower.includes('database_url') || 
            lower.includes('file-based') || 
            lower.includes('postgresql') ||
            (lower.includes('database') && lower.includes('ready')) ||
            lower.includes('force redeploy')) {
            importantLines.push(`Line ${index + 1}: ${line}`);
        }
    });
    
    // Report findings
    Object.entries(findings).forEach(([key, count]) => {
        const emoji = count > 0 ? '📋' : '⭕';
        console.log(`${emoji} ${key}: ${count}`);
    });
    
    console.log('\n🎯 KEY LINES FOUND:');
    if (importantLines.length === 0) {
        console.log('   No critical database messages found');
    } else {
        importantLines.slice(0, 15).forEach(line => {
            console.log(`   ${line}`);
        });
    }
    
    return findings;
}

// Main execution
async function main() {
    try {
        // Check authentication
        const whoami = await runRailwayCommand('railway whoami', 'Checking authentication');
        if (!whoami.success) {
            console.log('\n🔑 Please authenticate first: node scripts/railway-auth-helper.js');
            return;
        }
        
        console.log(`   Authenticated as: ${whoami.output.trim()}`);
        
        // Link to project using correct syntax
        const link = await runRailwayCommand('railway link --project fed11c6d-a65a-4d93-90e6-955e16b6753f', 'Linking to project');
        if (!link.success) {
            console.log('\n⚠️ Project linking failed, trying interactive method...');
            console.log('💡 You may need to select the project manually');
            console.log('   Look for: "POS" or "pos-conejonegro" in the list');
        }
        
        // Get environment variables
        const vars = await runRailwayCommand('railway vars', 'Checking environment variables');
        if (vars.success) {
            const hasDB = vars.output.includes('DATABASE_URL');
            console.log(`   DATABASE_URL present: ${hasDB ? '✅ YES' : '❌ NO'}`);
            
            if (hasDB) {
                const dbLines = vars.output.split('\n').filter(line => line.includes('DATABASE'));
                console.log(`   Database vars: ${dbLines.length}`);
            }
        }
        
        // Get recent logs
        const logs = await runRailwayCommand('railway logs --tail 100', 'Fetching recent logs (100 lines)');
        if (logs.success) {
            quickAnalyze(logs.output);
            
            console.log('\n💾 Full logs available for detailed analysis');
            console.log('   Run: node scripts/automated-railway-debug.js');
        }
        
    } catch (error) {
        console.error('🚨 Analysis failed:', error);
    }
}

main();