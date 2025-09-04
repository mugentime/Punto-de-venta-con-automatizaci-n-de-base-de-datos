const { chromium } = require('playwright');

async function debugJSLogin() {
  console.log('🔍 Starting JavaScript login debug...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000/online');
    await page.waitForLoadState('networkidle');
    
    // Inject debugging code directly into the browser
    const result = await page.evaluate(() => {
      const results = {
        formExists: false,
        submitButtonExists: false,
        eventListenerAttached: false,
        apiBaseUrl: '',
        authToken: '',
        jsErrors: []
      };
      
      // Check form elements
      const form = document.getElementById('login-form');
      const submitBtn = document.querySelector('#login-form button[type="submit"]');
      
      results.formExists = !!form;
      results.submitButtonExists = !!submitBtn;
      results.apiBaseUrl = window.API_BASE_URL || 'undefined';
      results.authToken = localStorage.getItem('authToken') || 'null';
      
      // Check if event listener is working by trying to add our own
      if (form) {
        // Remove existing listeners by cloning the form
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        
        // Add our test listener
        newForm.addEventListener('submit', function(e) {
          console.log('🎯 FORM SUBMIT EVENT TRIGGERED!');
          results.eventListenerAttached = true;
        });
        
        // Simulate form submission
        const event = new Event('submit', { bubbles: true, cancelable: true });
        newForm.dispatchEvent(event);
      }
      
      return results;
    });
    
    console.log('🔍 JavaScript Analysis:');
    console.log(`  - Form exists: ${result.formExists ? '✅' : '❌'}`);
    console.log(`  - Submit button exists: ${result.submitButtonExists ? '✅' : '❌'}`);
    console.log(`  - Event listener test: ${result.eventListenerAttached ? '✅' : '❌'}`);
    console.log(`  - API_BASE_URL: ${result.apiBaseUrl}`);
    console.log(`  - Auth token in storage: ${result.authToken}`);
    
    // Now let's try to manually trigger the login
    console.log('🧪 Testing manual form submission...');
    
    await page.fill('#login-email', 'admin@conejonegro.com');
    await page.fill('#login-password', 'admin123');
    
    // Try different ways to submit
    console.log('🎯 Attempt 1: Click submit button');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Check if we can manually call the API
    console.log('🎯 Attempt 2: Manual API call via browser console');
    const apiResult = await page.evaluate(async () => {
      try {
        const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:3000/api' 
          : `${window.location.protocol}//${window.location.host}/api`;
          
        console.log('Making manual API call to:', API_BASE_URL + '/auth/login');
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            email: 'admin@conejonegro.com', 
            password: 'admin123' 
          })
        });
        
        const data = await response.json();
        console.log('API Response:', response.status, data);
        
        if (response.ok && data.token) {
          // Try to manually show main app
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('currentUser', JSON.stringify(data.user));
          
          document.getElementById('login-screen').classList.add('hidden');
          document.getElementById('main-app').style.display = 'block';
          
          return { success: true, data: data };
        } else {
          return { success: false, error: data.error || 'Unknown error' };
        }
      } catch (error) {
        console.error('Manual API call failed:', error);
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔍 Manual API test result:');
    console.log(`  - Success: ${apiResult.success ? '✅' : '❌'}`);
    if (apiResult.success) {
      console.log(`  - Token received: ✅`);
    } else {
      console.log(`  - Error: ${apiResult.error}`);
    }
    
    // Final state check
    await page.waitForTimeout(1000);
    const loginVisible = await page.locator('#login-screen').isVisible();
    const mainAppVisible = await page.locator('#main-app').isVisible();
    
    console.log('🔍 Final state after manual intervention:');
    console.log(`  - Login screen visible: ${loginVisible ? '❌' : '✅'}`);
    console.log(`  - Main app visible: ${mainAppVisible ? '✅' : '❌'}`);
    
    if (mainAppVisible) {
      console.log('🎉 SUCCESS! Manual login worked - the issue is with the form event listener!');
    } else {
      console.log('❌ Even manual API call failed - deeper JavaScript issue');
    }
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
  
  await browser.close();
}

debugJSLogin().catch(console.error);
