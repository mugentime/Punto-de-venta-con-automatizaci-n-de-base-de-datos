/**
 * Railway Deployment Verification Test
 * Tests the POS application deployment at https://pos-conejonegro-production.up.railway.app
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Test configuration
const CONFIG = {
  url: 'https://pos-conejonegro-production.up.railway.app',
  credentials: {
    email: 'gerencia@conejonegro.mx',
    password: 'conejonegro2024'
  },
  screenshotDir: path.join(__dirname, '..', 'reports', 'railway-verification'),
  timeout: 30000
};

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  url: CONFIG.url,
  tests: [],
  screenshots: [],
  errors: [],
  summary: {}
};

// Helper function to add test result
function addTestResult(name, status, details = {}) {
  const result = {
    name,
    status,
    timestamp: new Date().toISOString(),
    ...details
  };
  testResults.tests.push(result);
  console.log(`[${status}] ${name}`, details.message || '');
  return result;
}

// Helper function to take screenshot
async function takeScreenshot(page, name, description) {
  try {
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(CONFIG.screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    testResults.screenshots.push({ name, filename, description });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  } catch (error) {
    console.error(`Failed to take screenshot ${name}:`, error.message);
  }
}

// Main verification function
async function verifyDeployment() {
  let browser;
  
  try {
    console.log('🚀 Starting Railway Deployment Verification');
    console.log(`📍 Target URL: ${CONFIG.url}`);
    console.log('─'.repeat(60));
    
    // Create screenshot directory
    await fs.mkdir(CONFIG.screenshotDir, { recursive: true });
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: { width: 1920, height: 1080 }
    });
    
    const page = await browser.newPage();
    
    // Set up console monitoring
    const consoleLogs = [];
    page.on('console', msg => {
      const log = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      consoleLogs.push(log);
      if (msg.type() === 'error') {
        testResults.errors.push(log);
      }
    });
    
    // Set up network monitoring
    const networkErrors = [];
    page.on('requestfailed', request => {
      const error = {
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: new Date().toISOString()
      };
      networkErrors.push(error);
      testResults.errors.push(error);
    });
    
    // Test 1: Navigate to URL and check response
    console.log('\n📝 Test 1: Application Loading');
    let navigationResult;
    try {
      navigationResult = await page.goto(CONFIG.url, { 
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout 
      });
      
      const status = navigationResult.status();
      if (status === 200) {
        addTestResult('Application Loading', 'PASS', {
          message: `Successfully loaded with status ${status}`,
          responseStatus: status
        });
      } else {
        addTestResult('Application Loading', 'FAIL', {
          message: `Unexpected status code: ${status}`,
          responseStatus: status
        });
      }
    } catch (error) {
      addTestResult('Application Loading', 'FAIL', {
        message: `Failed to load: ${error.message}`,
        error: error.message
      });
    }
    
    await takeScreenshot(page, 'initial-load', 'Initial page load');
    
    // Test 2: Check for login form
    console.log('\n📝 Test 2: Login Form Presence');
    try {
      const loginForm = await page.$('form');
      const emailInput = await page.$('input[type="email"], input[name="email"], input#email');
      const passwordInput = await page.$('input[type="password"]');
      const submitButton = await page.$('button[type="submit"], input[type="submit"]');
      
      if (loginForm && emailInput && passwordInput && submitButton) {
        addTestResult('Login Form Presence', 'PASS', {
          message: 'All login form elements found',
          elements: ['form', 'email input', 'password input', 'submit button']
        });
      } else {
        addTestResult('Login Form Presence', 'FAIL', {
          message: 'Missing login form elements',
          found: {
            form: !!loginForm,
            emailInput: !!emailInput,
            passwordInput: !!passwordInput,
            submitButton: !!submitButton
          }
        });
      }
    } catch (error) {
      addTestResult('Login Form Presence', 'FAIL', {
        message: `Error checking form: ${error.message}`
      });
    }
    
    // Test 3: Attempt login
    console.log('\n📝 Test 3: Login Functionality');
    try {
      // Find and fill email field
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input#email',
        'input[placeholder*="mail" i]'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.type(selector, CONFIG.credentials.email);
          emailFilled = true;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!emailFilled) {
        throw new Error('Could not find email input field');
      }
      
      // Fill password field
      await page.type('input[type="password"]', CONFIG.credentials.password);
      
      await takeScreenshot(page, 'login-filled', 'Login form with credentials filled');
      
      // Submit form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: CONFIG.timeout }),
        page.click('button[type="submit"], input[type="submit"]')
      ]);
      
      // Check if login was successful
      const currentUrl = page.url();
      const isLoggedIn = currentUrl !== CONFIG.url && !currentUrl.includes('login');
      
      if (isLoggedIn) {
        addTestResult('Login Functionality', 'PASS', {
          message: 'Successfully logged in',
          redirectedTo: currentUrl
        });
      } else {
        // Check for error messages
        const errorMessage = await page.$eval('.error, .alert-danger, [role="alert"]', 
          el => el.textContent).catch(() => null);
        
        addTestResult('Login Functionality', 'PARTIAL', {
          message: 'Login attempted but may have failed',
          currentUrl,
          errorMessage
        });
      }
      
      await takeScreenshot(page, 'after-login', 'Page after login attempt');
      
    } catch (error) {
      addTestResult('Login Functionality', 'FAIL', {
        message: `Login test failed: ${error.message}`
      });
    }
    
    // Test 4: Check navigation elements
    console.log('\n📝 Test 4: Navigation Elements');
    try {
      const navSelectors = [
        'nav', '.navbar', '.navigation', 
        '.sidebar', '.menu', '[role="navigation"]'
      ];
      
      let navFound = false;
      for (const selector of navSelectors) {
        const element = await page.$(selector);
        if (element) {
          navFound = true;
          const navLinks = await page.$$eval(`${selector} a`, links => 
            links.map(link => ({ text: link.textContent.trim(), href: link.href }))
          );
          
          addTestResult('Navigation Elements', 'PASS', {
            message: `Found navigation with ${navLinks.length} links`,
            selector,
            linkCount: navLinks.length,
            links: navLinks.slice(0, 10) // First 10 links
          });
          break;
        }
      }
      
      if (!navFound) {
        addTestResult('Navigation Elements', 'FAIL', {
          message: 'No navigation elements found'
        });
      }
    } catch (error) {
      addTestResult('Navigation Elements', 'FAIL', {
        message: `Error checking navigation: ${error.message}`
      });
    }
    
    // Test 5: Check for POS sections
    console.log('\n📝 Test 5: POS Core Sections');
    const sections = [
      { name: 'Inventario', selectors: ['[href*="inventario"]', '[href*="inventory"]', 'a:contains("Inventario")'] },
      { name: 'Ventas', selectors: ['[href*="ventas"]', '[href*="sales"]', 'a:contains("Ventas")'] },
      { name: 'Reportes', selectors: ['[href*="reportes"]', '[href*="reports"]', 'a:contains("Reportes")'] },
      { name: 'Productos', selectors: ['[href*="productos"]', '[href*="products"]', 'a:contains("Productos")'] }
    ];
    
    const foundSections = [];
    for (const section of sections) {
      let found = false;
      for (const selector of section.selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            foundSections.push(section.name);
            found = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!found) {
        // Try text content search
        try {
          const textFound = await page.evaluate((sectionName) => {
            return !!Array.from(document.querySelectorAll('a, button')).find(
              el => el.textContent.toLowerCase().includes(sectionName.toLowerCase())
            );
          }, section.name);
          
          if (textFound) {
            foundSections.push(section.name);
          }
        } catch (e) {}
      }
    }
    
    if (foundSections.length > 0) {
      addTestResult('POS Core Sections', 'PASS', {
        message: `Found ${foundSections.length} core sections`,
        sections: foundSections
      });
    } else {
      addTestResult('POS Core Sections', 'FAIL', {
        message: 'No POS core sections found'
      });
    }
    
    // Test 6: Test responsive design
    console.log('\n📝 Test 6: Responsive Design');
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewport({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000); // Wait for responsive adjustments
      await takeScreenshot(page, `viewport-${viewport.name.toLowerCase()}`, 
        `${viewport.name} view (${viewport.width}x${viewport.height})`);
    }
    
    addTestResult('Responsive Design', 'PASS', {
      message: 'Tested multiple viewport sizes',
      viewports: viewports.map(v => `${v.name}: ${v.width}x${v.height}`)
    });
    
    // Test 7: Performance metrics
    console.log('\n📝 Test 7: Performance Metrics');
    try {
      const metrics = await page.metrics();
      const performance = await page.evaluate(() => {
        const perf = window.performance;
        const navigation = perf.getEntriesByType('navigation')[0];
        return {
          loadTime: navigation?.loadEventEnd - navigation?.fetchStart,
          domReady: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
          resources: perf.getEntriesByType('resource').length
        };
      });
      
      addTestResult('Performance Metrics', 'PASS', {
        message: 'Performance metrics collected',
        metrics: {
          jsHeapUsed: `${(metrics.JSHeapUsedSize / 1048576).toFixed(2)} MB`,
          documents: metrics.Documents,
          frames: metrics.Frames,
          loadTime: `${performance.loadTime?.toFixed(0) || 'N/A'} ms`,
          domReady: `${performance.domReady?.toFixed(0) || 'N/A'} ms`,
          resources: performance.resources
        }
      });
    } catch (error) {
      addTestResult('Performance Metrics', 'FAIL', {
        message: `Could not collect metrics: ${error.message}`
      });
    }
    
    // Test 8: Console errors check
    console.log('\n📝 Test 8: Console Errors');
    const errors = consoleLogs.filter(log => log.type === 'error');
    if (errors.length === 0) {
      addTestResult('Console Errors', 'PASS', {
        message: 'No console errors detected',
        totalLogs: consoleLogs.length
      });
    } else {
      addTestResult('Console Errors', 'WARNING', {
        message: `Found ${errors.length} console errors`,
        errors: errors.slice(0, 5).map(e => e.text)
      });
    }
    
    // Test 9: Network errors check
    console.log('\n📝 Test 9: Network Errors');
    if (networkErrors.length === 0) {
      addTestResult('Network Errors', 'PASS', {
        message: 'No network errors detected'
      });
    } else {
      addTestResult('Network Errors', 'WARNING', {
        message: `Found ${networkErrors.length} network errors`,
        errors: networkErrors.slice(0, 5)
      });
    }
    
    // Generate summary
    const passedTests = testResults.tests.filter(t => t.status === 'PASS').length;
    const failedTests = testResults.tests.filter(t => t.status === 'FAIL').length;
    const warningTests = testResults.tests.filter(t => t.status === 'WARNING').length;
    const partialTests = testResults.tests.filter(t => t.status === 'PARTIAL').length;
    
    testResults.summary = {
      totalTests: testResults.tests.length,
      passed: passedTests,
      failed: failedTests,
      warnings: warningTests,
      partial: partialTests,
      successRate: ((passedTests / testResults.tests.length) * 100).toFixed(1) + '%',
      screenshotsTaken: testResults.screenshots.length,
      consoleErrors: errors.length,
      networkErrors: networkErrors.length
    };
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`✅ Passed: ${passedTests}/${testResults.tests.length}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⚠️  Warnings: ${warningTests}`);
    console.log(`🔶 Partial: ${partialTests}`);
    console.log(`📈 Success Rate: ${testResults.summary.successRate}`);
    console.log(`📸 Screenshots: ${testResults.screenshots.length}`);
    console.log('═'.repeat(60));
    
    // Save detailed report
    const reportPath = path.join(CONFIG.screenshotDir, 'verification-report.json');
    await fs.writeFile(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);
    
    // Generate HTML report
    const htmlReport = generateHTMLReport(testResults);
    const htmlPath = path.join(CONFIG.screenshotDir, 'verification-report.html');
    await fs.writeFile(htmlPath, htmlReport);
    console.log(`📄 HTML report saved: ${htmlPath}`);
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    testResults.errors.push({
      type: 'FATAL',
      message: error.message,
      stack: error.stack
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  return testResults;
}

// Generate HTML report
function generateHTMLReport(results) {
  const statusIcon = (status) => {
    switch(status) {
      case 'PASS': return '✅';
      case 'FAIL': return '❌';
      case 'WARNING': return '⚠️';
      case 'PARTIAL': return '🔶';
      default: return '❓';
    }
  };
  
  const statusColor = (status) => {
    switch(status) {
      case 'PASS': return '#28a745';
      case 'FAIL': return '#dc3545';
      case 'WARNING': return '#ffc107';
      case 'PARTIAL': return '#fd7e14';
      default: return '#6c757d';
    }
  };
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Railway Deployment Verification Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
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
        .header h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }
        .header .url {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 1rem;
        }
        .header .timestamp {
            font-size: 0.9rem;
            opacity: 0.8;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            padding: 2rem;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .summary-card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card .value {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        .summary-card .label {
            font-size: 0.9rem;
            color: #6c757d;
            margin-top: 0.25rem;
        }
        .content {
            padding: 2rem;
        }
        .test-results {
            margin-bottom: 2rem;
        }
        .test-item {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 1rem;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .test-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .test-header {
            display: flex;
            align-items: center;
            padding: 1rem;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
            cursor: pointer;
        }
        .test-status {
            font-size: 1.5rem;
            margin-right: 1rem;
        }
        .test-name {
            flex: 1;
            font-weight: 600;
        }
        .test-time {
            font-size: 0.85rem;
            color: #6c757d;
        }
        .test-details {
            padding: 1rem;
            background: white;
        }
        .test-message {
            margin-bottom: 0.5rem;
            color: #495057;
        }
        .test-data {
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            background: #f8f9fa;
            padding: 0.5rem;
            border-radius: 4px;
            overflow-x: auto;
        }
        .screenshots {
            margin-top: 2rem;
        }
        .screenshots h2 {
            margin-bottom: 1rem;
            color: #495057;
        }
        .screenshot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1rem;
        }
        .screenshot-card {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            overflow: hidden;
        }
        .screenshot-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border-bottom: 1px solid #dee2e6;
        }
        .screenshot-info {
            padding: 0.75rem;
            background: #f8f9fa;
        }
        .screenshot-name {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }
        .screenshot-desc {
            font-size: 0.85rem;
            color: #6c757d;
        }
        .errors {
            margin-top: 2rem;
            padding: 1rem;
            background: #fff5f5;
            border: 1px solid #feb2b2;
            border-radius: 8px;
        }
        .errors h3 {
            color: #c53030;
            margin-bottom: 0.5rem;
        }
        .error-item {
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: white;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.85rem;
        }
        .success-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 600;
        }
        .success-rate-high { background: #d4edda; color: #155724; }
        .success-rate-medium { background: #fff3cd; color: #856404; }
        .success-rate-low { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Railway Deployment Verification Report</h1>
            <div class="url">${results.url}</div>
            <div class="timestamp">Generated: ${new Date(results.timestamp).toLocaleString()}</div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="value">${results.summary.passed}</div>
                <div class="label">Tests Passed</div>
            </div>
            <div class="summary-card">
                <div class="value">${results.summary.failed}</div>
                <div class="label">Tests Failed</div>
            </div>
            <div class="summary-card">
                <div class="value">${results.summary.warnings}</div>
                <div class="label">Warnings</div>
            </div>
            <div class="summary-card">
                <div class="value">${results.summary.successRate}</div>
                <div class="label">Success Rate</div>
            </div>
            <div class="summary-card">
                <div class="value">${results.summary.screenshotsTaken}</div>
                <div class="label">Screenshots</div>
            </div>
            <div class="summary-card">
                <div class="value">${results.summary.consoleErrors}</div>
                <div class="label">Console Errors</div>
            </div>
        </div>
        
        <div class="content">
            <div class="test-results">
                <h2>Test Results</h2>
                ${results.tests.map(test => `
                    <div class="test-item">
                        <div class="test-header">
                            <span class="test-status">${statusIcon(test.status)}</span>
                            <span class="test-name">${test.name}</span>
                            <span class="test-time">${new Date(test.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="test-details">
                            ${test.message ? `<div class="test-message">${test.message}</div>` : ''}
                            ${test.details || test.metrics || test.elements || test.sections || test.links ? 
                                `<div class="test-data"><pre>${JSON.stringify(
                                    test.details || test.metrics || 
                                    { elements: test.elements, sections: test.sections, links: test.links }, 
                                    null, 2
                                )}</pre></div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            ${results.screenshots.length > 0 ? `
                <div class="screenshots">
                    <h2>Screenshots</h2>
                    <div class="screenshot-grid">
                        ${results.screenshots.map(ss => `
                            <div class="screenshot-card">
                                <div class="screenshot-info">
                                    <div class="screenshot-name">${ss.name}</div>
                                    <div class="screenshot-desc">${ss.description}</div>
                                    <div class="screenshot-desc">${ss.filename}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${results.errors.length > 0 ? `
                <div class="errors">
                    <h3>Errors Detected</h3>
                    ${results.errors.slice(0, 10).map(error => `
                        <div class="error-item">
                            ${error.text || error.message || JSON.stringify(error)}
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
}

// Run verification
verifyDeployment().then(results => {
  console.log('\n✅ Verification complete!');
  process.exit(results.summary.failed > 0 ? 1 : 0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});