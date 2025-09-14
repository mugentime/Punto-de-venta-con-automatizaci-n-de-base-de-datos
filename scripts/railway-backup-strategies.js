#!/usr/bin/env node

/**
 * @fileoverview Railway Backup Deployment Strategies
 * @description Alternative deployment configurations for Railway resilience
 * @version 1.0.0
 * @author TaskMaster Backup Strategy Agent
 * @created 2025-01-15
 */

const fs = require('fs').promises;
const path = require('path');

class RailwayBackupStrategies {
    constructor() {
        this.projectId = 'fed11c6d-a65a-4d93-90e6-955e16b6753f';
        this.baseDir = 'C:\\Users\\je2al\\Desktop\\POS-CONEJONEGRO';
        this.strategies = [];
        this.timestamp = new Date().toISOString();
    }

    /**
     * Generate All Backup Deployment Strategies
     */
    async generateBackupStrategies() {
        console.log('🔄 RAILWAY BACKUP STRATEGIES GENERATOR');
        console.log(`📊 Project ID: ${this.projectId}`);
        console.log('=====================================\n');

        // Generate multiple deployment strategies
        await Promise.all([
            this.generateNixpacksStrategy(),
            this.generateDockerfileStrategy(),
            this.generateNodejsStrategy(),
            this.generateMinimalStrategy(),
            this.generateProductionStrategy()
        ]);

        // Generate strategy comparison
        await this.generateStrategyComparison();
        
        // Generate deployment scripts for each strategy
        await this.generateDeploymentScripts();

        console.log(`🛡️  Generated ${this.strategies.length} backup strategies`);
        console.log('📋 Use any strategy if main deployment fails');
    }

    /**
     * Strategy 1: Nixpacks (Railway's Default)
     */
    async generateNixpacksStrategy() {
        const strategy = {
            name: 'nixpacks',
            description: 'Railway Nixpacks auto-detection (recommended)',
            config: {
                "$schema": "https://railway.app/railway.schema.json",
                "build": {
                    "builder": "nixpacks"
                },
                "deploy": {
                    "startCommand": "npm start",
                    "restartPolicyType": "on_failure",
                    "healthcheckPath": "/api/health"
                }
            },
            pros: [
                'Automatic dependency detection',
                'Faster build times',
                'Railway optimized',
                'Less configuration required'
            ],
            cons: [
                'Less control over build process',
                'May not work with complex setups'
            ],
            environmentVariables: {
                NODE_ENV: 'production',
                PORT: '3000',
                RAILWAY_ENVIRONMENT: 'true'
            }
        };

        await this.saveStrategy(strategy);
        console.log('✅ Generated Nixpacks strategy');
    }

    /**
     * Strategy 2: Dockerfile with Optimization
     */
    async generateDockerfileStrategy() {
        const dockerfile = `# Railway Dockerfile Strategy
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy app source
COPY . .

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]
`;

        const strategy = {
            name: 'dockerfile',
            description: 'Custom Dockerfile with Alpine Linux',
            config: {
                "$schema": "https://railway.app/railway.schema.json",
                "build": {
                    "builder": "dockerfile",
                    "dockerfilePath": "Dockerfile"
                },
                "deploy": {
                    "startCommand": "npm start",
                    "restartPolicyType": "on_failure",
                    "healthcheckPath": "/api/health"
                }
            },
            dockerfile,
            pros: [
                'Full control over build process',
                'Optimized image size with Alpine',
                'Security with non-root user',
                'Built-in health checks'
            ],
            cons: [
                'More complex configuration',
                'Requires Dockerfile maintenance'
            ],
            environmentVariables: {
                NODE_ENV: 'production',
                PORT: '3000',
                RAILWAY_ENVIRONMENT: 'true'
            }
        };

        await this.saveStrategy(strategy);
        console.log('✅ Generated Dockerfile strategy');
    }

