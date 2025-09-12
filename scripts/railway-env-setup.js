#!/usr/bin/env node

/**
 * 🌍 RAILWAY ENVIRONMENT SETUP - POS Conejo Negro
 * Automated environment variable configuration for Railway deployment
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class RailwayEnvSetup {
    constructor(config = {}) {
        this.config = {
            projectId: process.env.RAILWAY_PROJECT_ID || config.projectId,
            token: process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || config.token,
            environment: config.environment || 'production',
            envFile: config.envFile || path.join(__dirname, '../.env'),
            backupEnv: config.backupEnv || true,
            validateVars: config.validateVars !== false,
            ...config
        };

        this.requiredVars = [
            'NODE_ENV',
            'DATABASE_URL',
            'JWT_SECRET',
            'PORT'
        ];

        this.optionalVars = [
            'REDIS_URL',
            'MONGODB_URI',
            'RAILWAY_PROJECT_ID',
            'RAILWAY_TOKEN'
        ];

        this.sensitiveVars = [
            'DATABASE_URL',
            'JWT_SECRET',
            'RAILWAY_TOKEN',
            'REDIS_URL'
        ];
    }

    async init() {
        console.log('🌍 Railway Environment Setup - POS Conejo Negro');
        console.log('================================================');
        console.log(`📦 Project ID: ${this.config.projectId || 'Not set'}`);
        console.log(`🌐 Environment: ${this.config.environment}`);
        console.log(`📄 Env file: ${this.config.envFile}`);
        console.log('');

        await this.validateConfig();
        await this.checkRailwayAuth();
    }

    async validateConfig() {
        const errors = [];
        
        if (!this.config.projectId) {
            errors.push('RAILWAY_PROJECT_ID not set');
        }
        
        if (!this.config.token) {
            errors.push('RAILWAY_TOKEN not set');
        }
        
        if (errors.length > 0) {
            console.error('❌ Configuration errors:');
            errors.forEach(error => console.error(`   - ${error}`));
            console.log('');
            console.log('💡 To fix this:');
            console.log('   1. Set RAILWAY_PROJECT_ID in your .env file');
            console.log('   2. Set RAILWAY_TOKEN in your .env file');
            console.log('   3. Or pass them as command line arguments');
            throw new Error('Invalid configuration');
        }

        console.log('✅ Configuration validated');
    }

    async checkRailwayAuth() {
        console.log('🔐 Checking Railway authentication...');
        
        try {
            // Test Railway CLI
            execSync('railway --version', { stdio: 'ignore' });
        } catch (error) {
            console.log('📦 Installing Railway CLI...');
            await this.installRailwayCLI();
        }

        // Set token and authenticate
        process.env.RAILWAY_TOKEN = this.config.token;
        
        try {
            const result = execSync('railway whoami', { encoding: 'utf8', stdio: 'pipe' });
            console.log(`✅ Authenticated as: ${result.trim()}`);
        } catch (error) {
            console.log('🔑 Logging in to Railway...');
            try {
                execSync(`railway login --token "${this.config.token}"`, { stdio: 'inherit' });
                console.log('✅ Railway authentication successful');
            } catch (loginError) {
                throw new Error(`Railway authentication failed: ${loginError.message}`);
            }
        }
    }

    async installRailwayCLI() {
        try {
            execSync('npm install -g @railway/cli', { stdio: 'inherit' });
            console.log('✅ Railway CLI installed');
        } catch (error) {
            throw new Error(`Failed to install Railway CLI: ${error.message}`);
        }
    }

    async readEnvFile() {
        console.log('📖 Reading environment file...');
        
        try {
            const content = await fs.readFile(this.config.envFile, 'utf8');
            const vars = this.parseEnvFile(content);
            console.log(`✅ Found ${Object.keys(vars).length} environment variables`);
            return vars;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`⚠️  Environment file not found: ${this.config.envFile}`);
                return {};
            }
            throw new Error(`Failed to read env file: ${error.message}`);
        }
    }

    parseEnvFile(content) {
        const vars = {};
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;
            
            // Handle multiline values
            let fullLine = line;
            if (line.includes('"') && !this.isCompleteQuotedValue(line)) {
                // Multi-line quoted value
                for (let j = i + 1; j < lines.length; j++) {
                    fullLine += '\n' + lines[j];
                    if (this.isCompleteQuotedValue(fullLine)) {
                        i = j; // Skip the processed lines
                        break;
                    }
                }
            }
            
            const [key, ...valueParts] = fullLine.split('=');
            if (key && valueParts.length > 0) {
                let value = valueParts.join('=').trim();
                
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                
                vars[key.trim()] = value;
            }
        }
        
        return vars;
    }

    isCompleteQuotedValue(str) {
        const quotes = (str.match(/"/g) || []).length;
        return quotes % 2 === 0;
    }

    async getCurrentRailwayVars() {
        console.log('🔍 Fetching current Railway variables...');
        
        try {
            // Link to project first
            execSync(`railway link ${this.config.projectId} --environment ${this.config.environment}`, 
                { stdio: 'ignore' });
            
            const result = execSync('railway variables', { encoding: 'utf8' });
            const vars = this.parseRailwayVarsOutput(result);
            console.log(`✅ Found ${Object.keys(vars).length} Railway variables`);
            return vars;
        } catch (error) {
            console.warn('⚠️  Could not fetch Railway variables:', error.message);
            return {};
        }
    }

    parseRailwayVarsOutput(output) {
        const vars = {};
        const lines = output.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    // Railway masks sensitive values
                    vars[key.trim()] = valueParts.join('=').trim();
                }
            }
        }
        
        return vars;
    }

    async validateEnvironmentVars(vars) {
        console.log('✅ Validating environment variables...');
        
        const issues = [];
        const warnings = [];
        
        // Check required variables
        for (const varName of this.requiredVars) {
            if (!vars[varName]) {
                issues.push(`Missing required variable: ${varName}`);
            } else if (vars[varName].trim() === '') {
                issues.push(`Empty required variable: ${varName}`);
            }
        }
        
        // Check for suspicious values
        for (const [key, value] of Object.entries(vars)) {
            if (value.includes('localhost') && this.config.environment === 'production') {
                warnings.push(`${key} contains localhost in production environment`);
            }
            
            if (value.includes('127.0.0.1') && this.config.environment === 'production') {
                warnings.push(`${key} contains localhost IP in production environment`);
            }
            
            if (value.length < 8 && this.sensitiveVars.includes(key)) {
                warnings.push(`${key} appears to be too short for a secure value`);
            }
        }
        
        // Display results
        if (warnings.length > 0) {
            console.log('⚠️  Warnings:');
            warnings.forEach(warning => console.log(`   - ${warning}`));
        }
        
        if (issues.length > 0) {
            console.error('❌ Validation errors:');
            issues.forEach(issue => console.error(`   - ${issue}`));
            throw new Error('Environment validation failed');
        }
        
        console.log('✅ Environment validation passed');
        return { issues, warnings };
    }

    async backupCurrentVars(railwayVars) {
        if (!this.config.backupEnv) return;
        
        console.log('💾 Backing up current Railway variables...');
        
        const backupData = {
            timestamp: new Date().toISOString(),
            environment: this.config.environment,
            projectId: this.config.projectId,
            variables: railwayVars
        };
        
        const backupFile = path.join(__dirname, `../logs/railway-env-backup-${Date.now()}.json`);
        
        try {
            // Ensure logs directory exists
            const logsDir = path.join(__dirname, '../logs');
            await fs.mkdir(logsDir, { recursive: true });
            
            await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            console.log(`✅ Backup saved: ${backupFile}`);
        } catch (error) {
            console.warn('⚠️  Failed to save backup:', error.message);
        }
    }

    async setRailwayVars(envVars) {
        console.log('🚀 Setting Railway variables...');
        
        const results = [];
        let successful = 0;
        let failed = 0;
        
        for (const [key, value] of Object.entries(envVars)) {
            if (!key || !value) continue;
            
            try {
                console.log(`🔄 Setting ${key}...`);
                
                // Escape special characters in value
                const escapedValue = value.replace(/"/g, '\\"');
                
                execSync(`railway variables set ${key}="${escapedValue}"`, { 
                    stdio: 'ignore',
                    timeout: 10000
                });
                
                const displayValue = this.sensitiveVars.includes(key) 
                    ? '*'.repeat(8) 
                    : value.length > 50 
                        ? value.substring(0, 47) + '...' 
                        : value;
                
                console.log(`✅ ${key} = ${displayValue}`);
                results.push({ key, success: true });
                successful++;
                
            } catch (error) {
                console.error(`❌ Failed to set ${key}: ${error.message}`);
                results.push({ key, success: false, error: error.message });
                failed++;
            }
        }
        
        console.log('');
        console.log('📊 Summary:');
        console.log(`   ✅ Successful: ${successful}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📝 Total: ${results.length}`);
        
        if (failed > 0) {
            console.log('');
            console.log('❌ Failed variables:');
            results
                .filter(r => !r.success)
                .forEach(r => console.log(`   - ${r.key}: ${r.error}`));
        }
        
        return results;
    }

    async generateEnvTemplate() {
        console.log('📝 Generating environment template...');
        
        const template = `# Railway Environment Variables for POS Conejo Negro
# Generated on ${new Date().toISOString()}

# === REQUIRED VARIABLES ===
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your_super_secret_jwt_key_here
PORT=3000

# === OPTIONAL VARIABLES ===
REDIS_URL=redis://username:password@host:port
MONGODB_URI=mongodb://username:password@host:port/database

# === RAILWAY CONFIGURATION ===
RAILWAY_PROJECT_ID=${this.config.projectId || 'your_project_id_here'}
RAILWAY_TOKEN=${this.config.token ? '*'.repeat(20) : 'your_railway_token_here'}

# === APPLICATION SPECIFIC ===
# Add your application-specific variables here
ADMIN_EMAIL=admin@example.com
LOG_LEVEL=info
MAX_FILE_SIZE=10485760

# === NOTES ===
# - Replace all placeholder values with actual values
# - Keep sensitive information secure
# - Update this file when adding new environment variables
`;
        
        const templateFile = path.join(__dirname, '../.env.railway.template');
        
        try {
            await fs.writeFile(templateFile, template);
            console.log(`✅ Template saved: ${templateFile}`);
        } catch (error) {
            console.warn('⚠️  Failed to save template:', error.message);
        }
    }

    async setupEnvironment() {
        try {
            await this.init();
            
            // Read local environment file
            const envVars = await this.readEnvFile();
            
            if (Object.keys(envVars).length === 0) {
                console.log('📝 No environment variables found locally.');
                console.log('💡 Generating template...');
                await this.generateEnvTemplate();
                console.log('');
                console.log('Please update the template file with your values and run this script again.');
                return false;
            }
            
            // Validate environment variables
            if (this.config.validateVars) {
                await this.validateEnvironmentVars(envVars);
            }
            
            // Get current Railway variables for backup
            const railwayVars = await this.getCurrentRailwayVars();
            await this.backupCurrentVars(railwayVars);
            
            // Set variables in Railway
            const results = await this.setRailwayVars(envVars);
            
            // Generate report
            const report = {
                timestamp: new Date().toISOString(),
                environment: this.config.environment,
                projectId: this.config.projectId,
                totalVars: Object.keys(envVars).length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results: results
            };
            
            const reportFile = path.join(__dirname, `../logs/railway-env-setup-${Date.now()}.json`);
            
            try {
                await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
                console.log(`📄 Report saved: ${reportFile}`);
            } catch (error) {
                console.warn('⚠️  Failed to save report:', error.message);
            }
            
            console.log('');
            console.log('🎉 Environment setup completed!');
            console.log(`✅ ${report.successful} variables configured successfully`);
            
            if (report.failed > 0) {
                console.log(`⚠️  ${report.failed} variables failed to configure`);
                return false;
            }
            
            return true;
            
        } catch (error) {
            console.error('💥 Environment setup failed:', error.message);
            return false;
        }
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const config = {};
    
    // Parse command line arguments
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i]?.replace(/^--/, '');
        const value = args[i + 1];
        if (key && value) {
            config[key] = value;
        }
    }
    
    // Handle boolean flags
    if (args.includes('--no-validate')) {
        config.validateVars = false;
    }
    
    if (args.includes('--no-backup')) {
        config.backupEnv = false;
    }
    
    const envSetup = new RailwayEnvSetup(config);
    envSetup.setupEnvironment()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('Fatal error:', error.message);
            process.exit(1);
        });
}

module.exports = RailwayEnvSetup;