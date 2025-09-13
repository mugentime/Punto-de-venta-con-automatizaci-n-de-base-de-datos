/**
 * Deployment Verification and Health Checker for Railway POS
 * @description Automated deployment verification, health checks, and operational readiness validation
 * @author Operational Launch Monitor
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/monitoring-config');

class DeploymentChecker {
  constructor(options = {}) {
    this.config = { ...config, ...options };
    this.baseUrl = this.config.deployment.url;
    this.timeout = 30000; // 30 seconds
    this.retries = 3;
    this.testResults = {
      timestamp: new Date().toISOString(),
      deployment: this.config.deployment,
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        critical: 0
      },
      status: 'unknown'
    };
  }

  /**
   * Run complete deployment verification
   */
  async verifyDeployment() {
    console.log('🚀 Starting Railway Deployment Verification');
    console.log(`📍 Target URL: ${this.baseUrl}`);
    console.log(`🔍 Environment: ${this.config.deployment.environment}`);
    console.log('═'.repeat(60));

    // Core deployment tests
    await this.testBasicConnectivity();
    await this.testHealthEndpoints();
    await this.testDatabaseConnectivity();
    await this.testAuthenticationSystem();
    await this.testCoreAPIs();
    await this.testStaticAssets();
    await this.testBusinessFunctionality();
    await this.testPerformanceBasics();
    await this.testSecurityHeaders();
    await this.testRailwaySpecific();

    // Calculate final status
    this.calculateFinalStatus();
    
    // Generate report
    await this.generateReport();

    console.log('═'.repeat(60));
    console.log('📊 DEPLOYMENT VERIFICATION COMPLETE');
    console.log(`✅ Passed: ${this.testResults.summary.passed}/${this.testResults.summary.total}`);
    console.log(`❌ Failed: ${this.testResults.summary.failed}`);
    console.log(`⚠️  Warnings: ${this.testResults.summary.warnings}`);
    console.log(`🚨 Critical: ${this.testResults.summary.critical}`);
    console.log(`🎯 Overall Status: ${this.testResults.status.toUpperCase()}`);
    console.log('═'.repeat(60));

    return this.testResults;
  }

  /**
   * Add test result
   */
  addTestResult(name, status, details = {}) {
    const result = {
      name,
      status, // pass, fail, warning, critical
      timestamp: new Date().toISOString(),
      ...details
    };

    this.testResults.tests.push(result);
    this.testResults.summary.total++;
    
    if (status === 'pass') {
      this.testResults.summary.passed++;
    } else if (status === 'fail') {
      this.testResults.summary.failed++;
    } else if (status === 'warning') {
      this.testResults.summary.warnings++;
    } else if (status === 'critical') {
      this.testResults.summary.critical++;
    }

    const icon = this.getStatusIcon(status);
    console.log(`${icon} ${name}: ${details.message || status}`);

    return result;
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    const icons = {
      pass: '✅',
      fail: '❌',
      warning: '⚠️',
      critical: '🚨'
    };
    return icons[status] || '❓';
  }

  /**
   * Make HTTP request with retries
   */
  async makeRequest(url, options = {}) {
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const response = await axios({
          method: 'GET',
          url: fullUrl,
          timeout: this.timeout,
          validateStatus: () => true, // Don't throw on HTTP errors
          ...options
        });

        return {
          success: true,
          status: response.status,
          data: response.data,
          headers: response.headers,
          responseTime: response.config.metadata?.responseTime || 0
        };
      } catch (error) {
        if (attempt === this.retries) {
          return {
            success: false,
            error: error.message,
            code: error.code,
            attempt
          };
        }
        
        console.log(`   Retry ${attempt}/${this.retries} for ${fullUrl}`);
        await this.sleep(1000 * attempt); // Exponential backoff
      }
    }
  }

  /**
   * Test basic connectivity
   */
  async testBasicConnectivity() {
    console.log('\n📡 Testing Basic Connectivity');
    
    const startTime = Date.now();
    const result = await this.makeRequest('/');
    const responseTime = Date.now() - startTime;

    if (result.success && result.status === 200) {
      this.addTestResult('Basic Connectivity', 'pass', {
        message: `Site loads successfully (${responseTime}ms)`,
        responseTime,
        statusCode: result.status
      });
    } else {
      this.addTestResult('Basic Connectivity', 'critical', {
        message: result.error || `HTTP ${result.status}`,
        error: result.error,
        statusCode: result.status
      });
    }
  }

  /**
   * Test health endpoints
   */
  async testHealthEndpoints() {
    console.log('\n🏥 Testing Health Endpoints');
    
    const healthEndpoints = [
      { url: '/api/health', name: 'Main Health Check', critical: true },
      { url: '/api/version', name: 'Version Info', critical: false },
      { url: '/api/build-info', name: 'Build Info', critical: false }
    ];

    for (const endpoint of healthEndpoints) {
      const startTime = Date.now();
      const result = await this.makeRequest(endpoint.url);
      const responseTime = Date.now() - startTime;

      if (result.success && result.status === 200) {
        // Check for expected health data
        const data = result.data;
        const hasExpectedFields = data && (
          data.status || data.version || data.build
        );

        if (hasExpectedFields) {
          this.addTestResult(endpoint.name, 'pass', {
            message: `Healthy response (${responseTime}ms)`,
            responseTime,
            data: {
              status: data.status,
              isDatabaseReady: data.isDatabaseReady,
              version: data.version
            }
          });
        } else {
          const status = endpoint.critical ? 'critical' : 'warning';
          this.addTestResult(endpoint.name, status, {
            message: 'Endpoint responds but missing expected fields',
            responseTime,
            statusCode: result.status
          });
        }
      } else {
        const status = endpoint.critical ? 'critical' : 'fail';
        this.addTestResult(endpoint.name, status, {
          message: result.error || `HTTP ${result.status}`,
          error: result.error,
          statusCode: result.status
        });
      }
    }
  }

  /**
   * Test database connectivity
   */
  async testDatabaseConnectivity() {
    console.log('\n🗄️ Testing Database Connectivity');
    
    const result = await this.makeRequest('/api/debug/users');
    
    if (result.success && result.status === 200) {
      const data = result.data;
      
      if (typeof data.userCount === 'number') {
        this.addTestResult('Database Connectivity', 'pass', {
          message: `Database responsive with ${data.userCount} users`,
          userCount: data.userCount,
          databaseType: data.databaseType || 'unknown'
        });
      } else {
        this.addTestResult('Database Connectivity', 'warning', {
          message: 'Database endpoint responds but data format unexpected',
          response: data
        });
      }
    } else {
      this.addTestResult('Database Connectivity', 'critical', {
        message: 'Database connectivity test failed',
        error: result.error,
        statusCode: result.status
      });
    }
  }

  /**
   * Test authentication system
   */
  async testAuthenticationSystem() {
    console.log('\n🔐 Testing Authentication System');
    
    // Test protected endpoint without auth (should get 401/403)
    const protectedResult = await this.makeRequest('/api/stats');
    
    if (protectedResult.success && (protectedResult.status === 401 || protectedResult.status === 403)) {
      this.addTestResult('Authentication Protection', 'pass', {
        message: 'Protected endpoints properly secured',
        statusCode: protectedResult.status
      });
    } else if (protectedResult.success && protectedResult.status === 200) {
      this.addTestResult('Authentication Protection', 'warning', {
        message: 'Protected endpoint accessible without auth',
        statusCode: protectedResult.status
      });
    } else {
      this.addTestResult('Authentication Protection', 'fail', {
        message: 'Authentication system test inconclusive',
        error: protectedResult.error,
        statusCode: protectedResult.status
      });
    }

    // Test if admin user exists (via emergency endpoint)
    const adminResult = await this.makeRequest('/api/debug/users');
    
    if (adminResult.success && adminResult.data && adminResult.data.userCount > 0) {
      this.addTestResult('Admin User Availability', 'pass', {
        message: `Admin users available (${adminResult.data.userCount} total users)`,
        userCount: adminResult.data.userCount
      });
    } else {
      this.addTestResult('Admin User Availability', 'warning', {
        message: 'Could not verify admin user existence',
        statusCode: adminResult.status
      });
    }
  }

  /**
   * Test core APIs
   */
  async testCoreAPIs() {
    console.log('\n🔌 Testing Core APIs');
    
    const apis = [
      { url: '/api/health', name: 'Health API' },
      { url: '/api/version', name: 'Version API' },
      { url: '/api/sync/status', name: 'Sync Status API' }
    ];

    for (const api of apis) {
      const result = await this.makeRequest(api.url);
      
      if (result.success && result.status === 200) {
        this.addTestResult(api.name, 'pass', {
          message: 'API responding correctly',
          statusCode: result.status,
          dataSize: JSON.stringify(result.data).length
        });
      } else {
        this.addTestResult(api.name, 'fail', {
          message: result.error || `HTTP ${result.status}`,
          error: result.error,
          statusCode: result.status
        });
      }
    }
  }

  /**
   * Test static assets
   */
  async testStaticAssets() {
    console.log('\n📁 Testing Static Assets');
    
    const assets = [
      { url: '/', name: 'Main Page', contentCheck: 'html' },
      { url: '/online', name: 'Online POS', contentCheck: 'html' },
      { url: '/coworking', name: 'Coworking Page', contentCheck: 'html' }
    ];

    for (const asset of assets) {
      const result = await this.makeRequest(asset.url);
      
      if (result.success && result.status === 200) {
        const isHTML = result.headers['content-type']?.includes('text/html');
        const hasContent = result.data && result.data.length > 100;
        
        if (isHTML && hasContent) {
          this.addTestResult(asset.name, 'pass', {
            message: 'Asset loads with proper content',
            contentType: result.headers['content-type'],
            size: result.data.length
          });
        } else {
          this.addTestResult(asset.name, 'warning', {
            message: 'Asset loads but content may be incomplete',
            contentType: result.headers['content-type'],
            hasContent
          });
        }
      } else {
        this.addTestResult(asset.name, 'fail', {
          message: result.error || `HTTP ${result.status}`,
          error: result.error,
          statusCode: result.status
        });
      }
    }
  }

  /**
   * Test business functionality
   */
  async testBusinessFunctionality() {
    console.log('\n💼 Testing Business Functionality');
    
    // Test sync status (indicates file system working)
    const syncResult = await this.makeRequest('/api/sync/status');
    
    if (syncResult.success && syncResult.status === 200) {
      const data = syncResult.data;
      if (data.system && data.system.includes('File-based')) {
        this.addTestResult('Data System', 'pass', {
          message: 'File-based data system operational',
          system: data.system,
          persistent: data.persistent
        });
      } else {
        this.addTestResult('Data System', 'warning', {
          message: 'Data system status unclear',
          data
        });
      }
    } else {
      this.addTestResult('Data System', 'fail', {
        message: 'Cannot verify data system status',
        error: syncResult.error,
        statusCode: syncResult.status
      });
    }

    // Test backup functionality
    const backupResult = await this.makeRequest('/api/sync/status');
    if (backupResult.success && backupResult.data?.persistent) {
      this.addTestResult('Backup System', 'pass', {
        message: 'Data persistence confirmed',
        backupType: 'Git-based'
      });
    } else {
      this.addTestResult('Backup System', 'warning', {
        message: 'Backup system status unclear'
      });
    }
  }

  /**
   * Test performance basics
   */
  async testPerformanceBasics() {
    console.log('\n⚡ Testing Performance Basics');
    
    const performanceTests = [
      { url: '/api/health', name: 'API Response Time', threshold: 1000 },
      { url: '/', name: 'Page Load Time', threshold: 3000 }
    ];

    for (const test of performanceTests) {
      const startTime = Date.now();
      const result = await this.makeRequest(test.url);
      const responseTime = Date.now() - startTime;

      if (result.success) {
        if (responseTime < test.threshold) {
          this.addTestResult(test.name, 'pass', {
            message: `Good performance (${responseTime}ms)`,
            responseTime,
            threshold: test.threshold
          });
        } else {
          this.addTestResult(test.name, 'warning', {
            message: `Slow response (${responseTime}ms > ${test.threshold}ms)`,
            responseTime,
            threshold: test.threshold
          });
        }
      } else {
        this.addTestResult(test.name, 'fail', {
          message: 'Performance test failed',
          error: result.error
        });
      }
    }
  }

  /**
   * Test security headers
   */
  async testSecurityHeaders() {
    console.log('\n🔒 Testing Security Headers');
    
    const result = await this.makeRequest('/');
    
    if (result.success) {
      const headers = result.headers;
      const securityHeaders = {
        'x-frame-options': 'X-Frame-Options',
        'x-content-type-options': 'X-Content-Type-Options',
        'strict-transport-security': 'HSTS',
        'content-security-policy': 'CSP'
      };

      let presentHeaders = 0;
      const headerDetails = {};

      for (const [header, name] of Object.entries(securityHeaders)) {
        if (headers[header]) {
          presentHeaders++;
          headerDetails[name] = headers[header];
        }
      }

      if (presentHeaders >= 3) {
        this.addTestResult('Security Headers', 'pass', {
          message: `${presentHeaders}/4 security headers present`,
          headers: headerDetails
        });
      } else if (presentHeaders >= 2) {
        this.addTestResult('Security Headers', 'warning', {
          message: `Only ${presentHeaders}/4 security headers present`,
          headers: headerDetails
        });
      } else {
        this.addTestResult('Security Headers', 'fail', {
          message: `Only ${presentHeaders}/4 security headers present`,
          headers: headerDetails
        });
      }
    } else {
      this.addTestResult('Security Headers', 'fail', {
        message: 'Could not test security headers',
        error: result.error
      });
    }
  }

  /**
   * Test Railway-specific functionality
   */
  async testRailwaySpecific() {
    console.log('\n🚂 Testing Railway-Specific Features');
    
    // Check environment variables indication
    const versionResult = await this.makeRequest('/api/version');
    
    if (versionResult.success && versionResult.data) {
      const data = versionResult.data;
      
      if (data.commit && data.commit !== 'unknown') {
        this.addTestResult('Railway Git Integration', 'pass', {
          message: 'Git commit tracking working',
          commit: data.commit.substring(0, 8)
        });
      } else {
        this.addTestResult('Railway Git Integration', 'warning', {
          message: 'Git commit tracking not available'
        });
      }

      if (data.serviceId && data.serviceId !== 'local') {
        this.addTestResult('Railway Service ID', 'pass', {
          message: 'Railway service ID detected',
          serviceId: data.serviceId.substring(0, 8) + '...'
        });
      } else {
        this.addTestResult('Railway Service ID', 'warning', {
          message: 'Railway service ID not detected'
        });
      }
    }

    // Test Railway environment detection
    const healthResult = await this.makeRequest('/api/health');
    if (healthResult.success && healthResult.data) {
      const railwayEnv = healthResult.data.railwayEnv;
      if (railwayEnv && railwayEnv !== 'none') {
        this.addTestResult('Railway Environment', 'pass', {
          message: 'Railway environment properly detected'
        });
      } else {
        this.addTestResult('Railway Environment', 'warning', {
          message: 'Railway environment not detected'
        });
      }
    }
  }

  /**
   * Calculate final deployment status
   */
  calculateFinalStatus() {
    const { critical, failed, warnings, passed, total } = this.testResults.summary;
    
    if (critical > 0) {
      this.testResults.status = 'critical';
    } else if (failed > 0) {
      this.testResults.status = 'failed';
    } else if (warnings > 0) {
      this.testResults.status = 'warning';
    } else if (passed === total) {
      this.testResults.status = 'passed';
    } else {
      this.testResults.status = 'unknown';
    }
  }

  /**
   * Generate deployment report
   */
  async generateReport() {
    const reportDir = path.join(__dirname, '..', 'reports');
    await fs.mkdir(reportDir, { recursive: true });

    const reportFile = path.join(reportDir, `deployment-verification-${Date.now()}.json`);
    await fs.writeFile(reportFile, JSON.stringify(this.testResults, null, 2));

    console.log(`\n📄 Detailed report saved: ${path.basename(reportFile)}`);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Quick health check (subset of full verification)
   */
  async quickHealthCheck() {
    console.log('🏃‍♂️ Quick Health Check');
    
    const checks = [
      { url: '/api/health', name: 'Health Check' },
      { url: '/api/version', name: 'Version Check' },
      { url: '/', name: 'Main Page' }
    ];

    let passed = 0;
    for (const check of checks) {
      const result = await this.makeRequest(check.url);
      if (result.success && result.status === 200) {
        console.log(`✅ ${check.name}: OK`);
        passed++;
      } else {
        console.log(`❌ ${check.name}: ${result.error || `HTTP ${result.status}`}`);
      }
    }

    const isHealthy = passed === checks.length;
    console.log(`\n🎯 Quick Health: ${isHealthy ? 'HEALTHY' : 'ISSUES DETECTED'} (${passed}/${checks.length})`);
    
    return { healthy: isHealthy, passed, total: checks.length };
  }
}

module.exports = DeploymentChecker;

// CLI support
if (require.main === module) {
  const command = process.argv[2];
  const url = process.argv[3] || process.env.DEPLOYMENT_URL || 'https://pos-conejonegro-production.up.railway.app';
  
  const checker = new DeploymentChecker({
    deployment: { url }
  });

  async function runCommand() {
    switch (command) {
      case 'verify':
        const results = await checker.verifyDeployment();
        process.exit(results.status === 'passed' ? 0 : 1);
        break;
        
      case 'quick':
        const quickResults = await checker.quickHealthCheck();
        process.exit(quickResults.healthy ? 0 : 1);
        break;
        
      case 'test':
        console.log(`🧪 Testing deployment at: ${url}`);
        const testResults = await checker.verifyDeployment();
        console.log('\n📊 Test Summary:');
        console.log(JSON.stringify(testResults.summary, null, 2));
        break;
        
      default:
        console.log('Deployment Checker Commands:');
        console.log('  verify [url]  - Full deployment verification');
        console.log('  quick [url]   - Quick health check');
        console.log('  test [url]    - Test and show summary');
        console.log('');
        console.log('Default URL: https://pos-conejonegro-production.up.railway.app');
        process.exit(1);
    }
  }

  runCommand().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}