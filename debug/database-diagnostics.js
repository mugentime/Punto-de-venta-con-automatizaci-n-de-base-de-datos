const { Pool } = require('pg');

/**
 * DATABASE DIAGNOSTICS AGENT
 * Comprehensive Railway PostgreSQL connection diagnostics
 */
class DatabaseDiagnostics {
    constructor() {
        this.diagnostics = {
            timestamp: new Date().toISOString(),
            environment: {},
            connectionTests: [],
            findings: [],
            recommendations: []
        };
    }

    async runDiagnostics() {
        console.log('🔍 DATABASE DIAGNOSTICS AGENT: Starting comprehensive PostgreSQL diagnostics...');
        
        // Step 1: Environment Analysis
        await this.analyzeEnvironment();
        
        // Step 2: Connection String Validation
        await this.validateConnectionString();
        
        // Step 3: Network Connectivity Tests
        await this.testConnectivity();
        
        // Step 4: Pool Configuration Analysis
        await this.analyzePoolConfig();
        
        // Step 5: SSL/TLS Configuration Check
        await this.checkSSLConfig();
        
        return this.diagnostics;
    }

    async analyzeEnvironment() {
        console.log('📊 Analyzing environment variables...');
        
        this.diagnostics.environment = {
            DATABASE_URL: !!process.env.DATABASE_URL,
            DATABASE_URL_length: process.env.DATABASE_URL?.length || 0,
            RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'not_set',
            NODE_ENV: process.env.NODE_ENV || 'not_set',
            RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN || 'not_set',
            RAILWAY_PRIVATE_DOMAIN: process.env.RAILWAY_PRIVATE_DOMAIN || 'not_set',
            RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID || 'not_set',
            RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID || 'not_set'
        };

        if (!process.env.DATABASE_URL) {
            this.diagnostics.findings.push({
                severity: 'CRITICAL',
                issue: 'DATABASE_URL environment variable is not set',
                impact: 'Application will fallback to file storage instead of PostgreSQL',
                solution: 'Check Railway PostgreSQL addon configuration and environment variables'
            });
        }

        console.log('📋 Environment analysis complete');
    }

    async validateConnectionString() {
        console.log('🔗 Validating DATABASE_URL connection string...');
        
        if (!process.env.DATABASE_URL) {
            this.diagnostics.findings.push({
                severity: 'CRITICAL',
                issue: 'Cannot validate connection string - DATABASE_URL not found',
                component: 'connection_string'
            });
            return;
        }

        try {
            const url = new URL(process.env.DATABASE_URL);
            
            const connectionInfo = {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port,
                database: url.pathname.slice(1),
                username: url.username,
                password_set: !!url.password,
                full_url_format: url.href.startsWith('postgresql://') || url.href.startsWith('postgres://')
            };

            this.diagnostics.connectionTests.push({
                test: 'connection_string_parsing',
                status: 'PASS',
                details: connectionInfo
            });

            // Validate specific Railway requirements
            if (url.hostname !== 'postgres.railway.internal') {
                this.diagnostics.findings.push({
                    severity: 'WARNING',
                    issue: `Unexpected hostname: ${url.hostname}`,
                    expected: 'postgres.railway.internal',
                    component: 'hostname'
                });
            }

            if (url.port !== '5432') {
                this.diagnostics.findings.push({
                    severity: 'WARNING',
                    issue: `Non-standard port: ${url.port}`,
                    expected: '5432',
                    component: 'port'
                });
            }

        } catch (error) {
            this.diagnostics.connectionTests.push({
                test: 'connection_string_parsing',
                status: 'FAIL',
                error: error.message
            });

            this.diagnostics.findings.push({
                severity: 'CRITICAL',
                issue: 'Invalid DATABASE_URL format',
                error: error.message,
                solution: 'Check Railway PostgreSQL addon and regenerate DATABASE_URL'
            });
        }

        console.log('🔗 Connection string validation complete');
    }