    /**
     * Strategy 3: Pure Node.js Strategy
     */
    async generateNodejsStrategy() {
        const strategy = {
            name: 'nodejs',
            description: 'Simple Node.js deployment without Docker',
            config: {
                "$schema": "https://railway.app/railway.schema.json",
                "build": {
                    "builder": "nixpacks",
                    "nixpacksConfig": {
                        "providers": ["node"]
                    }
                },
                "deploy": {
                    "startCommand": "node server.js",
                    "restartPolicyType": "always",
                    "healthcheckPath": "/api/health",
                    "healthcheckTimeout": 30
                }
            },
            packageJsonModifications: {
                scripts: {
                    start: "node server.js",
                    "start:prod": "NODE_ENV=production node server.js"
                },
                engines: {
                    node: ">=18.0.0"
                }
            },
            pros: [
                'Simplest deployment method',
                'Fast startup time',
                'Direct Node.js execution',
                'Minimal overhead'
            ],
            cons: [
                'Less isolation',
                'Fewer optimization options'
            ],
            environmentVariables: {
                NODE_ENV: 'production',
                PORT: '3000',
                RAILWAY_ENVIRONMENT: 'true'
            }
        };

        await this.saveStrategy(strategy);
        console.log('✅ Generated Node.js strategy');
    }

    /**
     * Strategy 4: Minimal Configuration
     */
    async generateMinimalStrategy() {
        const strategy = {
            name: 'minimal',
            description: 'Minimal configuration for emergency deployment',
            config: {
                "$schema": "https://railway.app/railway.schema.json",
                "deploy": {
                    "startCommand": "npm start"
                }
            },
            packageJsonMinimal: {
                name: "pos-conejo-negro",
                version: "1.0.0",
                main: "server.js",
                scripts: {
                    start: "node server.js"
                },
                dependencies: {
                    express: "^4.18.2",
                    cors: "^2.8.5",
                    dotenv: "^16.3.1"
                },
                engines: {
                    node: "18.x"
                }
            },
            pros: [
                'Minimal configuration',
                'Fast deployment',
                'Emergency fallback',
                'Reduced complexity'
            ],
            cons: [
                'No health checks',
                'Basic security',
                'Limited monitoring'
            ],
            environmentVariables: {
                NODE_ENV: 'production',
                PORT: '3000'
            }
        };

        await this.saveStrategy(strategy);
        console.log('✅ Generated Minimal strategy');
    }

    /**
     * Strategy 5: Production-Hardened
     */
    async generateProductionStrategy() {
        const strategy = {
            name: 'production',
            description: 'Production-hardened deployment with all optimizations',
            config: {
                "$schema": "https://railway.app/railway.schema.json",
                "build": {
                    "builder": "dockerfile",
                    "dockerfilePath": "Dockerfile.production"
                },
                "deploy": {
                    "startCommand": "npm run start:prod",
                    "restartPolicyType": "on_failure",
                    "healthcheckPath": "/api/health",
                    "healthcheckTimeout": 30,
                    "numReplicas": 1
                }
            },
            productionDockerfile: `# Production Dockerfile for Railway
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app directory and user
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Set ownership and permissions
RUN chown -R appuser:appgroup /app
RUN chmod -R 755 /app

USER appuser

# Expose port
EXPOSE 3000

# Health check with retry logic
HEALTHCHECK --interval=30s --timeout=15s --start-period=10s --retries=5 \\
    CMD node -e "require('http').get('http://localhost:3000/api/health', {timeout: 10000}, (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
`,
            packageJsonProduction: {
                scripts: {
                    "start:prod": "NODE_ENV=production node --max-old-space-size=512 server.js",
                    "health-check": "node -e \"require('http').get('http://localhost:3000/api/health', res => process.exit(res.statusCode === 200 ? 0 : 1))\""
                }
            },
            pros: [
                'Maximum security',
                'Optimized performance',
                'Robust health checks',
                'Signal handling',
                'Memory optimization'
            ],
            cons: [
                'Complex configuration',
                'Longer build times',
                'More resource usage'
            ],
            environmentVariables: {
                NODE_ENV: 'production',
                PORT: '3000',
                RAILWAY_ENVIRONMENT: 'true',
                LOG_LEVEL: 'info',
                ENABLE_HEALTH_CHECKS: 'true'
            }
        };

        await this.saveStrategy(strategy);
        console.log('✅ Generated Production strategy');
    }

