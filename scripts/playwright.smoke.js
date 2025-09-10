const { chromium } = require('playwright');

async function runSmokeTest() {
  let browser;
  
  try {
    console.log('🚀 Starting Playwright smoke test...');
    
    // Launch browser
    browser = await chromium.launch({ headless: true });
    console.log('✅ Browser launched successfully');
    
    // Create page
    const page = await browser.newPage();
    console.log('✅ Page created successfully');
    
    // Navigate to POS app
    console.log('🌐 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // Get page title
    const title = await page.title();
    console.log(`✅ Page loaded successfully. Title: "${title}"`);
    
    // Check if page has some expected content
    const bodyText = await page.textContent('body');
    if (bodyText.includes('Conejo Negro') || bodyText.includes('POS') || bodyText.includes('Login')) {
      console.log('✅ Page contains expected content');
    } else {
      console.log('⚠️ Page may not have expected content');
    }
    
    // Take a screenshot for verification
    await page.screenshot({ path: './logs/smoke-test-screenshot.png' });
    console.log('📷 Screenshot saved to ./logs/smoke-test-screenshot.png');
    
    console.log('🎉 Smoke test completed successfully!');
    return { success: true, title };
    
  } catch (error) {
    console.error('❌ Smoke test failed:', error.message);
    return { success: false, error: error.message };
    
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the smoke test
runSmokeTest().then((result) => {
  if (result.success) {
    console.log('\n✅ SMOKE TEST PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ SMOKE TEST FAILED');
    console.error('Error:', result.error);
    process.exit(1);
  }
});