    async testConnectivity() {
        console.log('🌐 Testing database connectivity...');
        
        if (!process.env.DATABASE_URL) {
            this.diagnostics.connectionTests.push({
                test: 'basic_connection',
                status: 'SKIP',
                reason: 'No DATABASE_URL available'
            });
            return;
        }

        // Test basic connection
        let pool = null;
        try {
            pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 5000,
                idleTimeoutMillis: 5000
            });

            console.log('🔄 Attempting database connection...');
            const client = await pool.connect();
            
            // Test basic query
            const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
            client.release();

            this.diagnostics.connectionTests.push({
                test: 'basic_connection',
                status: 'PASS',
                response_time: Date.now(),
                postgres_info: result.rows[0]
            });

            console.log('✅ Basic connection test PASSED');

        } catch (error) {
            this.diagnostics.connectionTests.push({
                test: 'basic_connection',
                status: 'FAIL',
                error: error.message,
                error_code: error.code,
                error_details: {
                    name: error.name,
                    length: error.length,
                    severity: error.severity,
                    file: error.file,
                    line: error.line,
                    routine: error.routine
                }
            });

            this.diagnostics.findings.push({
                severity: 'CRITICAL',
                issue: 'Database connection failed',
                error: error.message,
                error_code: error.code,
                component: 'connection'
            });

            console.log('❌ Basic connection test FAILED:', error.message);
        } finally {
            if (pool) {
                try {
                    await pool.end();
                } catch (e) {
                    console.log('⚠️ Error closing pool:', e.message);
                }
            }
        }
    }

    async analyzePoolConfig() {
        console.log('⚙️ Analyzing connection pool configuration...');
        
        if (!process.env.DATABASE_URL) {
            return;
        }

        const defaultConfig = {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        };

        this.diagnostics.connectionTests.push({
            test: 'pool_configuration',
            status: 'INFO',
            default_config: defaultConfig,
            recommendations: [
                'Consider increasing connectionTimeoutMillis for Railway',
                'Monitor connection pool usage in production',
                'Implement connection retry logic'
            ]
        });

        console.log('⚙️ Pool configuration analysis complete');
    }

    async checkSSLConfig() {
        console.log('🔒 Checking SSL/TLS configuration...');
        
        const sslConfig = {
            production_ssl_enabled: process.env.NODE_ENV === 'production',
            reject_unauthorized: process.env.NODE_ENV === 'production' ? false : 'not_applicable',
            railway_requires_ssl: true
        };

        this.diagnostics.connectionTests.push({
            test: 'ssl_configuration',
            status: 'INFO',
            config: sslConfig
        });

        if (process.env.NODE_ENV === 'production' && !sslConfig.production_ssl_enabled) {
            this.diagnostics.findings.push({
                severity: 'WARNING',
                issue: 'SSL not properly configured for production',
                recommendation: 'Ensure SSL is enabled for Railway PostgreSQL'
            });
        }

        console.log('🔒 SSL configuration check complete');
    }

    generateReport() {
        console.log('\n🎯 DATABASE DIAGNOSTICS REPORT');
        console.log('=====================================');
        
        console.log('\n📊 ENVIRONMENT STATUS:');
        Object.entries(this.diagnostics.environment).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });

        console.log('\n🧪 CONNECTION TESTS:');
        this.diagnostics.connectionTests.forEach(test => {
            console.log(`  ${test.test}: ${test.status}`);
            if (test.error) {
                console.log(`    Error: ${test.error}`);
            }
        });

        console.log('\n🔍 FINDINGS:');
        this.diagnostics.findings.forEach((finding, index) => {
            console.log(`  ${index + 1}. [${finding.severity}] ${finding.issue}`);
            if (finding.solution) {
                console.log(`     Solution: ${finding.solution}`);
            }
        });

        return this.diagnostics;
    }
}

module.exports = DatabaseDiagnostics;

// Auto-run if called directly
if (require.main === module) {
    (async () => {
        const diagnostics = new DatabaseDiagnostics();
        await diagnostics.runDiagnostics();
        diagnostics.generateReport();
    })();
}