const { chromium } = require('playwright');

async function finalLoginTest() {
  console.log('🎯 Final login test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  page.on('pageerror', error => {
    console.error('🚨 PAGE ERROR:', error.message);
  });
  
  try {
    await page.goto('http://localhost:3000/online');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Page loaded successfully');
    
    // Check if login screen is visible
    const loginScreen = await page.locator('#login-screen').isVisible();
    console.log('🔍 Login screen visible:', loginScreen);
    
    // Check if main app is hidden
    const mainApp = await page.locator('#main-app').isVisible();
    console.log('🔍 Main app visible:', mainApp);
    
    if (loginScreen) {
      console.log('📝 Filling login form...');
      await page.fill('#login-email', 'admin@conejonegro.com');
      await page.fill('#login-password', 'admin123');
      
      console.log('🚀 Submitting login form...');
      await page.click('button[type="submit"]');
      
      // Wait for login to process
      await page.waitForTimeout(3000);
      
      // Check the results
      const loginScreenAfter = await page.locator('#login-screen').isVisible();
      const mainAppAfter = await page.locator('#main-app').isVisible();
      
      console.log('🔍 After login:');
      console.log('  - Login screen visible:', loginScreenAfter);
      console.log('  - Main app visible:', mainAppAfter);
      
      if (!loginScreenAfter && mainAppAfter) {
        console.log('🎉 SUCCESS! Login worked perfectly!');
        console.log('✅ The main POS application is now visible');
        
        // Take a screenshot as proof
        await page.screenshot({ path: 'login-success.png' });
        console.log('📸 Screenshot saved as login-success.png');
      } else {
        console.log('❌ Login transition did not work as expected');
      }
    } else {
      console.log('ℹ️  User is already logged in');
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
  
  console.log('⏱️  Browser will stay open for 10 seconds...');
  setTimeout(async () => {
    await browser.close();
    console.log('✅ Test completed!');
    process.exit(0);
  }, 10000);
}

finalLoginTest().catch(console.error);
