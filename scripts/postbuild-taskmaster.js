#!/usr/bin/env node
/**
 * @fileoverview Post-Build TaskMaster Information Generator
 * @description Generates build-info.json with TaskMaster verification and deployment metadata
 * @author TaskMaster Architecture Team
 * @version 1.0.0
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * TaskMaster Build Information Generator
 * Creates comprehensive build information for deployment verification
 */
async function generateBuildInfo() {
    console.log('🏗️ TaskMaster Post-Build: Generating build information...');
    
    try {
        const buildTime = new Date().toISOString();
        const packageInfo = JSON.parse(await fs.readFile('package.json', 'utf8'));
        
        // Collect TaskMaster file information
        const taskMasterFiles = [];
        const buildFiles = [];
        
        // Check TaskMaster configuration files
        const taskMasterPaths = [
            'taskmaster.config.json',
            '.taskmaster/',
            'utils/databaseManager.js',
            'utils/migrate.js',
            'scripts/postbuild-taskmaster.js'
        ];
        
        for (const filePath of taskMasterPaths) {
            try {
                const stats = await fs.stat(filePath);
                taskMasterFiles.push({
                    path: filePath,
                    exists: true,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    type: stats.isDirectory() ? 'directory' : 'file'
                });
            } catch (error) {
                taskMasterFiles.push({
                    path: filePath,
                    exists: false,
                    error: error.code
                });
            }
        }
        
        // Check critical build files
        const buildPaths = [
            'server.js',
            'package.json',
            'utils/database.js',
            'routes/',
            'public/'
        ];
        
        for (const filePath of buildPaths) {
            try {
                const stats = await fs.stat(filePath);
                buildFiles.push({
                    path: filePath,
                    exists: true,
                    size: stats.size,
                    modified: stats.mtime.toISOString(),
                    type: stats.isDirectory() ? 'directory' : 'file'
                });
            } catch (error) {
                buildFiles.push({
                    path: filePath,
                    exists: false,
                    error: error.code
                });
            }
        }
        
        // Generate comprehensive build info
        const buildInfo = {
            // Build metadata
            build: {
                timestamp: buildTime,
                version: packageInfo.version,
                name: packageInfo.name,
                commit: process.env.RENDER_GIT_COMMIT || process.env.RAILWAY_GIT_COMMIT || 'unknown',
                branch: process.env.RENDER_GIT_BRANCH || process.env.RAILWAY_GIT_BRANCH || 'unknown',
                serviceId: process.env.RENDER_SERVICE_ID || process.env.RAILWAY_SERVICE_ID || 'local',
                environment: process.env.NODE_ENV || 'development'
            },
            
            // Platform information
            platform: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                render: !!process.env.RENDER_EXTERNAL_URL,
                railway: !!process.env.RAILWAY_ENVIRONMENT
            },
            
            // TaskMaster verification
            taskMaster: {
                enabled: true,
                architect: 'primary',
                configPresent: taskMasterFiles.find(f => f.path === 'taskmaster.config.json')?.exists || false,
                files: taskMasterFiles.filter(f => f.exists),
                integrityCheck: taskMasterFiles.filter(f => f.exists).length > 0
            },
            
            // Database configuration
            database: {
                type: process.env.DATABASE_URL ? 'postgresql' : 'file-based',
                hasUrl: !!process.env.DATABASE_URL,
                migrationScript: buildFiles.find(f => f.path === 'utils/migrate.js')?.exists || false,
                ssl: process.env.NODE_ENV === 'production' || !!process.env.RENDER_EXTERNAL_URL
            },
            
            // Application files
            application: {
                files: buildFiles,
                serverExists: buildFiles.find(f => f.path === 'server.js')?.exists || false,
                routesExists: buildFiles.find(f => f.path === 'routes/')?.exists || false,
                publicExists: buildFiles.find(f => f.path === 'public/')?.exists || false
            },
            
            // Health check information
            health: {
                endpoints: ['/api/health', '/api/version'],
                expectedDatabase: process.env.DATABASE_URL ? 'postgresql' : 'file-based',
                securityHeaders: true
            }
        };
        
        // Ensure public directory exists
        await fs.mkdir('public', { recursive: true });
        
        // Write build info to public directory
        const buildInfoPath = path.join('public', 'build-info.json');
        await fs.writeFile(buildInfoPath, JSON.stringify(buildInfo, null, 2), 'utf8');
        
        console.log('✅ TaskMaster Build Info Generated:');
        console.log(`   📄 File: ${buildInfoPath}`);
        console.log(`   🏗️ Build: ${buildTime}`);
        console.log(`   🔧 TaskMaster: ${buildInfo.taskMaster.integrityCheck ? 'VERIFIED' : 'MISSING'}`);
        console.log(`   🗄️ Database: ${buildInfo.database.type}`);
        console.log(`   🚀 Platform: ${buildInfo.platform.render ? 'Render' : buildInfo.platform.railway ? 'Railway' : 'Local'}`);
        
        // Also create a summary for logs
        const summary = {
            timestamp: buildTime,
            version: packageInfo.version,
            commit: buildInfo.build.commit,
            taskMasterVerified: buildInfo.taskMaster.integrityCheck,
            databaseType: buildInfo.database.type,
            platform: buildInfo.platform.render ? 'render' : buildInfo.platform.railway ? 'railway' : 'local'
        };
        
        console.log('\n📋 Build Summary:', JSON.stringify(summary, null, 2));
        
    } catch (error) {
        console.error('❌ TaskMaster Post-Build failed:', error.message);
        console.error('📋 Error details:', error.stack);
        
        // Create minimal build info even if there's an error
        const minimalBuildInfo = {
            build: {
                timestamp: new Date().toISOString(),
                error: error.message,
                status: 'partial'
            },
            taskMaster: {
                enabled: true,
                status: 'error'
            }
        };
        
        try {
            await fs.mkdir('public', { recursive: true });
            await fs.writeFile(
                path.join('public', 'build-info.json'), 
                JSON.stringify(minimalBuildInfo, null, 2), 
                'utf8'
            );
            console.log('⚠️ Minimal build info created despite errors');
        } catch (writeError) {
            console.error('❌ Failed to create even minimal build info:', writeError.message);
        }
        
        // Don't exit with error for build compatibility
        console.log('⚠️ Continuing build despite post-build script issues');
    }
}

// Run if called directly
if (require.main === module) {
    generateBuildInfo();
}

module.exports = { generateBuildInfo };
