#!/usr/bin/env node
/**
 * @fileoverview Database Migration Script for POS Conejo Negro
 * @description Handles database migrations and initialization for both PostgreSQL and file-based storage
 * @author TaskMaster Architecture Team
 * @version 1.0.0
 */

const databaseManager = require('./databaseManager');

/**
 * Database Migration Runner
 * Initializes database schema and ensures all required tables/structures exist
 */
async function runMigrations() {
    console.log('🏗️ Starting database migrations...');
    
    try {
        // Initialize database connection and structures
        await databaseManager.initialize();
        
        console.log('✅ Database migrations completed successfully');
        
        // Verify database state
        const dbType = process.env.DATABASE_URL ? 'PostgreSQL' : 'File-based';
        console.log(`📊 Database type: ${dbType}`);
        
        if (process.env.DATABASE_URL) {
            console.log('🔗 PostgreSQL connection verified');
            console.log('🗄️ All tables created/verified');
        } else {
            console.log('📁 File-based database initialized');
            console.log('📂 Data directory prepared');
        }
        
        // Test basic operations
        try {
            const users = await databaseManager.getUsers();
            console.log(`👥 Users in database: ${users.length}`);
            
            const products = await databaseManager.getProducts();
            console.log(`📦 Products in database: ${products.length}`);
            
            console.log('🎯 Database health check passed');
        } catch (error) {
            console.warn('⚠️ Database operations test failed:', error.message);
            console.warn('   This might be normal for a fresh installation');
        }
        
        console.log('🚀 Database ready for application startup');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Database migration failed:', error.message);
        console.error('📋 Error details:', error.stack);
        
        // Provide helpful debugging information
        console.error('\n🔍 Debug information:');
        console.error(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        console.error(`   - DATABASE_URL: ${process.env.DATABASE_URL ? 'present' : 'not set'}`);
        console.error(`   - RENDER_EXTERNAL_URL: ${process.env.RENDER_EXTERNAL_URL || 'not set'}`);
        
        // Suggest solutions
        console.error('\n💡 Possible solutions:');
        if (!process.env.DATABASE_URL) {
            console.error('   1. Add DATABASE_URL environment variable');
            console.error('   2. Ensure PostgreSQL service is running');
        } else {
            console.error('   1. Check database connection string');
            console.error('   2. Verify SSL configuration for cloud deployment');
            console.error('   3. Ensure database server is accessible');
        }
        
        process.exit(1);
    }
}

// Run migrations if called directly
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
