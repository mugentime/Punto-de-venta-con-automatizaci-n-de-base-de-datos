const { chromium } = require('playwright');

async function debugFrontend() {
    const browser = await chromium.launch({ 
        headless: false,
        slowMo: 500 
    });
    
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    // Listen to ALL network requests
    page.on('request', request => {
        console.log('🌐 REQUEST:', request.method(), request.url());
    });
    
    page.on('response', response => {
        if (!response.url().includes('favicon') && !response.url().includes('chrome-extension')) {
            console.log('📡 RESPONSE:', response.status(), response.url());
        }
    });
    
    // Listen to console messages
    page.on('console', msg => {
        console.log('🔍 CONSOLE:', msg.type(), msg.text());
    });
    
    // Listen to page errors
    page.on('pageerror', error => {
        console.log('❌ PAGE ERROR:', error.message);
    });
    
    try {
        console.log('🚀 Starting complete frontend debug...');
        
        // Step 1: Login
        console.log('1. Going to production site...');
        await page.goto('https://pos-conejo-negro.onrender.com/');
        await page.waitForLoadState('networkidle');
        
        console.log('2. Filling login credentials...');
        await page.fill('#email', 'admin@conejonegro.com');
        await page.fill('#password', 'admin123');
        
        console.log('3. Clicking login...');
        await Promise.all([
            page.waitForResponse(response => response.url().includes('/api/auth/login')),
            page.click('.login-btn')
        ]);
        
        // Wait for redirect to dashboard
        await page.waitForURL('**/online');
        console.log('✅ Successfully logged in and redirected to dashboard');
        
        // Step 2: Analyze dashboard elements
        console.log('\n🔍 ANALYZING DASHBOARD ELEMENTS...');
        
        // Check if Magic UI dock exists
        const dockExists = await page.locator('.magic-dock').count();
        console.log('🎨 Magic dock elements found:', dockExists);
        
        if (dockExists > 0) {
            // Get all dock items
            const dockItems = await page.locator('.dock-item').all();
            console.log('📱 Total dock items:', dockItems.length);
            
            for (let i = 0; i < dockItems.length; i++) {
                const item = dockItems[i];
                const dataSection = await item.getAttribute('data-section');
                const tooltip = await item.locator('.tooltip').textContent();
                console.log(`   Item ${i + 1}: ${dataSection} - "${tooltip}"`);
            }
        }
        
        // Step 3: Test navigation by clicking each dock item
        console.log('\n🧪 TESTING NAVIGATION CLICKS...');
        
        const navigationSections = ['registro', 'coworking', 'inventario', 'reportes', 'corte-caja', 'gastos'];
        
        for (const section of navigationSections) {
            console.log(`\n🎯 Testing navigation to: ${section}`);
            
            const dockItem = page.locator(`[data-section="${section}"]`);
            const itemExists = await dockItem.count();
            
            if (itemExists > 0) {
                console.log(`   ✅ Dock item found for ${section}`);
                
                // Click the dock item
                await dockItem.click();
                await page.waitForTimeout(1000);
                
                // Check what happened
                const currentUrl = page.url();
                console.log(`   📍 URL after click: ${currentUrl}`);
                
                // Check if content changed
                const activeContent = await page.locator('.section-content.active').count();
                if (activeContent > 0) {
                    const activeTitle = await page.locator('.section-content.active .section-title').textContent();
                    console.log(`   📄 Active section title: "${activeTitle}"`);
                } else {
                    console.log('   ⚠️ No active section content found');
                }
            } else {
                console.log(`   ❌ Dock item not found for ${section}`);
            }
        }
        
        // Step 4: Test service cards navigation
        console.log('\n🔗 TESTING SERVICE CARDS NAVIGATION...');
        
        // Go back to registro section
        await page.locator('[data-section="registro"]').click();
        await page.waitForTimeout(1000);
        
        const serviceCards = await page.locator('.service-card').all();
        console.log('🎴 Service cards found:', serviceCards.length);
        
        if (serviceCards.length > 0) {
            console.log('\n🧪 Testing first service card click...');
            const firstCard = serviceCards[0];
            const cardText = await firstCard.locator('.service-title').textContent();
            console.log(`   Card to click: "${cardText}"`);
            
            // Listen for navigation
            const navigationPromise = page.waitForEvent('framenavigated').catch(() => null);
            
            await firstCard.click();
            
            // Wait for potential navigation
            await Promise.race([
                navigationPromise,
                page.waitForTimeout(3000)
            ]);
            
            const newUrl = page.url();
            console.log(`   📍 URL after card click: ${newUrl}`);
            
            if (newUrl !== 'https://pos-conejo-negro.onrender.com/online') {
                console.log('   ✅ Navigation occurred!');
                
                // Check if new page loaded correctly
                const pageTitle = await page.title();
                console.log(`   📄 New page title: "${pageTitle}"`);
                
                // Check for errors
                const errorElements = await page.locator('h1:has-text("404"), h1:has-text("Error"), .error').count();
                if (errorElements > 0) {
                    console.log('   ❌ Error page detected');
                } else {
                    console.log('   ✅ Page loaded successfully');
                }
            } else {
                console.log('   ⚠️ No navigation occurred');
            }
        }
        
        // Step 5: Check JavaScript errors and console
        console.log('\n🔧 CHECKING JAVASCRIPT STATE...');
        
        const jsErrors = await page.evaluate(() => {
            const errors = [];
            
            // Check if navigation function exists
            if (typeof navigateToService === 'function') {
                errors.push('✅ navigateToService function exists');
            } else {
                errors.push('❌ navigateToService function not found');
            }
            
            // Check if MagicNavigation class is initialized
            if (window.magicNavigation) {
                errors.push('✅ MagicNavigation instance exists');
            } else {
                errors.push('❌ MagicNavigation instance not found');
            }
            
            // Check for any JS errors
            if (window.jsErrors) {
                errors.push(`❌ JS Errors detected: ${window.jsErrors.length}`);
            } else {
                errors.push('✅ No stored JS errors');
            }
            
            return errors;
        });
        
        jsErrors.forEach(error => console.log(`   ${error}`));
        
        // Step 6: Manual URL testing
        console.log('\n🌐 TESTING DIRECT URL NAVIGATION...');
        
        const testUrls = [
            'https://pos-conejo-negro.onrender.com/clientes',
            'https://pos-conejo-negro.onrender.com/gastos',
            'https://pos-conejo-negro.onrender.com/inventario',
            'https://pos-conejo-negro.onrender.com/reportes',
            'https://pos-conejo-negro.onrender.com/corte-manual'
        ];
        
        for (const url of testUrls) {
            console.log(`\n🔗 Testing direct navigation to: ${url}`);
            
            try {
                await page.goto(url);
                await page.waitForLoadState('networkidle', { timeout: 5000 });
                
                const title = await page.title();
                const isError = title.includes('404') || title.includes('Error');
                
                if (isError) {
                    console.log(`   ❌ ${url} - Error page: "${title}"`);
                } else {
                    console.log(`   ✅ ${url} - Loaded: "${title}"`);
                }
            } catch (error) {
                console.log(`   ❌ ${url} - Failed to load: ${error.message}`);
            }
        }
        
        console.log('\n🎯 FRONTEND DEBUG COMPLETE!');
        
    } catch (error) {
        console.log('❌ Debug failed:', error.message);
    } finally {
        console.log('\n⏱️ Waiting 10 seconds for review before closing...');
        await page.waitForTimeout(10000);
        await browser.close();
    }
}

debugFrontend().catch(console.error);
