const { test, expect } = require('@playwright/test');

const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';

test.describe('Live Railway Deployment Tests', () => {
  
  test('should access Railway deployment successfully', async ({ page }) => {
    console.log(`🔗 Testing Railway deployment: ${RAILWAY_URL}`);
    
    // Navigate to Railway deployment
    await page.goto(RAILWAY_URL);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/railway-home.png', fullPage: true });
    
    // Check if page loads successfully
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check response status
    expect(page.url()).toBe(RAILWAY_URL + '/');
  });

  test('should check health endpoints', async ({ page }) => {
    console.log('🏥 Testing health endpoints...');
    
    // Test health endpoint
    const healthResponse = await page.request.get(`${RAILWAY_URL}/api/health`);
    console.log(`❤️ Health status: ${healthResponse.status()}`);
    
    if (healthResponse.ok()) {
      const healthData = await healthResponse.json();
      console.log('✅ Health endpoint working:', healthData);
    }
    
    // Test status endpoint
    const statusResponse = await page.request.get(`${RAILWAY_URL}/api/status`);
    console.log(`📊 Status endpoint: ${statusResponse.status()}`);
    
    if (statusResponse.ok()) {
      const statusData = await statusResponse.json();
      console.log('✅ Status endpoint working:', statusData);
    }
  });

  test('should check for POS application elements', async ({ page }) => {
    console.log('🏪 Checking for POS application...');
    
    await page.goto(RAILWAY_URL);
    await page.waitForLoadState('networkidle');
    
    // Check for login form
    const loginForm = await page.locator('form, #login-form, [class*="login"]').count();
    console.log(`🔐 Login forms found: ${loginForm}`);
    
    // Check for navigation elements
    const navElements = await page.locator('nav, [class*="nav"], [data-section]').count();
    console.log(`🧭 Navigation elements found: ${navElements}`);
    
    // Check for POS-specific elements
    const posElements = await page.locator('[class*="pos"], [id*="inventario"], [id*="ventas"]').count();
    console.log(`🏪 POS elements found: ${posElements}`);
    
    // Get page content for analysis
    const pageContent = await page.content();
    const hasApiWelcome = pageContent.includes('Railway API') || pageContent.includes('ASCII');
    console.log(`🤖 Is API placeholder: ${hasApiWelcome}`);
    
    // Take full page screenshot
    await page.screenshot({ path: 'tests/screenshots/railway-content-analysis.png', fullPage: true });
  });

  test('should test mobile responsiveness', async ({ page }) => {
    console.log('📱 Testing mobile responsiveness...');
    
    // Test different viewport sizes
    const viewports = [
      { width: 375, height: 667, name: 'iPhone' },
      { width: 768, height: 1024, name: 'iPad' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      console.log(`📐 Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(RAILWAY_URL);
      await page.waitForLoadState('networkidle');
      
      // Take screenshot for each viewport
      await page.screenshot({ 
        path: `tests/screenshots/railway-${viewport.name.toLowerCase()}.png`, 
        fullPage: true 
      });
      
      // Check if page is responsive
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = viewport.width;
      
      console.log(`   Body width: ${bodyWidth}px, Viewport: ${viewportWidth}px`);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // Allow small tolerance
    }
  });

  test('should perform load testing', async ({ page }) => {
    console.log('⚡ Performing load testing...');
    
    const testRuns = 5;
    const results = [];
    
    for (let i = 0; i < testRuns; i++) {
      const startTime = Date.now();
      
      await page.goto(RAILWAY_URL, { waitUntil: 'networkidle' });
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      results.push(loadTime);
      console.log(`   Run ${i + 1}: ${loadTime}ms`);
    }
    
    const avgLoadTime = results.reduce((a, b) => a + b, 0) / results.length;
    console.log(`📊 Average load time: ${avgLoadTime.toFixed(2)}ms`);
    
    // Performance should be reasonable
    expect(avgLoadTime).toBeLessThan(10000); // Less than 10 seconds
  });

  test('should check security headers', async ({ page }) => {
    console.log('🛡️ Checking security headers...');
    
    const response = await page.request.get(RAILWAY_URL);
    const headers = response.headers();
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options', 
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy'
    ];
    
    const foundHeaders = [];
    const missingHeaders = [];
    
    securityHeaders.forEach(header => {
      if (headers[header]) {
        foundHeaders.push(header);
        console.log(`✅ ${header}: ${headers[header]}`);
      } else {
        missingHeaders.push(header);
        console.log(`❌ Missing: ${header}`);
      }
    });
    
    console.log(`🛡️ Security headers: ${foundHeaders.length}/${securityHeaders.length} found`);
  });

});