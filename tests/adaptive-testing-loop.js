const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);
const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';
const LOCAL_URL = 'http://localhost:3000';

class AdaptiveTestingLoop {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.iteration = 0;
    this.fixes = [];
    this.testResults = [];
  }

  async initialize() {
    console.log('🚀 Initializing Adaptive Testing Loop');
    this.browser = await chromium.launch({ 
      headless: false,
      slowMo: 500
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    this.page = await this.context.newPage();
  }

  async runTestIteration(targetUrl) {
    this.iteration++;
    console.log(`\n🔄 === ITERATION ${this.iteration} ===`);
    console.log(`🎯 Testing: ${targetUrl}`);
    
    const results = {
      iteration: this.iteration,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      tests: [],
      fixes: []
    };

    // Test 1: Basic Connectivity
    const connectivityResult = await this.testConnectivity(targetUrl);
    results.tests.push(connectivityResult);

    if (!connectivityResult.passed) {
      console.log('❌ Connectivity failed - cannot proceed with other tests');
      return results;
    }

    // Test 2: Health Endpoints
    const healthResult = await this.testHealthEndpoints(targetUrl);
    results.tests.push(healthResult);
    
    if (!healthResult.passed) {
      const fix = await this.fixHealthEndpoints();
      if (fix.applied) results.fixes.push(fix);
    }

    // Test 3: Content Analysis
    const contentResult = await this.testContent(targetUrl);
    results.tests.push(contentResult);
    
    if (!contentResult.passed && contentResult.issue === 'api_placeholder') {
      const fix = await this.fixApplicationDeployment();
      if (fix.applied) results.fixes.push(fix);
    }

    // Test 4: Security Headers
    const securityResult = await this.testSecurityHeaders(targetUrl);
    results.tests.push(securityResult);
    
    if (!securityResult.passed) {
      const fix = await this.fixSecurityHeaders();
      if (fix.applied) results.fixes.push(fix);
    }

    // Test 5: POS Functionality (if app is detected)
    if (contentResult.passed || contentResult.hasPosElements) {
      const posResult = await this.testPOSFunctionality(targetUrl);
      results.tests.push(posResult);
    }

    return results;
  }

  async testConnectivity(url) {
    console.log('📡 Testing connectivity...');
    try {
      const response = await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const status = response.status();
      
      if (status === 200) {
        console.log('   ✅ Connectivity OK');
        return { name: 'Connectivity', passed: true, status, details: `HTTP ${status}` };
      } else {
        console.log(`   ❌ Unexpected status: ${status}`);
        return { name: 'Connectivity', passed: false, status, details: `HTTP ${status}` };
      }
    } catch (error) {
      console.log(`   ❌ Connection failed: ${error.message}`);
      return { name: 'Connectivity', passed: false, error: error.message };
    }
  }

  async testHealthEndpoints(url) {
    console.log('🏥 Testing health endpoints...');
    try {
      const healthResponse = await this.page.request.get(`${url}/api/health`);
      const statusResponse = await this.page.request.get(`${url}/api/status`);
      
      const healthOK = healthResponse.status() === 200;
      const statusOK = statusResponse.status() === 200;
      
      if (healthOK && statusOK) {
        console.log('   ✅ Health endpoints working');
        return { name: 'Health Endpoints', passed: true, details: 'Both endpoints OK' };
      } else {
        console.log(`   ❌ Health: ${healthResponse.status()}, Status: ${statusResponse.status()}`);
        return { 
          name: 'Health Endpoints', 
          passed: false, 
          healthStatus: healthResponse.status(),
          statusStatus: statusResponse.status(),
          details: `Health: ${healthResponse.status()}, Status: ${statusResponse.status()}`
        };
      }
    } catch (error) {
      console.log(`   ❌ Health test failed: ${error.message}`);
      return { name: 'Health Endpoints', passed: false, error: error.message };
    }
  }

  async testContent(url) {
    console.log('📄 Testing content...');
    try {
      const title = await this.page.title();
      const content = await this.page.content();
      
      const hasApiPlaceholder = content.includes('Railway API') || content.includes('ASCII') || content.includes('░');
      const hasPosElements = content.includes('POS') || content.includes('inventario') || content.includes('ventas') || 
                            content.includes('login') || content.includes('main-app') || content.includes('nav-item');
      
      console.log(`   Title: "${title}"`);
      console.log(`   API Placeholder: ${hasApiPlaceholder}`);
      console.log(`   POS Elements: ${hasPosElements}`);
      
      if (hasPosElements && !hasApiPlaceholder) {
        console.log('   ✅ POS application detected');
        return { name: 'Content Analysis', passed: true, hasPosElements: true, details: 'POS app loaded' };
      } else if (hasApiPlaceholder) {
        console.log('   ❌ API placeholder detected');
        return { name: 'Content Analysis', passed: false, issue: 'api_placeholder', hasPosElements, details: 'API placeholder' };
      } else {
        console.log('   ❓ Unknown content type');
        return { name: 'Content Analysis', passed: false, issue: 'unknown', hasPosElements, details: 'Unknown content' };
      }
    } catch (error) {
      console.log(`   ❌ Content test failed: ${error.message}`);
      return { name: 'Content Analysis', passed: false, error: error.message };
    }
  }

  async testSecurityHeaders(url) {
    console.log('🛡️  Testing security headers...');
    try {
      const response = await this.page.request.get(url);
      const headers = response.headers();
      
      const securityHeaders = [
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'strict-transport-security',
        'content-security-policy'
      ];
      
      const found = securityHeaders.filter(header => headers[header]);
      const score = Math.round((found.length / securityHeaders.length) * 100);
      
      console.log(`   Security score: ${score}% (${found.length}/${securityHeaders.length})`);
      
      if (score >= 80) {
        console.log('   ✅ Good security coverage');
        return { name: 'Security Headers', passed: true, score, found, details: `${score}% coverage` };
      } else {
        console.log('   ❌ Insufficient security headers');
        return { name: 'Security Headers', passed: false, score, found, missing: securityHeaders.filter(h => !headers[h]), details: `${score}% coverage (low)` };
      }
    } catch (error) {
      console.log(`   ❌ Security test failed: ${error.message}`);
      return { name: 'Security Headers', passed: false, error: error.message };
    }
  }

  async testPOSFunctionality(url) {
    console.log('🏪 Testing POS functionality...');
    try {
      // Look for login form
      const loginElements = await this.page.locator('form, #login-form, [class*="login"]').count();
      const navElements = await this.page.locator('nav, [class*="nav"], [data-section]').count();
      const posElements = await this.page.locator('[class*="pos"], [id*="inventario"], [id*="ventas"]').count();
      
      console.log(`   Login elements: ${loginElements}`);
      console.log(`   Navigation elements: ${navElements}`);
      console.log(`   POS elements: ${posElements}`);
      
      if (loginElements > 0 || navElements > 0 || posElements > 0) {
        console.log('   ✅ POS functionality detected');
        return { name: 'POS Functionality', passed: true, loginElements, navElements, posElements, details: 'POS UI elements found' };
      } else {
        console.log('   ❌ No POS functionality found');
        return { name: 'POS Functionality', passed: false, details: 'No POS UI elements' };
      }
    } catch (error) {
      console.log(`   ❌ POS functionality test failed: ${error.message}`);
      return { name: 'POS Functionality', passed: false, error: error.message };
    }
  }

  async fixHealthEndpoints() {
    console.log('🔧 Attempting to fix health endpoints...');
    try {
      // Check if endpoints exist in server.js
      const serverPath = path.join(process.cwd(), 'server.js');
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      
      const hasHealthEndpoint = serverContent.includes('/api/health');
      const hasStatusEndpoint = serverContent.includes('/api/status');
      
      if (!hasHealthEndpoint || !hasStatusEndpoint) {
        console.log('   Adding missing health endpoints to server.js...');
        
        let updatedContent = serverContent;
        
        if (!hasHealthEndpoint) {
          const healthEndpoint = `
// Health check endpoint for monitoring
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});`;
          
          // Insert before the catch-all route or at the end of routes
          const insertPoint = updatedContent.indexOf('app.get(\'*\'') !== -1 ? 
            updatedContent.indexOf('app.get(\'*\'') : 
            updatedContent.lastIndexOf('app.listen');
          
          updatedContent = updatedContent.slice(0, insertPoint) + healthEndpoint + '\n\n' + updatedContent.slice(insertPoint);
        }
        
        if (!hasStatusEndpoint) {
          const statusEndpoint = `
// Status endpoint for Railway monitoring
app.get('/api/status', async (req, res) => {
  try {
    const status = {
      service: 'pos-conejo-negro',
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
    res.status(200).json(status);
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});`;
          
          const insertPoint = updatedContent.indexOf('app.get(\'*\'') !== -1 ? 
            updatedContent.indexOf('app.get(\'*\'') : 
            updatedContent.lastIndexOf('app.listen');
          
          updatedContent = updatedContent.slice(0, insertPoint) + statusEndpoint + '\n\n' + updatedContent.slice(insertPoint);
        }
        
        fs.writeFileSync(serverPath, updatedContent);
        console.log('   ✅ Health endpoints added to server.js');
        
        return {
          type: 'health_endpoints',
          applied: true,
          details: 'Added missing health endpoints to server.js',
          addedHealth: !hasHealthEndpoint,
          addedStatus: !hasStatusEndpoint
        };
      } else {
        console.log('   ℹ️  Health endpoints already exist in server.js');
        return { type: 'health_endpoints', applied: false, details: 'Endpoints already exist' };
      }
    } catch (error) {
      console.log(`   ❌ Failed to fix health endpoints: ${error.message}`);
      return { type: 'health_endpoints', applied: false, error: error.message };
    }
  }

  async fixSecurityHeaders() {
    console.log('🔧 Attempting to fix security headers...');
    try {
      const serverPath = path.join(process.cwd(), 'server.js');
      const serverContent = fs.readFileSync(serverPath, 'utf8');
      
      if (!serverContent.includes('helmet') && !serverContent.includes('x-frame-options')) {
        console.log('   Adding security headers middleware...');
        
        const securityMiddleware = `
// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  next();
});`;
        
        // Insert after express setup but before routes
        const insertPoint = serverContent.indexOf('app.use(express.json())') !== -1 ?
          serverContent.indexOf('app.use(express.json())') + 'app.use(express.json())'.length :
          serverContent.indexOf('// Routes') || serverContent.indexOf('app.get(');
        
        const updatedContent = serverContent.slice(0, insertPoint) + '\n' + securityMiddleware + '\n' + serverContent.slice(insertPoint);
        
        fs.writeFileSync(serverPath, updatedContent);
        console.log('   ✅ Security headers added to server.js');
        
        return {
          type: 'security_headers',
          applied: true,
          details: 'Added comprehensive security headers middleware'
        };
      } else {
        console.log('   ℹ️  Security headers already configured');
        return { type: 'security_headers', applied: false, details: 'Headers already configured' };
      }
    } catch (error) {
      console.log(`   ❌ Failed to fix security headers: ${error.message}`);
      return { type: 'security_headers', applied: false, error: error.message };
    }
  }

  async fixApplicationDeployment() {
    console.log('🔧 Attempting to fix application deployment...');
    try {
      // Check if local server is running and serving POS app
      console.log('   Checking local server status...');
      
      try {
        const localResponse = await this.page.request.get(LOCAL_URL);
        if (localResponse.status() === 200) {
          const localContent = await localResponse.text();
          const hasLocalPOS = localContent.includes('POS') || localContent.includes('main-app') || localContent.includes('inventario');
          
          if (hasLocalPOS) {
            console.log('   ✅ Local POS app is running - Railway needs redeployment');
            
            // Try to trigger Railway redeployment
            try {
              console.log('   Attempting Railway redeployment...');
              const { stdout } = await execAsync('git add . && git commit --allow-empty -m "fix: Force Railway redeployment after health endpoint fixes" && git push', { timeout: 30000 });
              console.log('   ✅ Triggered Railway redeployment via Git push');
              
              return {
                type: 'deployment',
                applied: true,
                details: 'Triggered Railway redeployment - app should be available in 2-3 minutes'
              };
            } catch (gitError) {
              console.log(`   ⚠️  Git push failed: ${gitError.message}`);
              return {
                type: 'deployment',
                applied: false,
                details: 'Local app detected but Railway redeployment failed',
                error: gitError.message
              };
            }
          }
        }
      } catch (localError) {
        console.log('   ℹ️  Local server not accessible');
      }
      
      // Check Railway configuration
      const railwayConfigExists = fs.existsSync('railway.json');
      const dockerfileExists = fs.existsSync('Dockerfile');
      
      console.log(`   Railway config exists: ${railwayConfigExists}`);
      console.log(`   Dockerfile exists: ${dockerfileExists}`);
      
      if (!railwayConfigExists || !dockerfileExists) {
        return {
          type: 'deployment',
          applied: false,
          details: 'Missing Railway configuration files',
          missingFiles: {
            railwayConfig: !railwayConfigExists,
            dockerfile: !dockerfileExists
          }
        };
      }
      
      return {
        type: 'deployment',
        applied: false,
        details: 'Configuration exists but deployment issue persists - manual Railway check needed'
      };
      
    } catch (error) {
      console.log(`   ❌ Failed to fix deployment: ${error.message}`);
      return { type: 'deployment', applied: false, error: error.message };
    }
  }

  async runAdaptiveLoop() {
    await this.initialize();
    
    const maxIterations = 5;
    let currentUrl = RAILWAY_URL;
    let lastResultHash = '';
    
    for (let i = 0; i < maxIterations; i++) {
      const results = await this.runTestIteration(currentUrl);
      this.testResults.push(results);
      
      // Check if we made progress
      const currentResultHash = JSON.stringify(results.tests.map(t => ({ name: t.name, passed: t.passed })));
      
      if (currentResultHash === lastResultHash && i > 0) {
        console.log('\n🔄 No changes detected - trying local server...');
        currentUrl = currentUrl === RAILWAY_URL ? LOCAL_URL : RAILWAY_URL;
      }
      
      lastResultHash = currentResultHash;
      
      // Check if all tests are passing
      const allPassed = results.tests.every(test => test.passed);
      if (allPassed) {
        console.log('\n🎉 All tests passing! Loop complete.');
        break;
      }
      
      // Wait between iterations if fixes were applied
      if (results.fixes.length > 0) {
        console.log(`\n⏳ Waiting 10 seconds for fixes to take effect...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
      
      // Save progress
      const reportPath = path.join(process.cwd(), 'tests', `adaptive-loop-iteration-${i + 1}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    }
    
    await this.generateFinalReport();
    await this.browser.close();
  }

  async generateFinalReport() {
    console.log('\n📊 Generating Final Report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      totalIterations: this.testResults.length,
      iterations: this.testResults,
      fixesApplied: this.testResults.flatMap(r => r.fixes),
      finalStatus: this.testResults[this.testResults.length - 1]
    };
    
    const reportPath = path.join(process.cwd(), 'tests', 'adaptive-testing-final-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Final report saved: ${reportPath}`);
    console.log(`🔧 Total fixes applied: ${report.fixesApplied.length}`);
    
    const lastResults = report.finalStatus.tests;
    const passed = lastResults.filter(t => t.passed).length;
    const total = lastResults.length;
    
    console.log(`🎯 Final success rate: ${Math.round((passed / total) * 100)}% (${passed}/${total})`);
  }
}

// Run the adaptive testing loop
if (require.main === module) {
  const loop = new AdaptiveTestingLoop();
  loop.runAdaptiveLoop().catch(console.error);
}

module.exports = { AdaptiveTestingLoop };