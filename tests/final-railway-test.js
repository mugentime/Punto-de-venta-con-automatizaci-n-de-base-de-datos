const { chromium } = require('playwright');
const fs = require('fs');

const RAILWAY_URL = 'https://pos-conejo-negro.railway.app';

async function runFinalRailwayTest() {
  console.log('🎯 Running Final Railway Deployment Test');
  console.log('=' .repeat(50));
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  const results = {
    timestamp: new Date().toISOString(),
    url: RAILWAY_URL,
    tests: []
  };
  
  // Test 1: Basic Connectivity
  console.log('\n🔗 Test 1: Basic Connectivity');
  try {
    const response = await page.goto(RAILWAY_URL, { waitUntil: 'networkidle', timeout: 30000 });
    const status = response.status();
    console.log(`   Status: ${status}`);
    
    results.tests.push({
      name: 'Connectivity',
      status: status === 200 ? 'PASS' : 'FAIL',
      httpStatus: status,
      details: `HTTP ${status}`
    });
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.tests.push({
      name: 'Connectivity',
      status: 'FAIL',
      error: error.message
    });
  }
  
  // Test 2: Content Analysis  
  console.log('\n📄 Test 2: Content Analysis');
  try {
    const title = await page.title();
    const content = await page.content();
    
    const hasPOS = content.includes('POS') || content.includes('main-app') || content.includes('inventario') || title.includes('POS');
    const hasPlaceholder = content.includes('Railway API') || content.includes('ASCII') || content.includes('░');
    
    console.log(`   Title: "${title}"`);
    console.log(`   Has POS Content: ${hasPOS}`);
    console.log(`   Has API Placeholder: ${hasPlaceholder}`);
    
    const contentStatus = hasPOS && !hasPlaceholder ? 'PASS' : 'FAIL';
    console.log(`   Assessment: ${contentStatus}`);
    
    results.tests.push({
      name: 'Content Analysis',
      status: contentStatus,
      title,
      hasPOS,
      hasPlaceholder,
      details: hasPOS ? 'POS application detected' : 'API placeholder detected'
    });
    
    // Take screenshot
    await page.screenshot({ 
      path: `tests/screenshots/railway-final-test-${Date.now()}.png`,
      fullPage: true 
    });
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.tests.push({
      name: 'Content Analysis',
      status: 'FAIL',
      error: error.message
    });
  }
  
  // Test 3: Health Endpoints
  console.log('\n🏥 Test 3: Health Endpoints');
  try {
    const healthResponse = await page.request.get(`${RAILWAY_URL}/api/health`);
    const statusResponse = await page.request.get(`${RAILWAY_URL}/api/status`);
    
    const healthOK = healthResponse.status() === 200;
    const statusOK = statusResponse.status() === 200;
    
    console.log(`   /api/health: ${healthResponse.status()} ${healthOK ? '✅' : '❌'}`);
    console.log(`   /api/status: ${statusResponse.status()} ${statusOK ? '✅' : '❌'}`);
    
    if (healthOK) {
      try {
        const healthData = await healthResponse.json();
        console.log(`   Uptime: ${Math.round(healthData.uptime || 0)}s`);
        console.log(`   Status: ${healthData.status}`);
      } catch (e) {
        console.log('   Could not parse health response');
      }
    }
    
    const healthStatus = healthOK && statusOK ? 'PASS' : 'FAIL';
    results.tests.push({
      name: 'Health Endpoints',
      status: healthStatus,
      healthStatus: healthResponse.status(),
      statusStatus: statusResponse.status(),
      details: `Health: ${healthResponse.status()}, Status: ${statusResponse.status()}`
    });
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.tests.push({
      name: 'Health Endpoints',
      status: 'FAIL',
      error: error.message
    });
  }
  
  // Test 4: POS Functionality
  console.log('\n🏪 Test 4: POS Functionality');
  try {
    const loginForms = await page.locator('form, #login-form, [class*="login"], [id*="login"]').count();
    const navElements = await page.locator('nav, [class*="nav"], [data-section]').count();
    const posElements = await page.locator('[id*="main-app"], [class*="pos"], [id*="inventario"], [id*="ventas"]').count();
    const buttons = await page.locator('button').count();
    
    console.log(`   Login forms: ${loginForms}`);
    console.log(`   Navigation elements: ${navElements}`);
    console.log(`   POS elements: ${posElements}`);
    console.log(`   Buttons: ${buttons}`);
    
    const hasUIElements = loginForms > 0 || navElements > 0 || posElements > 0 || buttons > 0;
    const functionalityStatus = hasUIElements ? 'PASS' : 'FAIL';
    
    console.log(`   UI Elements Present: ${hasUIElements ? '✅' : '❌'}`);
    
    results.tests.push({
      name: 'POS Functionality',
      status: functionalityStatus,
      loginForms,
      navElements,
      posElements,
      buttons,
      details: hasUIElements ? 'UI elements detected' : 'No UI elements found'
    });
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.tests.push({
      name: 'POS Functionality',
      status: 'FAIL',
      error: error.message
    });
  }
  
  // Test 5: Performance Check
  console.log('\n⚡ Test 5: Performance Check');
  try {
    const loadTimes = [];
    for (let i = 0; i < 3; i++) {
      const startTime = Date.now();
      await page.reload({ waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;
      loadTimes.push(loadTime);
      console.log(`   Load ${i + 1}: ${loadTime}ms`);
    }
    
    const avgLoadTime = Math.round(loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length);
    console.log(`   Average: ${avgLoadTime}ms`);
    
    const perfStatus = avgLoadTime < 5000 ? 'PASS' : 'WARNING';
    
    results.tests.push({
      name: 'Performance',
      status: perfStatus,
      averageLoadTime: avgLoadTime,
      loadTimes,
      details: `${avgLoadTime}ms average load time`
    });
    
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    results.tests.push({
      name: 'Performance',
      status: 'FAIL',
      error: error.message
    });
  }
  
  await browser.close();
  
  // Generate Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('=' .repeat(50));
  
  const passed = results.tests.filter(t => t.status === 'PASS').length;
  const total = results.tests.length;
  const successRate = Math.round((passed / total) * 100);
  
  console.log(`Total Tests: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${total - passed} ❌`);
  console.log(`Success Rate: ${successRate}%`);
  
  results.summary = {
    totalTests: total,
    passed,
    failed: total - passed,
    successRate
  };
  
  // Determine overall status
  const contentTest = results.tests.find(t => t.name === 'Content Analysis');
  const healthTest = results.tests.find(t => t.name === 'Health Endpoints');
  
  if (contentTest?.status === 'PASS' && healthTest?.status === 'PASS') {
    results.overallStatus = 'FULLY_DEPLOYED';
    console.log('\n🎉 DEPLOYMENT SUCCESS! Railway is serving the POS application!');
  } else if (contentTest?.status === 'PASS') {
    results.overallStatus = 'PARTIAL_DEPLOYMENT';
    console.log('\n⚠️  PARTIAL SUCCESS: POS app deployed but health endpoints need fixing');
  } else {
    results.overallStatus = 'DEPLOYMENT_PENDING';
    console.log('\n⏳ DEPLOYMENT PENDING: Still waiting for POS application to deploy');
  }
  
  // Save results
  const reportPath = 'tests/final-railway-test-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved: ${reportPath}`);
  
  return results;
}

if (require.main === module) {
  runFinalRailwayTest().catch(console.error);
}

module.exports = { runFinalRailwayTest };