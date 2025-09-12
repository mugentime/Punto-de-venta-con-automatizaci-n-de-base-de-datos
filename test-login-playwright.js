const { chromium } = require('playwright');

async function testLogin() {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 1000 // Slow down for debugging
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Listen to console messages
    page.on('console', msg => {
        console.log('🔍 BROWSER CONSOLE:', msg.type(), msg.text());
    });
    
    // Listen to network requests
    page.on('request', request => {
        if (request.url().includes('/api/auth/login')) {
            console.log('📡 LOGIN REQUEST:', request.url());
            console.log('📡 METHOD:', request.method());
            console.log('📡 HEADERS:', request.headers());
        }
    });
    
    page.on('response', response => {
        if (response.url().includes('/api/auth/login')) {
            console.log('📡 LOGIN RESPONSE:', response.status(), response.statusText());
        }
    });
    
    // Listen to page errors
    page.on('pageerror', error => {
        console.log('❌ PAGE ERROR:', error.message);
    });
    
    try {
        console.log('🚀 Navegating to production site...');
        await page.goto('https://pos-conejo-negro.onrender.com/');
        
        console.log('⏳ Waiting for page load...');
        await page.waitForLoadState('networkidle');
        
        console.log('🔍 Checking page title...');
        const title = await page.title();
        console.log('📄 Page title:', title);
        
        // Check if login form exists
        console.log('🔍 Looking for login form...');
        const emailInput = page.locator('#email');
        const passwordInput = page.locator('#password');
        const loginButton = page.locator('.login-btn');
        
        // Verify form elements exist
        console.log('✅ Email input exists:', await emailInput.count() > 0);
        console.log('✅ Password input exists:', await passwordInput.count() > 0);
        console.log('✅ Login button exists:', await loginButton.count() > 0);
        
        // Fill in credentials
        console.log('📝 Filling credentials...');
        await emailInput.fill('admin@conejonegro.com');
        await passwordInput.fill('admin123');
        
        // Click login button and wait for network activity
        console.log('🔘 Clicking login button...');
        await Promise.all([
            page.waitForResponse(response => response.url().includes('/api/auth/login'), { timeout: 10000 }),
            loginButton.click()
        ]);
        
        // Wait for potential redirect
        console.log('⏳ Waiting for redirect...');
        await page.waitForTimeout(3000);
        
        // Check current URL
        const currentUrl = page.url();
        console.log('🔍 Current URL after login:', currentUrl);
        
        if (currentUrl.includes('/online')) {
            console.log('✅ LOGIN SUCCESSFUL! Redirected to dashboard');
            
            // Check dashboard elements
            console.log('🔍 Checking dashboard elements...');
            const dashboardTitle = await page.textContent('h1, .title, .section-title').catch(() => 'Not found');
            console.log('📄 Dashboard title:', dashboardTitle);
            
            // Check for Magic UI dock
            const magicDock = page.locator('.magic-dock');
            const dockExists = await magicDock.count() > 0;
            console.log('🎨 Magic UI dock exists:', dockExists);
            
            if (dockExists) {
                const dockItems = await magicDock.locator('.dock-item').count();
                console.log('🎨 Magic UI dock items:', dockItems);
            }
            
        } else {
            console.log('❌ LOGIN FAILED! Still on login page');
            
            // Check for error messages
            const errorElements = await page.locator('.error, .alert, [class*="error"]').count();
            console.log('⚠️ Error elements found:', errorElements);
            
            if (errorElements > 0) {
                const errorText = await page.textContent('.error, .alert, [class*="error"]').catch(() => '');
                console.log('⚠️ Error message:', errorText);
            }
            
            // Check browser storage
            const authToken = await page.evaluate(() => localStorage.getItem('authToken'));
            console.log('🔑 Auth token in localStorage:', authToken ? 'EXISTS' : 'NOT FOUND');
        }
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    } finally {
        console.log('🏁 Closing browser...');
        await browser.close();
    }
}

testLogin().catch(console.error);
