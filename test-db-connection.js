#!/usr/bin/env node

/**
 * PostgreSQL Connection Diagnostic Tool for Railway
 * 
 * This script tests PostgreSQL connection with various configurations
 * to debug connection issues between Railway and the application.
 */

const { Pool } = require('pg');
require('dotenv').config();

class PostgreSQLDiagnostic {
    constructor() {
        this.testResults = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '✅',
            'error': '❌',
            'warn': '⚠️',
            'debug': '🔍'
        }[type] || 'ℹ️';
        
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async testConnectionString(connectionString, description) {
        this.log(`Testing connection: ${description}`, 'debug');
        
        const pool = new Pool({
            connectionString: connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            max: 1
        });

        try {
            // Test basic connection
            const client = await pool.connect();
            this.log(`✓ Connection successful: ${description}`, 'info');
            
            // Test basic query
            const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
            this.log(`✓ Query successful: ${result.rows[0].current_time}`, 'info');
            this.log(`✓ PostgreSQL version: ${result.rows[0].pg_version}`, 'info');
            
            // Test table creation (if database allows)
            try {
                await client.query('CREATE TABLE IF NOT EXISTS connection_test (id SERIAL PRIMARY KEY, test_time TIMESTAMP DEFAULT NOW())');
                await client.query('INSERT INTO connection_test DEFAULT VALUES');
                const testResult = await client.query('SELECT COUNT(*) as test_count FROM connection_test');
                this.log(`✓ Table operations successful, test records: ${testResult.rows[0].test_count}`, 'info');
                await client.query('DROP TABLE connection_test');
                this.log(`✓ Cleanup successful`, 'info');
            } catch (tableError) {
                this.log(`⚠️ Table operations failed (might be permissions): ${tableError.message}`, 'warn');
            }
            
            client.release();
            this.testResults.push({
                description,
                status: 'success',
                connectionString: this.maskConnectionString(connectionString)
            });
            
            return true;
        } catch (error) {
            this.log(`✗ Connection failed: ${description}`, 'error');
            this.log(`Error: ${error.message}`, 'error');
            this.log(`Error code: ${error.code}`, 'error');
            
            this.testResults.push({
                description,
                status: 'failed',
                error: error.message,
                errorCode: error.code,
                connectionString: this.maskConnectionString(connectionString)
            });
            
            return false;
        } finally {
            await pool.end();
        }
    }

    maskConnectionString(connectionString) {
        if (!connectionString) return 'undefined';
        return connectionString.replace(/:([^:@]+)@/, ':***@');
    }

    async runDiagnostics() {
        this.log('Starting PostgreSQL Connection Diagnostics', 'info');
        this.log('=' * 60, 'info');
        
        // Check environment variables
        this.log('Environment Variables:', 'debug');
        this.log(`NODE_ENV: ${process.env.NODE_ENV}`, 'debug');
        this.log(`RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`, 'debug');
        this.log(`DATABASE_URL present: ${!!process.env.DATABASE_URL}`, 'debug');
        
        if (process.env.DATABASE_URL) {
            this.log(`DATABASE_URL (masked): ${this.maskConnectionString(process.env.DATABASE_URL)}`, 'debug');
        }

        // Test 1: Environment DATABASE_URL
        if (process.env.DATABASE_URL) {
            await this.testConnectionString(
                process.env.DATABASE_URL, 
                'Environment DATABASE_URL'
            );
        } else {
            this.log('DATABASE_URL not found in environment variables', 'warn');
        }

        // Test 2: Hardcoded Railway connection (from server.js)
        const railwayConnectionString = 'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway';
        await this.testConnectionString(
            railwayConnectionString,
            'Hardcoded Railway Connection String'
        );

        // Test 3: Alternative Railway formats
        const alternativeConnections = [
            'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/postgres',
            'postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@localhost:5432/railway',
            'postgres://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway'
        ];

        for (let i = 0; i < alternativeConnections.length; i++) {
            await this.testConnectionString(
                alternativeConnections[i],
                `Alternative Connection ${i + 1}`
            );
        }

        // Test 4: Connection with explicit SSL settings
        if (process.env.DATABASE_URL) {
            const pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: {
                    rejectUnauthorized: false,
                    require: true
                }
            });

            try {
                const client = await pool.connect();
                client.release();
                await pool.end();
                this.log('✓ SSL connection successful', 'info');
            } catch (error) {
                this.log(`✗ SSL connection failed: ${error.message}`, 'error');
            }
        }

        // Generate final report
        this.generateReport();
    }

    generateReport() {
        this.log('=' * 60, 'info');
        this.log('DIAGNOSTIC REPORT', 'info');
        this.log('=' * 60, 'info');

        const successful = this.testResults.filter(r => r.status === 'success');
        const failed = this.testResults.filter(r => r.status === 'failed');

        this.log(`Total tests: ${this.testResults.length}`, 'info');
        this.log(`Successful: ${successful.length}`, 'info');
        this.log(`Failed: ${failed.length}`, 'info');

        if (successful.length > 0) {
            this.log('\n🎉 WORKING CONNECTIONS:', 'info');
            successful.forEach(result => {
                this.log(`  ✓ ${result.description}`, 'info');
                this.log(`    Connection: ${result.connectionString}`, 'debug');
            });
        }

        if (failed.length > 0) {
            this.log('\n💥 FAILED CONNECTIONS:', 'error');
            failed.forEach(result => {
                this.log(`  ✗ ${result.description}`, 'error');
                this.log(`    Error: ${result.error}`, 'error');
                if (result.errorCode) {
                    this.log(`    Error Code: ${result.errorCode}`, 'error');
                }
                this.log(`    Connection: ${result.connectionString}`, 'debug');
            });
        }

        // Recommendations
        this.log('\n📋 RECOMMENDATIONS:', 'info');
        
        if (successful.length === 0) {
            this.log('  • No connections worked. Check Railway PostgreSQL addon status', 'warn');
            this.log('  • Verify DATABASE_URL is correctly set in Railway variables', 'warn');
            this.log('  • Check if PostgreSQL service is running in Railway', 'warn');
        } else {
            this.log('  • Use the working connection string in your application', 'info');
            this.log('  • Ensure SSL settings match the working configuration', 'info');
        }
    }
}

// Run diagnostics if called directly
if (require.main === module) {
    const diagnostic = new PostgreSQLDiagnostic();
    diagnostic.runDiagnostics()
        .then(() => {
            console.log('\n🏁 Diagnostics completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Diagnostic failed:', error);
            process.exit(1);
        });
}

module.exports = PostgreSQLDiagnostic;