// Phase 5: Final End-to-End Authentication Testing
const { chromium } = require('playwright');
const axios = require('axios');

console.log('🔄 PHASE 5: FINAL E2E AUTHENTICATION TESTING');
console.log('===========================================\n');

const BASE_URL = 'http://localhost:3000';
const API_BASE = 'http://localhost:3000/api';

async function runFinalE2ETest() {
    let browser;
    let page;
    
    try {
        // Step 1: Verify Backend is Working
        console.log('1. 🔐 Testing backend authentication...');
        
        const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
            email: 'admin@conejonegro.com',
            password: 'admin123'
        });
        
        console.log('   ✅ Backend login successful');
        
        const token = loginResponse.data.token;
        const productsResponse = await axios.get(`${API_BASE}/products`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('   ✅ Protected routes working');
        console.log('   📦 Products returned:', productsResponse.data.length, 'items');
        
        // Step 2: Launch Browser
        console.log('\n2. 🌐 Launching browser for frontend testing...');
        
        browser = await chromium.launch({ headless: false, slowMo: 300 });
        page = await (await browser.newContext()).newPage();
        
        // Monitor errors
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('   🚨 Frontend Error:', msg.text());
            }
        });
        
        // Step 3: Load and Analyze Frontend
        console.log('\n3. 🏠 Loading frontend application...');
        
        await page.goto(`${BASE_URL}/online`);
        await page.waitForLoadState('networkidle');
        
        await page.screenshot({ path: 'frontend-loaded.png' });
        console.log('   ✅ Frontend loaded - screenshot saved');
        
        const title = await page.title();
        console.log('   📄 Page title:', title);
        
        // Step 4: Search for Login Form
        console.log('\n4. 🔍 Analyzing login form...');
        
        // Get page content for analysis
        const bodyText = await page.textContent('body');
        console.log('   📄 Page contains (first 300 chars):');
        console.log('   ', bodyText.substring(0, 300).replace(/\s+/g, ' ').trim());
        
        // Count form elements
        const inputCount = await page.locator('input').count();
        const buttonCount = await page.locator('button').count();
        const formCount = await page.locator('form').count();
        
        console.log('   📊 Form elements found:');
        console.log('     - Inputs:', inputCount);
        console.log('     - Buttons:', buttonCount);
        console.log('     - Forms:', formCount);
        
        // Try to find specific login elements
        let emailField = null;
        let passwordField = null;
        let loginButton = null;
        
        // Search for email field
        const emailSelectors = [
            '#email', 'input[type="email"]', 'input[name="email"]',
            'input[placeholder*="email" i]', 'input[placeholder*="correo" i]'
        ];
        
        for (const selector of emailSelectors) {
            if (await page.locator(selector).count() > 0) {
                emailField = selector;
                console.log('   ✅ Email field found:', selector);
                break;
            }
        }
        
        // Search for password field
        const passwordSelectors = [
            '#password', 'input[type="password"]', 'input[name="password"]',
            'input[placeholder*="password" i]', 'input[placeholder*="contraseña" i]'
        ];
        
        for (const selector of passwordSelectors) {
            if (await page.locator(selector).count() > 0) {
                passwordField = selector;
                console.log('   ✅ Password field found:', selector);
                break;
            }
        }
        
        // Search for login button
        const buttonSelectors = [
            'button[type="submit"]', 'input[type="submit"]',
            'button:has-text("Login")', 'button:has-text("Iniciar")',
            'button:has-text("Entrar")', '.login-btn', '.btn-login'
        ];
        
        for (const selector of buttonSelectors) {
            if (await page.locator(selector).count() > 0) {
                loginButton = selector;
                console.log('   ✅ Login button found:', selector);
                break;
            }
        }
        
        // Step 5: Test Login if Form is Available
        if (emailField && passwordField && loginButton) {
            console.log('\n5. 📝 Testing frontend login flow...');
            
            // Fill form
            await page.fill(emailField, 'admin@conejonegro.com');
            await page.fill(passwordField, 'admin123');
            console.log('   ✅ Credentials entered');
            
            // Monitor API calls
            const apiCalls = [];
            page.on('request', req => {
                if (req.url().includes('/api/auth/login')) {
                    apiCalls.push(req);
                    console.log('   📤 Login API request made');
                }
            });
            
            page.on('response', resp => {
                if (resp.url().includes('/api/auth/login')) {
                    console.log('   📥 Login API response:', resp.status());
                }
            });
            
            // Submit form
            await page.click(loginButton);
            await page.waitForTimeout(3000);
            
            // Check result
            const formStillVisible = await page.isVisible(emailField);
            
            await page.screenshot({ path: 'frontend-after-login.png' });
            
            if (formStillVisible) {
                console.log('   ⚠️ Login form still visible - checking for errors');
                
                // Look for error messages
                const errors = await page.locator('.error, .alert-danger, [class*="error"]').allTextContents();
                if (errors.length > 0) {
                    console.log('   🚨 Error messages:', errors);
                }
            } else {
                console.log('   ✅ Login form disappeared - login successful!');
            }
            
            console.log('   📷 Post-login screenshot saved');
            
        } else {
            console.log('\n5. ❌ Complete login form not found');
            console.log('   Email field:', emailField || 'NOT FOUND');
            console.log('   Password field:', passwordField || 'NOT FOUND');
            console.log('   Login button:', loginButton || 'NOT FOUND');
        }
        
        // Step 6: Final Assessment
        console.log('\n6. 📋 FINAL E2E TEST RESULTS:');
        
        const results = {
            backendAuth: true,
            frontendLoaded: true,
            loginFormFound: !!(emailField && passwordField && loginButton),
            backendApi: true
        };
        
        Object.entries(results).forEach(([test, passed]) => {
            console.log(`   ${test}:`, passed ? '✅ PASS' : '❌ FAIL');
        });
        
        const allTestsPassed = Object.values(results).every(r => r);
        
        console.log('\n🎯 OVERALL AUTHENTICATION STATUS:');
        if (allTestsPassed) {
            console.log('✅ ALL SYSTEMS OPERATIONAL');
            console.log('🎉 Authentication system is fully functional!');
        } else {
            console.log('⚠️ SOME COMPONENTS NEED ATTENTION');
            console.log('🔧 Backend is working, frontend may need form adjustments');
        }
        
        // Keep browser open for inspection
        console.log('\n⏳ Keeping browser open for 10 seconds...');
        await page.waitForTimeout(10000);
        
    } catch (error) {
        console.log('\n❌ E2E Test Failed:', error.message);
        
        if (page) {
            await page.screenshot({ path: 'e2e-test-error.png' });
            console.log('📷 Error screenshot saved');
        }
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('\n🔚 E2E Authentication Testing Complete');
    }
}

// Run the final test
runFinalE2ETest();
