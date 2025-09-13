// Global setup for Playwright tests
const { chromium } = require('@playwright/test');

async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  // Create a browser instance for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Check if the Railway deployment is accessible
    console.log('📡 Checking Railway deployment accessibility...');
    const response = await page.goto('https://pos-conejo-negro.railway.app', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    if (response && response.ok()) {
      console.log('✅ Railway deployment is accessible');
    } else {
      console.log('❌ Railway deployment may have issues');
    }
    
    // Take a screenshot of the initial state
    await page.screenshot({ 
      path: 'tests/test-results/setup-screenshot.png',
      fullPage: true 
    });
    
    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error.message);
    // Don't throw to allow tests to run and report the actual issues
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;