    /**
     * Save Strategy to File System
     */
    async saveStrategy(strategy) {
        this.strategies.push(strategy);
        
        const strategyDir = path.join(this.baseDir, 'strategies', strategy.name);
        await fs.mkdir(strategyDir, { recursive: true });
        
        // Save railway.json
        const railwayConfigPath = path.join(strategyDir, 'railway.json');
        await fs.writeFile(railwayConfigPath, JSON.stringify(strategy.config, null, 2));
        
        // Save Dockerfile if provided
        if (strategy.dockerfile) {
            const dockerfilePath = path.join(strategyDir, 'Dockerfile');
            await fs.writeFile(dockerfilePath, strategy.dockerfile);
        }
        
        if (strategy.productionDockerfile) {
            const dockerfilePath = path.join(strategyDir, 'Dockerfile.production');
            await fs.writeFile(dockerfilePath, strategy.productionDockerfile);
        }
        
        // Save package.json modifications
        if (strategy.packageJsonModifications || strategy.packageJsonMinimal || strategy.packageJsonProduction) {
            const packagePath = path.join(strategyDir, 'package.json.template');
            const packageData = strategy.packageJsonMinimal || strategy.packageJsonModifications || strategy.packageJsonProduction;
            await fs.writeFile(packagePath, JSON.stringify(packageData, null, 2));
        }
        
        // Save environment variables
        if (strategy.environmentVariables) {
            const envPath = path.join(strategyDir, '.env.template');
            const envContent = Object.entries(strategy.environmentVariables)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            await fs.writeFile(envPath, envContent);
        }
        
        // Save strategy documentation
        const docPath = path.join(strategyDir, 'README.md');
        const documentation = `# ${strategy.name.toUpperCase()} Strategy

${strategy.description}

## Pros
${strategy.pros.map(pro => `- ${pro}`).join('\n')}

## Cons
${strategy.cons.map(con => `- ${con}`).join('\n')}

## Environment Variables
${Object.entries(strategy.environmentVariables || {}).map(([key, value]) => `- ${key}=${value}`).join('\n')}

## Deployment
1. Copy railway.json to project root
2. Set environment variables in Railway dashboard
3. Deploy with: \`railway up\`

## Files
- \`railway.json\` - Railway configuration
- \`.env.template\` - Environment variables template
${strategy.dockerfile ? '- `Dockerfile` - Docker configuration\n' : ''}${strategy.packageJsonModifications ? '- `package.json.template` - Package.json modifications\n' : ''}

Generated by Railway Backup Strategies Generator on ${this.timestamp}
`;
        await fs.writeFile(docPath, documentation);
    }

