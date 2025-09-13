/**
 * Production Validation Agent
 * Comprehensive test suite for Railway deployment verification
 * Ensures all services are production-ready and fully functional
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ProductionValidator {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.RAILWAY_URL || 'https://pos-conejonegro-production.up.railway.app';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 2000;
    
    // Test credentials for production validation
    this.testCredentials = {
      admin: {
        email: 'admin@conejonegro.com',
        password: 'admin123'
      }
    };
    
    this.results = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      tests: [],
      metrics: {},
      errors: [],
      warnings: [],
      summary: {}
    };
    
    // Configure axios with production settings
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      validateStatus: () => true, // Don't throw on non-2xx status codes
      headers: {
        'User-Agent': 'POS-ProductionValidator/1.0',
        'Accept': 'application/json'
      }
    });
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, data };
    
    console.log(`[${timestamp}] [${level}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    
    if (level === 'ERROR') {
      this.results.errors.push(logEntry);
    } else if (level === 'WARN') {
      this.results.warnings.push(logEntry);
    }
  }

  async addTestResult(name, status, details = {}) {
    const result = {
      name,
      status,
      timestamp: new Date().toISOString(),
      duration: details.duration || 0,
      ...details
    };
    
    this.results.tests.push(result);
    
    const statusEmoji = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'SKIP': '⏭️'
    };
    
    this.log('INFO', `${statusEmoji[status] || '❓'} ${name}`, details.message || '');
    return result;
  }

  async retry(operation, context = '') {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === this.retryAttempts) {
          throw error;
        }
        
        this.log('WARN', `${context} failed (attempt ${attempt}/${this.retryAttempts}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  async validateBasicConnectivity() {
    const startTime = Date.now();
    
    try {
      const response = await this.retry(async () => {
        return await this.client.get('/');
      }, 'Basic connectivity test');
      
      const duration = Date.now() - startTime;
      
      if (response.status === 200) {
        await this.addTestResult('Basic Connectivity', 'PASS', {
          message: `Server responding with status ${response.status}`,
          duration,
          responseSize: response.data?.length || 0,
          responseHeaders: response.headers
        });
      } else {
        await this.addTestResult('Basic Connectivity', 'FAIL', {
          message: `Unexpected status code: ${response.status}`,
          duration,
          responseStatus: response.status,
          responseBody: response.data
        });
      }
    } catch (error) {
      await this.addTestResult('Basic Connectivity', 'FAIL', {
        message: `Connection failed: ${error.message}`,
        error: error.message,
        duration: Date.now() - startTime
      });
    }
  }

  async validateHealthEndpoints() {
    const endpoints = [
      { path: '/api/health', name: 'Health Check' },
      { path: '/api/version', name: 'Version Info' },
      { path: '/api/build-info', name: 'Build Info' },
      { path: '/api/sync/status', name: 'Sync Status' }
    ];

    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const response = await this.retry(async () => {
          return await this.client.get(endpoint.path);
        }, `${endpoint.name} endpoint test`);
        
        const duration = Date.now() - startTime;
        
        if (response.status === 200) {
          const data = response.data;
          await this.addTestResult(`Health: ${endpoint.name}`, 'PASS', {
            message: `Endpoint responding correctly`,
            duration,
            path: endpoint.path,
            data: typeof data === 'object' ? data : { response: data }
          });
          
          // Store specific metrics
          if (endpoint.path === '/api/health') {
            this.results.metrics.health = data;
          }
        } else {
          await this.addTestResult(`Health: ${endpoint.name}`, 'FAIL', {
            message: `Endpoint returned status ${response.status}`,
            duration,
            path: endpoint.path,
            responseStatus: response.status,
            responseBody: response.data
          });
        }
      } catch (error) {
        await this.addTestResult(`Health: ${endpoint.name}`, 'FAIL', {
          message: `Endpoint failed: ${error.message}`,
          duration: Date.now() - startTime,
          path: endpoint.path,
          error: error.message
        });
      }
    }
  }

  async validateAuthenticationSystem() {
    const startTime = Date.now();
    
    try {
      // Test login endpoint
      const loginResponse = await this.retry(async () => {
        return await this.client.post('/api/auth/login', {
          email: this.testCredentials.admin.email,
          password: this.testCredentials.admin.password
        });
      }, 'Authentication test');
      
      const duration = Date.now() - startTime;
      
      if (loginResponse.status === 200 && loginResponse.data.token) {
        await this.addTestResult('Authentication: Login', 'PASS', {
          message: 'Admin login successful',
          duration,
          hasToken: !!loginResponse.data.token,
          userRole: loginResponse.data.user?.role
        });
        
        // Test protected endpoint with token
        const token = loginResponse.data.token;
        const protectedResponse = await this.client.get('/api/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (protectedResponse.status === 200) {
          await this.addTestResult('Authentication: Protected Route', 'PASS', {
            message: 'Protected endpoint accessible with valid token',
            statsData: protectedResponse.data
          });
        } else {
          await this.addTestResult('Authentication: Protected Route', 'FAIL', {
            message: `Protected endpoint returned status ${protectedResponse.status}`,
            responseStatus: protectedResponse.status
          });
        }
        
        // Test invalid token
        const invalidResponse = await this.client.get('/api/stats', {
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        });
        
        if (invalidResponse.status === 401 || invalidResponse.status === 403) {
          await this.addTestResult('Authentication: Invalid Token', 'PASS', {
            message: 'Invalid token correctly rejected',
            responseStatus: invalidResponse.status
          });
        } else {
          await this.addTestResult('Authentication: Invalid Token', 'WARN', {
            message: `Invalid token handling unexpected: status ${invalidResponse.status}`,
            responseStatus: invalidResponse.status
          });
        }
        
      } else {
        await this.addTestResult('Authentication: Login', 'FAIL', {
          message: `Login failed with status ${loginResponse.status}`,
          duration,
          responseStatus: loginResponse.status,
          responseBody: loginResponse.data
        });
      }
    } catch (error) {
      await this.addTestResult('Authentication: Login', 'FAIL', {
        message: `Authentication test failed: ${error.message}`,
        duration: Date.now() - startTime,
        error: error.message
      });
    }
  }

  async validateDatabaseOperations() {
    try {
      // Test user creation/retrieval
      const usersResponse = await this.client.get('/api/debug/users');
      
      if (usersResponse.status === 200) {
        const userData = usersResponse.data;
        await this.addTestResult('Database: User Operations', 'PASS', {
          message: `Found ${userData.count || userData.userCount || 0} users`,
          userCount: userData.count || userData.userCount || 0,
          adminUsers: userData.adminEmails || []
        });
      } else {
        await this.addTestResult('Database: User Operations', 'FAIL', {
          message: `User query failed with status ${usersResponse.status}`,
          responseStatus: usersResponse.status
        });
      }
      
      // Test products endpoint
      const token = await this.getValidToken();
      if (token) {
        const productsResponse = await this.client.get('/api/products', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (productsResponse.status === 200) {
          await this.addTestResult('Database: Product Operations', 'PASS', {
            message: `Products endpoint accessible`,
            productCount: Array.isArray(productsResponse.data) ? productsResponse.data.length : 'unknown'
          });
        } else {
          await this.addTestResult('Database: Product Operations', 'FAIL', {
            message: `Products endpoint failed with status ${productsResponse.status}`,
            responseStatus: productsResponse.status
          });
        }
      }
      
    } catch (error) {
      await this.addTestResult('Database: Operations', 'FAIL', {
        message: `Database test failed: ${error.message}`,
        error: error.message
      });
    }
  }

  async getValidToken() {
    try {
      const response = await this.client.post('/api/auth/login', {
        email: this.testCredentials.admin.email,
        password: this.testCredentials.admin.password
      });
      
      return response.data?.token || null;
    } catch (error) {
      this.log('WARN', 'Could not obtain valid token for protected endpoint tests');
      return null;
    }
  }

  async validatePerformance() {
    const startTime = Date.now();
    const performanceMetrics = {
      requests: [],
      totalTime: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      successRate: 0
    };
    
    // Test multiple concurrent requests
    const requestCount = 10;
    const requests = [];
    
    for (let i = 0; i < requestCount; i++) {
      requests.push(this.performSingleRequest(i));
    }
    
    try {
      const results = await Promise.all(requests);
      performanceMetrics.requests = results;
      
      const successfulRequests = results.filter(r => r.success);
      const responseTimes = successfulRequests.map(r => r.responseTime);
      
      performanceMetrics.successRate = (successfulRequests.length / requestCount) * 100;
      performanceMetrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      performanceMetrics.maxResponseTime = Math.max(...responseTimes);
      performanceMetrics.minResponseTime = Math.min(...responseTimes);
      performanceMetrics.totalTime = Date.now() - startTime;
      
      const status = performanceMetrics.successRate >= 90 && performanceMetrics.averageResponseTime < 5000 ? 'PASS' : 'WARN';
      
      await this.addTestResult('Performance: Load Test', status, {
        message: `${requestCount} concurrent requests completed`,
        metrics: performanceMetrics
      });
      
      this.results.metrics.performance = performanceMetrics;
      
    } catch (error) {
      await this.addTestResult('Performance: Load Test', 'FAIL', {
        message: `Performance test failed: ${error.message}`,
        error: error.message
      });
    }
  }

  async performSingleRequest(index) {
    const startTime = Date.now();
    
    try {
      const response = await this.client.get('/api/health');
      const responseTime = Date.now() - startTime;
      
      return {
        index,
        success: response.status === 200,
        responseTime,
        status: response.status
      };
    } catch (error) {
      return {
        index,
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async validateSecurityHeaders() {
    try {
      const response = await this.client.get('/');
      const headers = response.headers;
      
      const securityChecks = {
        'strict-transport-security': !!headers['strict-transport-security'],
        'x-content-type-options': headers['x-content-type-options'] === 'nosniff',
        'x-frame-options': !!headers['x-frame-options'],
        'content-security-policy': !!headers['content-security-policy'],
        'x-xss-protection': !!headers['x-xss-protection']
      };
      
      const passedChecks = Object.values(securityChecks).filter(Boolean).length;
      const totalChecks = Object.keys(securityChecks).length;
      
      const status = passedChecks >= totalChecks * 0.8 ? 'PASS' : 'WARN';
      
      await this.addTestResult('Security: Headers', status, {
        message: `${passedChecks}/${totalChecks} security headers present`,
        securityHeaders: securityChecks,
        allHeaders: headers
      });
      
    } catch (error) {
      await this.addTestResult('Security: Headers', 'FAIL', {
        message: `Security header check failed: ${error.message}`,
        error: error.message
      });
    }
  }

  async validateEnvironmentConfiguration() {
    try {
      const envResponse = await this.client.get('/api/debug/env');
      
      if (envResponse.status === 200) {
        const envData = envResponse.data;
        const configChecks = {
          nodeEnv: envData.env_check?.NODE_ENV === 'production',
          jwtSecret: envData.env_check?.JWT_SECRET === 'present',
          productionDetected: envData.production_detected === true,
          databaseConfigured: envData.should_use_postgres === true || envData.env_check?.database_url_present === true
        };
        
        const passedChecks = Object.values(configChecks).filter(Boolean).length;
        const totalChecks = Object.keys(configChecks).length;
        
        const status = passedChecks === totalChecks ? 'PASS' : 'WARN';
        
        await this.addTestResult('Environment: Configuration', status, {
          message: `${passedChecks}/${totalChecks} configuration checks passed`,
          configChecks,
          envData
        });
      } else {
        await this.addTestResult('Environment: Configuration', 'FAIL', {
          message: `Environment check endpoint failed with status ${envResponse.status}`,
          responseStatus: envResponse.status
        });
      }
    } catch (error) {
      await this.addTestResult('Environment: Configuration', 'FAIL', {
        message: `Environment validation failed: ${error.message}`,
        error: error.message
      });
    }
  }

  async validateAPIEndpoints() {
    const token = await this.getValidToken();
    
    const endpoints = [
      { method: 'GET', path: '/api/stats', requiresAuth: true, name: 'Statistics' },
      { method: 'GET', path: '/api/sync', requiresAuth: true, name: 'Data Sync' },
      { method: 'POST', path: '/api/sync/backup', requiresAuth: false, name: 'Backup Creation' },
      { method: 'GET', path: '/api/products', requiresAuth: true, name: 'Products List' },
      { method: 'GET', path: '/api/records', requiresAuth: true, name: 'Records List' }
    ];
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      
      try {
        const config = {
          method: endpoint.method.toLowerCase(),
          url: endpoint.path
        };
        
        if (endpoint.requiresAuth && token) {
          config.headers = { 'Authorization': `Bearer ${token}` };
        } else if (endpoint.requiresAuth && !token) {
          await this.addTestResult(`API: ${endpoint.name}`, 'SKIP', {
            message: 'Skipped due to missing authentication token',
            path: endpoint.path
          });
          continue;
        }
        
        const response = await this.client(config);
        const duration = Date.now() - startTime;
        
        if (response.status >= 200 && response.status < 400) {
          await this.addTestResult(`API: ${endpoint.name}`, 'PASS', {
            message: `Endpoint responding correctly (${response.status})`,
            duration,
            path: endpoint.path,
            responseStatus: response.status,
            dataSize: JSON.stringify(response.data).length
          });
        } else {
          await this.addTestResult(`API: ${endpoint.name}`, 'FAIL', {
            message: `Endpoint returned status ${response.status}`,
            duration,
            path: endpoint.path,
            responseStatus: response.status,
            responseBody: response.data
          });
        }
      } catch (error) {
        await this.addTestResult(`API: ${endpoint.name}`, 'FAIL', {
          message: `Endpoint failed: ${error.message}`,
          duration: Date.now() - startTime,
          path: endpoint.path,
          error: error.message
        });
      }
    }
  }

  async generateSummary() {
    const tests = this.results.tests;
    const summary = {
      totalTests: tests.length,
      passed: tests.filter(t => t.status === 'PASS').length,
      failed: tests.filter(t => t.status === 'FAIL').length,
      warnings: tests.filter(t => t.status === 'WARN').length,
      skipped: tests.filter(t => t.status === 'SKIP').length,
      totalErrors: this.results.errors.length,
      totalWarnings: this.results.warnings.length,
      averageDuration: tests.reduce((sum, t) => sum + (t.duration || 0), 0) / tests.length,
      successRate: ((tests.filter(t => t.status === 'PASS').length / tests.length) * 100).toFixed(1) + '%'
    };
    
    // Overall health assessment
    const criticalFailures = tests.filter(t => 
      t.status === 'FAIL' && 
      (t.name.includes('Connectivity') || t.name.includes('Authentication') || t.name.includes('Health'))
    ).length;
    
    summary.overallHealth = criticalFailures === 0 ? 'HEALTHY' : 'DEGRADED';
    summary.deploymentReady = criticalFailures === 0 && summary.failed <= 2;
    
    this.results.summary = summary;
    return summary;
  }

  async runAllValidations() {
    this.log('INFO', '🚀 Starting Production Validation Suite');
    this.log('INFO', `Target URL: ${this.baseUrl}`);
    this.log('INFO', '═'.repeat(60));
    
    const validations = [
      { name: 'Basic Connectivity', fn: () => this.validateBasicConnectivity() },
      { name: 'Health Endpoints', fn: () => this.validateHealthEndpoints() },
      { name: 'Authentication System', fn: () => this.validateAuthenticationSystem() },
      { name: 'Database Operations', fn: () => this.validateDatabaseOperations() },
      { name: 'API Endpoints', fn: () => this.validateAPIEndpoints() },
      { name: 'Performance', fn: () => this.validatePerformance() },
      { name: 'Security Headers', fn: () => this.validateSecurityHeaders() },
      { name: 'Environment Configuration', fn: () => this.validateEnvironmentConfiguration() }
    ];
    
    for (const validation of validations) {
      this.log('INFO', `\n📝 Running ${validation.name} validation...`);
      try {
        await validation.fn();
      } catch (error) {
        this.log('ERROR', `Validation '${validation.name}' failed:`, error.message);
        await this.addTestResult(validation.name, 'FAIL', {
          message: `Validation failed: ${error.message}`,
          error: error.message
        });
      }
    }
    
    // Generate final summary
    const summary = await this.generateSummary();
    
    this.log('INFO', '\n' + '═'.repeat(60));
    this.log('INFO', '📊 PRODUCTION VALIDATION SUMMARY');
    this.log('INFO', '═'.repeat(60));
    this.log('INFO', `✅ Passed: ${summary.passed}/${summary.totalTests}`);
    this.log('INFO', `❌ Failed: ${summary.failed}`);
    this.log('INFO', `⚠️  Warnings: ${summary.warnings}`);
    this.log('INFO', `⏭️  Skipped: ${summary.skipped}`);
    this.log('INFO', `📈 Success Rate: ${summary.successRate}`);
    this.log('INFO', `🏥 Overall Health: ${summary.overallHealth}`);
    this.log('INFO', `🚀 Deployment Ready: ${summary.deploymentReady ? 'YES' : 'NO'}`);
    this.log('INFO', '═'.repeat(60));
    
    return this.results;
  }

  async saveReport(outputPath = null) {
    if (!outputPath) {
      outputPath = path.join(__dirname, '..', 'reports', 'production-validation-report.json');
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    // Save detailed JSON report
    await fs.writeFile(outputPath, JSON.stringify(this.results, null, 2));
    this.log('INFO', `📄 Detailed report saved: ${outputPath}`);
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    const htmlPath = outputPath.replace('.json', '.html');
    await fs.writeFile(htmlPath, htmlReport);
    this.log('INFO', `📄 HTML report saved: ${htmlPath}`);
    
    return { jsonPath: outputPath, htmlPath };
  }

  generateHTMLReport() {
    const results = this.results;
    const summary = results.summary;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Validation Report - ${new Date(results.timestamp).toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header .subtitle { font-size: 1.2rem; opacity: 0.9; margin-bottom: 1rem; }
        .header .timestamp { font-size: 0.9rem; opacity: 0.8; }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            padding: 2rem;
            background: #f8f9fa;
        }
        .summary-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        .summary-card:hover { transform: translateY(-4px); }
        .summary-card .value {
            font-size: 2.5rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .summary-card.healthy .value { color: #28a745; }
        .summary-card.warning .value { color: #ffc107; }
        .summary-card.error .value { color: #dc3545; }
        .summary-card .label {
            font-size: 0.9rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .health-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1rem;
            margin: 1rem 0;
        }
        .health-badge.healthy { background: #d4edda; color: #155724; }
        .health-badge.degraded { background: #f8d7da; color: #721c24; }
        
        .content { padding: 2rem; }
        .section { margin-bottom: 2rem; }
        .section h2 {
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
            padding-bottom: 0.5rem;
        }
        
        .test-grid {
            display: grid;
            gap: 1rem;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        }
        .test-card {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.3s;
        }
        .test-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }
        .test-header {
            padding: 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .test-status {
            font-size: 1.5rem;
            margin-right: 0.5rem;
        }
        .test-name {
            font-weight: 600;
            flex: 1;
        }
        .test-duration {
            font-size: 0.8rem;
            color: #6c757d;
            background: #e9ecef;
            padding: 0.2rem 0.5rem;
            border-radius: 12px;
        }
        .test-body {
            padding: 1rem;
        }
        .test-message {
            margin-bottom: 0.5rem;
            color: #495057;
        }
        .test-details {
            font-size: 0.85rem;
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            overflow-x: auto;
        }
        .test-details pre {
            margin: 0;
            font-family: 'Courier New', monospace;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #28a745;
        }
        .metric-card h4 {
            margin-bottom: 0.5rem;
            color: #495057;
        }
        
        .errors-section {
            background: #fff5f5;
            border: 1px solid #feb2b2;
            border-radius: 12px;
            padding: 1.5rem;
            margin-top: 2rem;
        }
        .errors-section h3 {
            color: #c53030;
            margin-bottom: 1rem;
        }
        .error-item {
            background: white;
            padding: 0.75rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            border-left: 4px solid #dc3545;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 2rem;
            text-align: center;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏥 Production Validation Report</h1>
            <div class="subtitle">${results.baseUrl}</div>
            <div class="timestamp">Generated: ${new Date(results.timestamp).toLocaleString()}</div>
            <div class="health-badge ${summary.overallHealth.toLowerCase()}">
                ${summary.overallHealth} ${summary.deploymentReady ? '🚀' : '⚠️'}
            </div>
        </div>
        
        <div class="summary">
            <div class="summary-card healthy">
                <div class="value">${summary.passed}</div>
                <div class="label">Tests Passed</div>
            </div>
            <div class="summary-card error">
                <div class="value">${summary.failed}</div>
                <div class="label">Tests Failed</div>
            </div>
            <div class="summary-card warning">
                <div class="value">${summary.warnings}</div>
                <div class="label">Warnings</div>
            </div>
            <div class="summary-card">
                <div class="value">${summary.successRate}</div>
                <div class="label">Success Rate</div>
            </div>
            <div class="summary-card">
                <div class="value">${Math.round(summary.averageDuration)}ms</div>
                <div class="label">Avg Response</div>
            </div>
            <div class="summary-card ${summary.deploymentReady ? 'healthy' : 'error'}">
                <div class="value">${summary.deploymentReady ? '✅' : '❌'}</div>
                <div class="label">Deploy Ready</div>
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>Test Results</h2>
                <div class="test-grid">
                    ${results.tests.map(test => {
                      const statusEmoji = {
                        'PASS': '✅',
                        'FAIL': '❌',
                        'WARN': '⚠️',
                        'SKIP': '⏭️'
                      };
                      
                      return `
                        <div class="test-card">
                            <div class="test-header">
                                <div>
                                    <span class="test-status">${statusEmoji[test.status] || '❓'}</span>
                                    <span class="test-name">${test.name}</span>
                                </div>
                                ${test.duration ? `<span class="test-duration">${test.duration}ms</span>` : ''}
                            </div>
                            <div class="test-body">
                                ${test.message ? `<div class="test-message">${test.message}</div>` : ''}
                                ${test.details || test.metrics || test.configChecks ? 
                                  `<div class="test-details">
                                    <pre>${JSON.stringify(test.details || test.metrics || test.configChecks, null, 2)}</pre>
                                  </div>` : ''}
                            </div>
                        </div>
                      `;
                    }).join('')}
                </div>
            </div>
            
            ${Object.keys(results.metrics).length > 0 ? `
                <div class="section">
                    <h2>Performance Metrics</h2>
                    <div class="metrics-grid">
                        ${Object.entries(results.metrics).map(([key, value]) => `
                            <div class="metric-card">
                                <h4>${key.charAt(0).toUpperCase() + key.slice(1)}</h4>
                                <pre>${JSON.stringify(value, null, 2)}</pre>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${results.errors.length > 0 ? `
                <div class="errors-section">
                    <h3>Errors & Issues</h3>
                    ${results.errors.slice(0, 10).map(error => `
                        <div class="error-item">
                            <strong>${error.level}:</strong> ${error.message}
                            ${error.data ? `<pre>${JSON.stringify(error.data, null, 2)}</pre>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>Production Validation Suite v1.0 • Generated at ${new Date().toLocaleString()}</p>
            <p>Deployment Status: <strong>${summary.deploymentReady ? 'READY FOR PRODUCTION' : 'NEEDS ATTENTION'}</strong></p>
        </div>
    </div>
</body>
</html>`;
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {
    baseUrl: args[0] || process.env.RAILWAY_URL || 'https://pos-conejonegro-production.up.railway.app'
  };
  
  const validator = new ProductionValidator(config);
  
  validator.runAllValidations()
    .then(async (results) => {
      await validator.saveReport();
      console.log('\n✅ Production validation complete!');
      process.exit(results.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Fatal validation error:', error);
      process.exit(1);
    });
}

module.exports = ProductionValidator;