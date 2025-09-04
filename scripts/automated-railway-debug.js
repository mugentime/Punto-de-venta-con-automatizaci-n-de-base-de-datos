// Automated Railway CLI log debugging script
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class RailwayLogDebugger {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.logFile = path.join(__dirname, 'railway-debug-logs.txt');
        this.isAuthenticated = false;
    }

    // Check if Railway CLI is authenticated
    async checkAuthentication() {
        console.log('🔍 Checking Railway CLI authentication...');
        
        return new Promise((resolve) => {
            exec('railway whoami', (error, stdout, stderr) => {
                if (error) {
                    console.log('❌ Railway CLI not authenticated');
                    console.log('💡 Authentication required first');
                    resolve(false);
                } else {
                    console.log('✅ Railway CLI authenticated as:', stdout.trim());
                    this.isAuthenticated = true;
                    resolve(true);
                }
            });
        });
    }

    // Set up Railway authentication with browserless login
    async setupAuthentication() {
        console.log('🔑 Setting up Railway authentication...');
        
        return new Promise((resolve) => {
            const authProcess = spawn('railway', ['login', '--browserless'], {
                stdio: 'pipe'
            });

            let authOutput = '';
            
            authProcess.stdout.on('data', (data) => {
                const output = data.toString();
                authOutput += output;
                console.log('📋 Auth:', output);
                
                // Look for authentication URL
                if (output.includes('https://railway.app/cli-login')) {
                    console.log('\n🌐 AUTHENTICATION URL FOUND');
                    console.log('👆 Visit the URL above to authenticate');
                }
            });

            authProcess.stderr.on('data', (data) => {
                console.log('⚠️ Auth Error:', data.toString());
            });

            authProcess.on('close', (code) => {
                console.log('🔐 Authentication process completed with code:', code);
                resolve(code === 0);
            });
        });
    }

    // Link to the specific project
    async linkProject() {
        console.log('🔗 Linking to Railway project...');
        
        return new Promise((resolve) => {
            exec(`railway link --project ${this.projectId}`, (error, stdout, stderr) => {
                if (error) {
                    console.log('❌ Project linking failed:', error.message);
                    console.log('💡 Stderr:', stderr);
                    resolve(false);
                } else {
                    console.log('✅ Project linked successfully');
                    console.log('📋 Output:', stdout);
                    resolve(true);
                }
            });
        });
    }

    // Get environment variables
    async getEnvironmentVariables() {
        console.log('📊 Fetching environment variables...');
        
        return new Promise((resolve) => {
            exec('railway vars', (error, stdout, stderr) => {
                if (error) {
                    console.log('❌ Failed to get environment variables:', error.message);
                    resolve(null);
                } else {
                    console.log('✅ Environment variables retrieved');
                    const hasDatabase = stdout.includes('DATABASE_URL');
                    console.log('🔍 DATABASE_URL present:', hasDatabase ? 'YES' : 'NO');
                    
                    if (hasDatabase) {
                        const lines = stdout.split('\n');
                        const dbLine = lines.find(line => line.includes('DATABASE_URL'));
                        console.log('📋 DATABASE_URL line:', dbLine ? dbLine.substring(0, 50) + '...' : 'Not found');
                    }
                    
                    resolve(stdout);
                }
            });
        });
    }

    // Capture recent logs
    async captureRecentLogs() {
        console.log('📜 Capturing recent logs...');
        
        return new Promise((resolve) => {
            exec('railway logs --tail 200', (error, stdout, stderr) => {
                if (error) {
                    console.log('❌ Failed to get logs:', error.message);
                    resolve(null);
                } else {
                    console.log('✅ Recent logs captured');
                    
                    // Save logs to file
                    fs.writeFileSync(this.logFile, stdout);
                    console.log('💾 Logs saved to:', this.logFile);
                    
                    // Analyze logs for key patterns
                    this.analyzeLogs(stdout);
                    resolve(stdout);
                }
            });
        });
    }

    // Analyze logs for DATABASE_URL and environment issues
    analyzeLogs(logs) {
        console.log('\n🔍 ANALYZING LOGS FOR DATABASE ISSUES...\n');
        
        const lines = logs.split('\n');
        let foundIssues = [];
        let databaseMessages = [];
        let environmentMessages = [];
        
        lines.forEach((line, index) => {
            const lowerLine = line.toLowerCase();
            
            // Look for database-related messages
            if (lowerLine.includes('database') || lowerLine.includes('postgres') || lowerLine.includes('db')) {
                databaseMessages.push(`Line ${index + 1}: ${line}`);
            }
            
            // Look for environment variable messages
            if (lowerLine.includes('database_url') || lowerLine.includes('environment') || lowerLine.includes('railway')) {
                environmentMessages.push(`Line ${index + 1}: ${line}`);
            }
            
            // Look for specific error patterns
            if (lowerLine.includes('file-based') || lowerLine.includes('not reaching')) {
                foundIssues.push(`⚠️ ISSUE - Line ${index + 1}: ${line}`);
            }
            
            // Look for success patterns
            if (lowerLine.includes('postgresql') && !lowerLine.includes('file-based')) {
                foundIssues.push(`✅ SUCCESS - Line ${index + 1}: ${line}`);
            }
        });
        
        // Report findings
        console.log('📊 DATABASE MESSAGES FOUND:', databaseMessages.length);
        databaseMessages.slice(0, 10).forEach(msg => console.log('  ', msg));
        
        console.log('\n📊 ENVIRONMENT MESSAGES FOUND:', environmentMessages.length);
        environmentMessages.slice(0, 10).forEach(msg => console.log('  ', msg));
        
        console.log('\n📊 KEY ISSUES/SUCCESSES FOUND:', foundIssues.length);
        foundIssues.forEach(issue => console.log('  ', issue));
        
        if (foundIssues.length === 0) {
            console.log('\n💡 No obvious database issues found in recent logs');
            console.log('   This could mean:');
            console.log('   - App started successfully without errors');
            console.log('   - DATABASE_URL injection happens silently');
            console.log('   - Issue occurs during startup (need older logs)');
        }
    }

    // Start live log monitoring
    async startLiveMonitoring() {
        console.log('🔴 Starting live log monitoring...');
        console.log('   Press Ctrl+C to stop');
        
        const logProcess = spawn('railway', ['logs', '--follow'], {
            stdio: 'pipe'
        });

        logProcess.stdout.on('data', (data) => {
            const output = data.toString();
            
            // Filter and highlight important messages
            const lines = output.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const lowerLine = line.toLowerCase();
                    
                    if (lowerLine.includes('database') || lowerLine.includes('postgres')) {
                        console.log('🗄️  DB:', line);
                    } else if (lowerLine.includes('environment') || lowerLine.includes('railway')) {
                        console.log('🌍 ENV:', line);
                    } else if (lowerLine.includes('error') || lowerLine.includes('failed')) {
                        console.log('❌ ERR:', line);
                    } else {
                        console.log('📋    :', line);
                    }
                }
            });
        });

        logProcess.stderr.on('data', (data) => {
            console.log('⚠️ Log Error:', data.toString());
        });

        return logProcess;
    }

    // Main debugging workflow
    async runFullDebug() {
        console.log('🚀 Starting automated Railway log debugging...\n');
        
        try {
            // Check authentication
            const isAuth = await this.checkAuthentication();
            
            if (!isAuth) {
                console.log('\n🔑 Setting up authentication...');
                await this.setupAuthentication();
                
                // Wait for user to complete auth
                console.log('\n⏱️  Please complete authentication in browser...');
                console.log('   Press Enter when authentication is complete...');
                
                await new Promise(resolve => {
                    process.stdin.once('data', () => {
                        resolve();
                    });
                });
                
                // Check again
                const recheckAuth = await this.checkAuthentication();
                if (!recheckAuth) {
                    console.log('❌ Authentication still failed. Manual setup required.');
                    return;
                }
            }
            
            // Link project
            const linked = await this.linkProject();
            if (!linked) {
                console.log('❌ Project linking failed. Cannot continue.');
                return;
            }
            
            // Get environment variables
            await this.getEnvironmentVariables();
            
            // Capture and analyze recent logs
            await this.captureRecentLogs();
            
            // Offer live monitoring
            console.log('\n🔴 Would you like to start live log monitoring? (y/N)');
            process.stdin.once('data', async (data) => {
                if (data.toString().trim().toLowerCase() === 'y') {
                    await this.startLiveMonitoring();
                } else {
                    console.log('✅ Debugging complete. Check railway-debug-logs.txt for full logs.');
                    process.exit(0);
                }
            });
            
        } catch (error) {
            console.error('🚨 Debugging failed:', error);
        }
    }
}

// Run the debugger
const debugger = new RailwayLogDebugger();
debugger.runFullDebug();