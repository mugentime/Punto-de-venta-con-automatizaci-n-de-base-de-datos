const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';

async function runLiveTests() {
  console.log('🚀 Starting Live Railway Deployment Tests');
  console.log(`🔗 Target: ${RAILWAY_URL}`);
  
  const browser = await chromium.launch({ 
    headless: false,  // Show browser for debugging
    slowMo: 1000      // Slow down actions for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'es-MX'
  });
  
  const page = await context.newPage();
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };
  
  // Test 1: Basic Connectivity
  console.log('\n📡 Test 1: Basic Connectivity');
  try {
    console.log(`   Navigating to: ${RAILWAY_URL}`);
    const response = await page.goto(RAILWAY_URL, { waitUntil: 'networkidle' });
    const status = response.status();
    console.log(`   Response status: ${status}`);
    
    if (status === 200) {
      console.log('   ✅ PASS: Railway deployment is accessible');
      results.tests.push({ name: 'Basic Connectivity', status: 'PASS', details: `HTTP ${status}` });
      results.summary.passed++;
    } else {
      console.log(`   ❌ FAIL: Unexpected status code ${status}`);
      results.tests.push({ name: 'Basic Connectivity', status: 'FAIL', details: `HTTP ${status}` });
      results.summary.failed++;
    }
    
    await page.screenshot({ path: 'tests/screenshots/railway-home.png', fullPage: true });
    
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.tests.push({ name: 'Basic Connectivity', status: 'FAIL', details: error.message });
    results.summary.failed++;
  }
  results.summary.total++;
  
  // Test 2: Page Content Analysis
  console.log('\n📄 Test 2: Page Content Analysis');
  try {
    const title = await page.title();
    console.log(`   Page title: "${title}"`);
    
    const content = await page.content();
    const hasApiPlaceholder = content.includes('Railway API') || content.includes('ASCII') || content.includes('░');
    const hasPOSContent = content.includes('POS') || content.includes('inventario') || content.includes('ventas') || content.includes('login');
    
    console.log(`   Is API placeholder: ${hasApiPlaceholder}`);
    console.log(`   Has POS content: ${hasPOSContent}`);
    
    if (hasPOSContent && !hasApiPlaceholder) {
      console.log('   ✅ PASS: POS application detected');
      results.tests.push({ name: 'Content Analysis', status: 'PASS', details: 'POS application loaded' });
      results.summary.passed++;
    } else if (hasApiPlaceholder) {
      console.log('   ⚠️  WARNING: API placeholder detected - POS app not deployed');
      results.tests.push({ name: 'Content Analysis', status: 'WARNING', details: 'API placeholder instead of POS app' });
      results.summary.failed++;
    } else {
      console.log('   ❓ UNKNOWN: Unable to determine content type');
      results.tests.push({ name: 'Content Analysis', status: 'UNKNOWN', details: 'Content type unclear' });
      results.summary.failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.tests.push({ name: 'Content Analysis', status: 'FAIL', details: error.message });
    results.summary.failed++;
  }
  results.summary.total++;
  
  // Test 3: Health Endpoints
  console.log('\n🏥 Test 3: Health Endpoints');
  try {
    // Test /api/health
    const healthResponse = await page.request.get(`${RAILWAY_URL}/api/health`);
    const healthStatus = healthResponse.status();
    console.log(`   /api/health: HTTP ${healthStatus}`);
    
    // Test /api/status
    const statusResponse = await page.request.get(`${RAILWAY_URL}/api/status`);
    const statusStatus = statusResponse.status();
    console.log(`   /api/status: HTTP ${statusStatus}`);
    
    const healthWorking = healthStatus === 200;
    const statusWorking = statusStatus === 200;
    
    if (healthWorking && statusWorking) {
      console.log('   ✅ PASS: Both health endpoints working');
      results.tests.push({ name: 'Health Endpoints', status: 'PASS', details: 'All endpoints responding' });
      results.summary.passed++;
    } else {
      console.log(`   ❌ FAIL: Health: ${healthStatus}, Status: ${statusStatus}`);
      results.tests.push({ name: 'Health Endpoints', status: 'FAIL', details: `Health: ${healthStatus}, Status: ${statusStatus}` });
      results.summary.failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.tests.push({ name: 'Health Endpoints', status: 'FAIL', details: error.message });
    results.summary.failed++;
  }
  results.summary.total++;
  
  // Test 4: Mobile Responsiveness
  console.log('\n📱 Test 4: Mobile Responsiveness');
  try {
    const viewports = [
      { width: 375, height: 667, name: 'Mobile' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 1920, height: 1080, name: 'Desktop' }
    ];
    
    let responsive = true;
    
    for (const viewport of viewports) {
      console.log(`   Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload({ waitUntil: 'networkidle' });
      
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const hasHorizontalScroll = bodyWidth > viewport.width + 20; // 20px tolerance
      
      console.log(`     Body width: ${bodyWidth}px, Viewport: ${viewport.width}px`);
      
      if (hasHorizontalScroll) {
        console.log(`     ⚠️  Horizontal scroll detected on ${viewport.name}`);
        responsive = false;
      }
      
      await page.screenshot({ 
        path: `tests/screenshots/railway-${viewport.name.toLowerCase()}.png`,
        fullPage: true 
      });
    }
    
    if (responsive) {
      console.log('   ✅ PASS: Responsive across all viewports');
      results.tests.push({ name: 'Mobile Responsiveness', status: 'PASS', details: 'Responsive design confirmed' });
      results.summary.passed++;
    } else {
      console.log('   ❌ FAIL: Layout issues detected');
      results.tests.push({ name: 'Mobile Responsiveness', status: 'FAIL', details: 'Horizontal scroll detected' });
      results.summary.failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.tests.push({ name: 'Mobile Responsiveness', status: 'FAIL', details: error.message });
    results.summary.failed++;
  }
  results.summary.total++;
  
  // Test 5: Performance Testing
  console.log('\n⚡ Test 5: Performance Testing');
  try {
    const loadTimes = [];
    const testRuns = 3;
    
    for (let i = 0; i < testRuns; i++) {
      const startTime = Date.now();
      await page.reload({ waitUntil: 'networkidle' });
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      loadTimes.push(loadTime);
      console.log(`   Run ${i + 1}: ${loadTime}ms`);
    }
    
    const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    console.log(`   Average load time: ${avgLoadTime.toFixed(0)}ms`);
    
    if (avgLoadTime < 5000) {
      console.log('   ✅ PASS: Performance is good');
      results.tests.push({ name: 'Performance', status: 'PASS', details: `${avgLoadTime.toFixed(0)}ms avg` });
      results.summary.passed++;
    } else {
      console.log('   ⚠️  WARNING: Slow load times detected');
      results.tests.push({ name: 'Performance', status: 'WARNING', details: `${avgLoadTime.toFixed(0)}ms avg (slow)` });
      results.summary.failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.tests.push({ name: 'Performance', status: 'FAIL', details: error.message });
    results.summary.failed++;
  }
  results.summary.total++;
  
  // Test 6: Security Headers
  console.log('\n🛡️  Test 6: Security Headers');
  try {
    const response = await page.request.get(RAILWAY_URL);
    const headers = response.headers();
    
    const securityHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy'
    ];
    
    const found = [];
    const missing = [];
    
    securityHeaders.forEach(header => {
      if (headers[header]) {
        found.push(header);
        console.log(`   ✅ ${header}: ${headers[header]}`);
      } else {
        missing.push(header);
        console.log(`   ❌ Missing: ${header}`);
      }
    });
    
    const score = Math.round((found.length / securityHeaders.length) * 100);
    console.log(`   Security score: ${score}% (${found.length}/${securityHeaders.length})`);
    
    if (score >= 80) {
      console.log('   ✅ PASS: Good security header coverage');
      results.tests.push({ name: 'Security Headers', status: 'PASS', details: `${score}% coverage` });
      results.summary.passed++;
    } else {
      console.log('   ⚠️  WARNING: Insufficient security headers');
      results.tests.push({ name: 'Security Headers', status: 'WARNING', details: `${score}% coverage (low)` });
      results.summary.failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
    results.tests.push({ name: 'Security Headers', status: 'FAIL', details: error.message });
    results.summary.failed++;
  }
  results.summary.total++;
  
  // Close browser
  await browser.close();
  
  // Generate Report
  console.log('\n📊 Test Results Summary');
  console.log('=' .repeat(50));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} ✅`);
  console.log(`Failed/Warning: ${results.summary.failed} ❌`);
  console.log(`Success Rate: ${Math.round((results.summary.passed / results.summary.total) * 100)}%`);
  
  // Save results
  const reportPath = path.join(process.cwd(), 'tests', 'railway-live-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved: ${reportPath}`);
  
  return results;
}

if (require.main === module) {
  runLiveTests().catch(console.error);
}

module.exports = { runLiveTests };