const { chromium } = require('playwright');

async function testLoginFixed() {
  console.log('🔍 Testing fixed login functionality...');
  
  const browser = await chromium.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  
  // Listen to all console messages and network activity
  page.on('console', msg => {
    console.log(`BROWSER: ${msg.type().toUpperCase()} ${msg.text()}`);
  });
  
  page.on('request', request => {
    if (request.url().includes('/api/auth/login')) {
      console.log(`📡 API REQUEST: ${request.method()} ${request.url()}`);
      console.log(`📦 REQUEST BODY: ${request.postData()}`);
    }
  });
  
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
    console.log('🌐 Navigating to http://localhost:3000/online');
    await page.goto('http://localhost:3000/online');
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded');
    
    // Wait a bit for all JavaScript to initialize
    await page.waitForTimeout(2000);
    
    // Fill login form
    console.log('📝 Filling login form...');
    await page.fill('#login-email', 'admin@conejonegro.com');
    await page.fill('#login-password', 'admin123');
    
    // Submit form
    console.log('🚀 Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for login process
    console.log('⏳ Waiting for login to process...');
    await page.waitForTimeout(5000);
    
    // Check final state
    const loginScreenVisible = await page.locator('#login-screen').isVisible();
    const mainAppVisible = await page.locator('#main-app').isVisible();
    
    console.log('🔍 Final state:');
    console.log(`  - Login screen visible: ${loginScreenVisible ? '❌ (should be hidden)' : '✅'}`);
    console.log(`  - Main app visible: ${mainAppVisible ? '✅' : '❌ (should be visible)'}`);
    
    if (mainAppVisible) {
      console.log('🎉 SUCCESS! Login now works correctly!');
      
      // Check if we can see user info
      try {
        const userNameText = await page.textContent('#user-name');
        console.log(`👤 Logged in as: ${userNameText}`);
      } catch (error) {
        console.log('👤 User name not visible yet');
      }
    } else {
      console.log('❌ LOGIN STILL FAILED - Checking for errors...');
      
      // Check if there are any error messages
      const errorElements = await page.locator('.error, .notification, [class*="error"]').count();
      if (errorElements > 0) {
        const errorTexts = await page.locator('.error, .notification, [class*="error"]').allTextContents();
        console.log('🚨 Error messages found:', errorTexts);
      }
    }
    
  } catch (error) {
    console.error('💥 TEST ERROR:', error.message);
  }
  
  // Auto-close after 10 seconds
  console.log('⏱️  Browser will close automatically in 10 seconds...');
  setTimeout(async () => {
    console.log('🔒 Closing browser automatically');
    await browser.close();
    process.exit(0);
  }, 10000);
}

testLoginFixed().catch(console.error);
