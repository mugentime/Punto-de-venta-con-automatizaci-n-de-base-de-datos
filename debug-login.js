const { chromium } = require('playwright');

async function debugLogin() {
  console.log('🔍 Starting login debug...');
  
  const browser = await chromium.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  
  // Listen to console messages
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.type().toUpperCase()} ${msg.text()}`);
  });
  
  // Listen to network requests
  page.on('request', request => {
    if (request.url().includes('/api/auth/login')) {
      console.log(`📡 API REQUEST: ${request.method()} ${request.url()}`);
      console.log(`📦 REQUEST BODY: ${request.postData()}`);
    }
  });
  
  // Listen to network responses
  page.on('response', async response => {
    if (response.url().includes('/api/auth/login')) {
      console.log(`📬 API RESPONSE: ${response.status()} ${response.statusText()}`);
      try {
        const responseBody = await response.text();
        console.log(`📥 RESPONSE BODY: ${responseBody}`);
      } catch (error) {
        console.log(`❌ Error reading response: ${error.message}`);
      }
    }
  });
  
  try {
    // Navigate to the login page
    console.log('🌐 Navigating to http://localhost:3000/online');
    await page.goto('http://localhost:3000/online');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Check if main elements exist
    const loginScreenExists = await page.locator('#login-screen').count() > 0;
    const mainAppExists = await page.locator('#main-app').count() > 0;
    const loginFormExists = await page.locator('#login-form').count() > 0;
    const emailFieldExists = await page.locator('#login-email').count() > 0;
    const passwordFieldExists = await page.locator('#login-password').count() > 0;
    
    console.log('🔍 Element check:');
    console.log(`  - #login-screen: ${loginScreenExists ? '✅' : '❌'}`);
    console.log(`  - #main-app: ${mainAppExists ? '✅' : '❌'}`);
    console.log(`  - #login-form: ${loginFormExists ? '✅' : '❌'}`);
    console.log(`  - #login-email: ${emailFieldExists ? '✅' : '❌'}`);
    console.log(`  - #login-password: ${passwordFieldExists ? '✅' : '❌'}`);
    
    if (!loginFormExists || !emailFieldExists || !passwordFieldExists) {
      console.log('❌ Login form elements missing! Cannot proceed.');
      await browser.close();
      return;
    }
    
    // Fill login form
    console.log('📝 Filling login form...');
    await page.fill('#login-email', 'admin@conejonegro.com');
    await page.fill('#login-password', 'admin123');
    
    // Check what was filled
    const emailValue = await page.inputValue('#login-email');
    const passwordValue = await page.inputValue('#login-password');
    console.log(`📝 Email filled: ${emailValue}`);
    console.log(`📝 Password filled: ${passwordValue ? '✅ (hidden)' : '❌ (empty)'}`);
    
    // Submit form and monitor what happens
    console.log('🚀 Submitting form...');
    await page.click('button[type="submit"]');
    
    // Wait a bit to see what happens
    await page.waitForTimeout(5000);
    
    // Check final state
    const loginScreenVisible = await page.locator('#login-screen').isVisible();
    const mainAppVisible = await page.locator('#main-app').isVisible();
    
    console.log('🔍 Final state:');
    console.log(`  - Login screen visible: ${loginScreenVisible ? '❌ (should be hidden)' : '✅'}`);
    console.log(`  - Main app visible: ${mainAppVisible ? '✅' : '❌ (should be visible)'}`);
    
    if (mainAppVisible) {
      console.log('🎉 LOGIN SUCCESS!');
    } else {
      console.log('❌ LOGIN FAILED - Still on login screen');
    }
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
  
  console.log('⏸️  Browser will stay open for manual inspection. Close it when done.');
  // Don't close browser so you can inspect manually
  // await browser.close();
}

debugLogin().catch(console.error);