    /**
     * Generate Strategy Comparison
     */
    async generateStrategyComparison() {
        const comparison = {
            timestamp: this.timestamp,
            projectId: this.projectId,
            totalStrategies: this.strategies.length,
            strategies: this.strategies.map(s => ({
                name: s.name,
                description: s.description,
                complexity: s.name === 'minimal' ? 'Low' : s.name === 'production' ? 'High' : 'Medium',
                recommendedFor: this.getRecommendedFor(s.name),
                deploymentSpeed: this.getDeploymentSpeed(s.name),
                reliability: this.getReliability(s.name)
            })),
            recommendations: [
                'Try strategies in order of complexity: minimal → nodejs → nixpacks → dockerfile → production',
                'Use minimal strategy for emergency deployment',
                'Use production strategy for final deployment',
                'Monitor deployment logs for each strategy attempt'
            ],
            usageInstructions: [
                '1. Choose a strategy based on your needs',
                '2. Copy strategy files to project root',
                '3. Set environment variables in Railway dashboard',
                '4. Deploy using: railway up',
                '5. Monitor deployment status',
                '6. Try next strategy if deployment fails'
            ]
        };

        const comparisonPath = path.join(this.baseDir, 'strategies', 'strategy-comparison.json');
        await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2));
        
        console.log('📊 Generated strategy comparison');
    }

    /**
     * Get Recommended Use Cases for Strategy
     */
    getRecommendedFor(strategyName) {
        const recommendations = {
            minimal: 'Emergency deployment, quick testing',
            nodejs: 'Simple applications, development',
            nixpacks: 'Standard deployment, Railway default',
            dockerfile: 'Custom requirements, advanced configuration',
            production: 'Production systems, maximum reliability'
        };
        return recommendations[strategyName] || 'General use';
    }

    /**
     * Get Deployment Speed Rating
     */
    getDeploymentSpeed(strategyName) {
        const speeds = {
            minimal: 'Fastest',
            nodejs: 'Fast', 
            nixpacks: 'Medium',
            dockerfile: 'Slow',
            production: 'Slowest'
        };
        return speeds[strategyName] || 'Medium';
    }

    /**
     * Get Reliability Rating
     */
    getReliability(strategyName) {
        const reliability = {
            minimal: 'Basic',
            nodejs: 'Good',
            nixpacks: 'Very Good', 
            dockerfile: 'Excellent',
            production: 'Maximum'
        };
        return reliability[strategyName] || 'Good';
    }

    /**
     * Generate Deployment Scripts for Each Strategy
     */
    async generateDeploymentScripts() {
        const masterScript = `#!/usr/bin/env node

/**
 * Railway Strategy Deployment Script
 * Auto-generated by Railway Backup Strategies Generator
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const STRATEGIES = ${JSON.stringify(this.strategies.map(s => s.name), null, 2)};
const PROJECT_ID = '${this.projectId}';

class StrategyDeployer {
    constructor() {
        this.currentStrategy = 0;
        this.maxRetries = 3;
    }

    async deployWithStrategy(strategyName) {
        console.log(\`🚀 Deploying with \${strategyName} strategy...\`);
        
        try {
            // Copy strategy files to project root
            const strategyDir = path.join(__dirname, '..', 'strategies', strategyName);
            const railwayConfigSource = path.join(strategyDir, 'railway.json');
            const railwayConfigTarget = path.join(__dirname, '..', 'railway.json');
            
            if (fs.existsSync(railwayConfigSource)) {
                fs.copyFileSync(railwayConfigSource, railwayConfigTarget);
                console.log('✅ Copied railway.json configuration');
            }
            
            // Copy Dockerfile if exists
            const dockerfileSource = path.join(strategyDir, 'Dockerfile');
            const dockerfileTarget = path.join(__dirname, '..', 'Dockerfile');
            
            if (fs.existsSync(dockerfileSource)) {
                fs.copyFileSync(dockerfileSource, dockerfileTarget);
                console.log('✅ Copied Dockerfile');
            }
            
            // Deploy
            console.log('🚂 Starting Railway deployment...');
            const { stdout, stderr } = await execAsync('railway up --detach', {
                cwd: path.join(__dirname, '..')
            });
            
            console.log('✅ Deployment completed successfully!');
            console.log('Output:', stdout);
            
            return { success: true, output: stdout };
            
        } catch (error) {
            console.log(\`❌ \${strategyName} strategy failed: \${error.message}\`);
            return { success: false, error: error.message };
        }
    }

    async tryAllStrategies() {
        console.log('🔄 RAILWAY STRATEGY DEPLOYMENT');
        console.log('============================');
        console.log(\`📊 Available strategies: \${STRATEGIES.length}\`);
        console.log(\`🎯 Project ID: \${PROJECT_ID}\\n\`);
        
        for (const strategy of STRATEGIES) {
            const result = await this.deployWithStrategy(strategy);
            
            if (result.success) {
                console.log(\`\\n🎉 SUCCESS! Deployed using \${strategy} strategy\`);
                return { success: true, strategy, result };
            }
            
            console.log(\`❌ \${strategy} failed, trying next strategy...\\n\`);
        }
        
        console.log('❌ All strategies failed. Manual intervention required.');
        return { success: false, message: 'All strategies exhausted' };
    }

    async deploySpecific(strategyName) {
        if (!STRATEGIES.includes(strategyName)) {
            console.log(\`❌ Unknown strategy: \${strategyName}\`);
            console.log(\`Available: \${STRATEGIES.join(', ')}\`);
            return;
        }
        
        return await this.deployWithStrategy(strategyName);
    }
}

// Command line usage
if (require.main === module) {
    const deployer = new StrategyDeployer();
    
    const strategy = process.argv[2];
    
    if (strategy) {
        deployer.deploySpecific(strategy).catch(console.error);
    } else {
        deployer.tryAllStrategies().catch(console.error);
    }
}

module.exports = { StrategyDeployer };
`;

        const scriptPath = path.join(this.baseDir, 'scripts', 'strategy-deployer.js');
        await fs.writeFile(scriptPath, masterScript);
        
        console.log('🚀 Generated master deployment script');
        console.log('Usage: node scripts/strategy-deployer.js [strategy-name]');
    }
}

// Execute if run directly
if (require.main === module) {
    const generator = new RailwayBackupStrategies();
    generator.generateBackupStrategies().catch(console.error);
}

module.exports = { RailwayBackupStrategies };