const { chromium } = require('playwright');

async function debugJSErrors() {
  console.log('🐛 Debugging JavaScript errors...');
  
  const browser = await chromium.launch({ headless: false, devtools: true });
  const page = await browser.newPage();
  
  // Capture ALL JavaScript errors
  page.on('pageerror', error => {
    console.error('🚨 PAGE ERROR:', error.message);
    console.error('📍 STACK TRACE:', error.stack);
  });
  
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error') {
      console.error(`🔴 CONSOLE ERROR: ${msg.text()}`);
    } else if (type === 'warn') {
      console.warn(`🟡 CONSOLE WARN: ${msg.text()}`);
    } else {
      console.log(`🔵 CONSOLE ${type.toUpperCase()}: ${msg.text()}`);
    }
  });
  
  // Capture network errors
  page.on('requestfailed', request => {
    console.error(`🌐 NETWORK ERROR: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  try {
    console.log('🌐 Navigating to http://localhost:3000/online');
    await page.goto('http://localhost:3000/online');
    
    // Wait for all resources to load
    await page.waitForLoadState('networkidle');
    console.log('✅ Page loaded, waiting for JavaScript to initialize...');
    
    // Give plenty of time for JavaScript to run and for errors to surface
    await page.waitForTimeout(5000);
    
    // Check what JavaScript variables are available
    const jsState = await page.evaluate(() => {
      const state = {
        hasAPI_BASE_URL: typeof API_BASE_URL !== 'undefined',
        API_BASE_URL_value: typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'undefined',
        hasAuthToken: typeof authToken !== 'undefined',
        hasCurrentUser: typeof currentUser !== 'undefined',
        loginFormExists: !!document.getElementById('login-form'),
        mainAppExists: !!document.getElementById('main-app'),
        hasCheckAuth: typeof checkAuth === 'function',
        hasShowMainApp: typeof showMainApp === 'function',
        DOMContentLoadedEventsFired: document.readyState,
        jsErrors: []
      };
      
      // Try to access problematic functions
      try {
        if (typeof checkAuth === 'function') {
          state.checkAuthAccessible = true;
        }
      } catch (e) {
        state.jsErrors.push('checkAuth error: ' + e.message);
      }
      
      return state;
    });
    
    console.log('🔍 JavaScript State Analysis:');
    console.log('  - API_BASE_URL defined:', jsState.hasAPI_BASE_URL);
    console.log('  - API_BASE_URL value:', jsState.API_BASE_URL_value);
    console.log('  - authToken defined:', jsState.hasAuthToken);
    console.log('  - currentUser defined:', jsState.hasCurrentUser);
    console.log('  - Login form exists:', jsState.loginFormExists);
    console.log('  - Main app exists:', jsState.mainAppExists);
    console.log('  - checkAuth function:', jsState.hasCheckAuth);
    console.log('  - showMainApp function:', jsState.hasShowMainApp);
    console.log('  - DOM ready state:', jsState.DOMContentLoadedEventsFired);
    
    if (jsState.jsErrors.length > 0) {
      console.log('🚨 JavaScript Errors Found:');
      jsState.jsErrors.forEach(error => console.log('  -', error));
    }
    
    // Try to manually trigger form submission
    console.log('🧪 Testing form submission manually...');
    await page.fill('#login-email', 'admin@conejonegro.com');
    await page.fill('#login-password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    console.log('✅ Debug analysis complete');
    
  } catch (error) {
    console.error('💥 DEBUG ERROR:', error.message);
  }
  
  // Auto-close after 10 seconds
  console.log('⏱️  Browser will close automatically in 10 seconds...');
  setTimeout(async () => {
    console.log('🔒 Closing browser automatically');
    await browser.close();
    process.exit(0);
  }, 10000);
}

debugJSErrors().catch(console.error);
