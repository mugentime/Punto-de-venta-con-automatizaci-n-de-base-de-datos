// Phase 5: End-to-End Authentication Testing
// Comprehensive test to verify complete authentication flow

const { chromium } = require('playwright');
const axios = require('axios');

console.log('🔄 PHASE 5: END-TO-END AUTHENTICATION TESTING');
console.log('==============================================\n');

const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3000/api';

async function runE2EAuthTests() {
    let browser;
    let context;
    let page;
    
    try {
        console.log('🚀 Starting E2E Authentication Tests...\n');
        
        // Step 1: Verify Backend is Ready
        console.log('1. 🔍 Verifying backend readiness...');
        
        try {
            const healthCheck = await axios.get(`${API_BASE}/health`);
            console.log('   ✅ Backend server is running');
            console.log('   📊 Server status:', healthCheck.data.status);
        } catch (error) {
            throw new Error('Backend server is not accessible');
        }
        
        // Step 2: Test Backend Authentication API
        console.log('\n2. 🔐 Testing backend authentication API...');
        
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('   ✅ Backend login successful');
        console.log('   🎟️ Token received:', loginResponse.data.token ? 'YES' : 'NO');
        
        const token = loginResponse.data.token;
        
        // Test protected route with token
        const productsResponse = await axios.get(`${API_BASE}/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('   ✅ Protected route access works');
        console.log('   📦 Products fetched:', productsResponse.data.length);
        
        // Step 3: Launch Browser for Frontend Testing
        console.log('\n3. 🌐 Launching browser for frontend testing...');
        
        browser = await chromium.launch({ 
            headless: false, // Show browser for debugging
            slowMo: 1000 // Slow down for visibility
        });
        
        context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });
        
        page = await context.newPage();
        
        // Enable request/response logging
        page.on('request', request => {
            if (request.url().includes('/api/')) {
                console.log('   📤 Frontend API Request:', request.method(), request.url().split('/api/')[1]);
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('/api/')) {
                console.log('   📥 Frontend API Response:', response.status(), response.url().split('/api/')[1]);
            }
        });
        
        // Step 4: Navigate to Application
        console.log('\n4. 🏠 Loading POS application...');
        
        await page.goto(`${BASE_URL}/online`);
        await page.waitForLoadState('networkidle');
        
        console.log('   ✅ Application loaded successfully');
        
        // Step 5: Test Login Flow
        console.log('\n5. 📝 Testing frontend login flow...');
        
        // Wait for login form to be visible
        await page.waitForSelector('#email', { timeout: 5000 });
        console.log('   ✅ Login form detected');
        
        // Fill in login credentials
        await page.fill('#email', 'admin@conejonegro.com');
        await page.fill('#password', 'admin123');
        console.log('   ✅ Login credentials entered');
        
        // Submit login form
        await page.click('button[type="submit"]');
        console.log('   ✅ Login form submitted');
        
        // Wait for authentication to complete
        await page.waitForTimeout(3000);
        
        // Step 6: Verify Login Success
        console.log('\n6. 🔍 Verifying login success...');
        
        // Check if login form is still visible (indicates login failed)
        const loginFormVisible = await page.isVisible('#email');
        
        if (loginFormVisible) {
            console.log('   ❌ Login form still visible - login may have failed');
            
            // Check for error messages
            const errorMessages = await page.locator('.error, .alert-danger, [class*="error"]').allTextContents();
            if (errorMessages.length > 0) {
                console.log('   🚨 Error messages found:', errorMessages);
            }
            
            // Take screenshot for debugging
            await page.screenshot({ path: 'login-failure-screenshot.png' });
            console.log('   📷 Screenshot saved: login-failure-screenshot.png');
            
        } else {
            console.log('   ✅ Login form disappeared - login appears successful');
        }
        
        // Check if main application interface is visible
        const appVisible = await page.isVisible('#app-container, .main-content, .dashboard');
        if (appVisible) {
            console.log('   ✅ Main application interface is visible');
        } else {
            console.log('   ❌ Main application interface not found');
        }
        
        // Step 7: Test Authenticated Features
        console.log('\n7. 🛠️ Testing authenticated features...');
        
        // Check if products/inventory section is accessible
        const productsSection = await page.locator('text=Productos, text=Products, text=Inventario').first();
        if (await productsSection.isVisible()) {
            console.log('   ✅ Products section is accessible');
        } else {
            console.log('   ⚠️ Products section not immediately visible');
        }
        
        // Check for any authentication-related elements
        const authElements = await page.locator('text=Cerrar sesión, text=Logout, text=Admin').allTextContents();
        if (authElements.length > 0) {
            console.log('   ✅ Authentication elements found:', authElements.slice(0, 3));
        }
        
        // Step 8: Verify Token Storage
        console.log('\n8. 🗄️ Verifying token storage...');
        
        const localStorageToken = await page.evaluate(() => {
            return localStorage.getItem('authToken') || localStorage.getItem('token');
        });
        
        if (localStorageToken) {
            console.log('   ✅ Auth token found in localStorage');
            console.log('   🎟️ Token preview:', localStorageToken.substring(0, 30) + '...');
        } else {
            console.log('   ❌ No auth token found in localStorage');
        }
        
        // Check sessionStorage as well
        const sessionStorageToken = await page.evaluate(() => {
            return sessionStorage.getItem('authToken') || sessionStorage.getItem('token');
        });
        
        if (sessionStorageToken) {
            console.log('   ✅ Auth token found in sessionStorage');
        }
        
        // Step 9: Final Assessment
        console.log('\n9. 📋 FINAL ASSESSMENT:');
        
        const testResults = {
            backendAuth: true,
            frontendLoaded: !loginFormVisible || appVisible,
            tokenStored: !!(localStorageToken || sessionStorageToken),
            authElementsVisible: authElements.length > 0
        };
        
        console.log('   Backend Authentication:', testResults.backendAuth ? '✅ PASS' : '❌ FAIL');
        console.log('   Frontend Login Flow:', testResults.frontendLoaded ? '✅ PASS' : '❌ FAIL');
        console.log('   Token Storage:', testResults.tokenStored ? '✅ PASS' : '❌ FAIL');
        console.log('   Auth UI Elements:', testResults.authElementsVisible ? '✅ PASS' : '❌ FAIL');
        
        const overallSuccess = Object.values(testResults).every(result => result);
        
        console.log('\n🎯 OVERALL RESULT:', overallSuccess ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED');
        
        if (overallSuccess) {
            console.log('🎉 End-to-End Authentication is working correctly!');
            console.log('🚀 The POS system is ready for production use!');
        } else {
            console.log('🔧 Some issues detected. Check the details above.');
        }
        
        // Keep browser open for manual inspection
        console.log('\n⏳ Browser will remain open for 10 seconds for manual inspection...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.log('\n❌ E2E Test Error:', error.message);
        
        if (page) {
            await page.screenshot({ path: 'e2e-test-error-screenshot.png' });
            console.log('📷 Error screenshot saved: e2e-test-error-screenshot.png');
        }
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('\n🔚 E2E Authentication Testing Complete');
    }
}

// Run the tests
runE2EAuthTests();
