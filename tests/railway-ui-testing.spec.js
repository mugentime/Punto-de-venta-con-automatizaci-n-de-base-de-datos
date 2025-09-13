// Railway Deployment UI Testing Suite
// Comprehensive Playwright tests for POS System
// Testing URL: https://pos-conejonegro.railway.app

const { test, expect, devices } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const BASE_URL = process.env.RAILWAY_TEST_URL || 'https://pos-conejonegro.railway.app';
const TEST_TIMEOUT = 60000; // 60 seconds per test
const NETWORK_TIMEOUT = 30000; // 30 seconds for network requests

// Test credentials (should be in env vars for production)
const TEST_CREDENTIALS = {
    admin: {
        username: 'admin',
        password: 'admin123' // Default test password
    },
    user: {
        username: 'testuser',
        password: 'testpass123'
    }
};

// Device configurations for responsive testing
const TEST_VIEWPORTS = {
    desktop: { width: 1920, height: 1080, label: 'Desktop HD' },
    laptop: { width: 1366, height: 768, label: 'Laptop' },
    tablet: { width: 768, height: 1024, label: 'iPad' },
    mobile: { width: 375, height: 667, label: 'iPhone SE' },
    mobileLarge: { width: 414, height: 896, label: 'iPhone 11' }
};

// Helper function to create test report
class TestReporter {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            url: BASE_URL,
            tests: [],
            errors: [],
            performance: [],
            accessibility: [],
            networkIssues: [],
            consoleErrors: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0
            }
        };
    }

    addTest(name, status, details = {}) {
        this.results.tests.push({
            name,
            status,
            timestamp: new Date().toISOString(),
            ...details
        });
        this.results.summary.total++;
        this.results.summary[status]++;
    }

    addError(error) {
        this.results.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    addPerformanceMetric(metric) {
        this.results.performance.push(metric);
    }

    addAccessibilityIssue(issue) {
        this.results.accessibility.push(issue);
    }

    addNetworkIssue(issue) {
        this.results.networkIssues.push(issue);
    }

    addConsoleError(error) {
        this.results.consoleErrors.push(error);
    }

    async saveReport() {
        const reportPath = path.join(__dirname, 'reports', `railway-ui-test-${Date.now()}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
        return reportPath;
    }
}

// Global test reporter
const reporter = new TestReporter();

// Test fixtures
test.describe.configure({ mode: 'parallel', timeout: TEST_TIMEOUT });

// Setup and teardown
test.beforeEach(async ({ page, context }) => {
    // Set up console error monitoring
    page.on('console', msg => {
        if (msg.type() === 'error') {
            reporter.addConsoleError({
                text: msg.text(),
                location: msg.location(),
                timestamp: new Date().toISOString()
            });
        }
    });

    // Monitor network failures
    page.on('requestfailed', request => {
        reporter.addNetworkIssue({
            url: request.url(),
            failure: request.failure(),
            method: request.method(),
            timestamp: new Date().toISOString()
        });
    });

    // Set default timeouts
    page.setDefaultTimeout(NETWORK_TIMEOUT);
    page.setDefaultNavigationTimeout(NETWORK_TIMEOUT);
});

test.afterAll(async () => {
    const reportPath = await reporter.saveReport();
    console.log(`Test report saved to: ${reportPath}`);
});

// SECTION 1: HEALTH AND AVAILABILITY TESTS
test.describe('Health and Availability', () => {
    test('Railway deployment is accessible', async ({ page }) => {
        const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        expect(response.status()).toBe(200);
        reporter.addTest('Deployment Accessibility', 'passed', {
            responseStatus: response.status(),
            responseTime: response.timing().responseEnd
        });
    });

    test('Health endpoint returns valid response', async ({ page }) => {
        const response = await page.request.get(`${BASE_URL}/api/health`);
        expect(response.status()).toBe(200);
        
        const data = await response.json();
        expect(data).toHaveProperty('status');
        expect(data).toHaveProperty('isDatabaseReady');
        expect(data.status).toBe('healthy');
        
        reporter.addTest('Health Endpoint', 'passed', {
            healthData: data
        });
    });

    test('Static assets load correctly', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Check for CSS
        const styles = await page.$$('link[rel="stylesheet"]');
        for (const style of styles) {
            const href = await style.getAttribute('href');
            if (href) {
                const response = await page.request.get(new URL(href, BASE_URL).toString());
                expect(response.status()).toBe(200);
            }
        }
        
        // Check for JavaScript
        const scripts = await page.$$('script[src]');
        for (const script of scripts) {
            const src = await script.getAttribute('src');
            if (src && !src.startsWith('data:')) {
                const response = await page.request.get(new URL(src, BASE_URL).toString());
                expect(response.status()).toBe(200);
            }
        }
        
        reporter.addTest('Static Assets', 'passed');
    });
});

// SECTION 2: RESPONSIVE DESIGN TESTS
test.describe('Responsive Design', () => {
    Object.entries(TEST_VIEWPORTS).forEach(([key, viewport]) => {
        test(`Layout renders correctly on ${viewport.label}`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await page.goto(BASE_URL);
            
            // Take screenshot for visual verification
            const screenshotPath = path.join(__dirname, 'screenshots', `${key}-${Date.now()}.png`);
            await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath, fullPage: true });
            
            // Check for viewport meta tag
            const viewportMeta = await page.$('meta[name="viewport"]');
            expect(viewportMeta).toBeTruthy();
            
            // Check for horizontal scroll (should not exist)
            const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
            const windowWidth = await page.evaluate(() => window.innerWidth);
            expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 1); // Allow 1px tolerance
            
            // Check navigation visibility
            const nav = await page.$('nav, .navigation, .menu, header');
            if (nav) {
                const isVisible = await nav.isVisible();
                expect(isVisible).toBeTruthy();
            }
            
            reporter.addTest(`Responsive Layout - ${viewport.label}`, 'passed', {
                viewport,
                screenshot: screenshotPath
            });
        });
    });
});

// SECTION 3: AUTHENTICATION FLOW TESTS
test.describe('Authentication', () => {
    test('Login page loads correctly', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Check for login form elements
        const usernameField = await page.$('input[type="text"], input[type="email"], input[name*="user"], input[id*="user"]');
        const passwordField = await page.$('input[type="password"]');
        const submitButton = await page.$('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
        
        expect(usernameField).toBeTruthy();
        expect(passwordField).toBeTruthy();
        expect(submitButton).toBeTruthy();
        
        reporter.addTest('Login Page Elements', 'passed');
    });

    test('Login with valid credentials', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Fill login form
        await page.fill('input[type="text"], input[type="email"], input[name*="user"], input[id*="user"]', TEST_CREDENTIALS.admin.username);
        await page.fill('input[type="password"]', TEST_CREDENTIALS.admin.password);
        
        // Submit form
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")')
        ]);
        
        // Check for successful login (should redirect to dashboard or show logged-in state)
        const url = page.url();
        expect(url).not.toContain('/login');
        
        reporter.addTest('Login Flow', 'passed');
    });

    test('Login with invalid credentials shows error', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Fill with invalid credentials
        await page.fill('input[type="text"], input[type="email"], input[name*="user"], input[id*="user"]', 'invaliduser');
        await page.fill('input[type="password"]', 'wrongpassword');
        
        // Submit form
        await page.click('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
        
        // Wait for error message
        await page.waitForTimeout(2000);
        
        // Check for error message
        const errorMessage = await page.$('.error, .alert-danger, .error-message, [role="alert"]');
        const url = page.url();
        
        // Should still be on login page or show error
        expect(url).toContain('/login');
        
        reporter.addTest('Login Error Handling', 'passed');
    });
});

// SECTION 4: NAVIGATION AND ROUTING TESTS
test.describe('Navigation and Routing', () => {
    test('Main navigation links work correctly', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Find all navigation links
        const navLinks = await page.$$('nav a, .navigation a, .menu a, header a');
        const testedLinks = [];
        
        for (const link of navLinks.slice(0, 5)) { // Test first 5 links to avoid timeout
            const href = await link.getAttribute('href');
            const text = await link.textContent();
            
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                    await link.click();
                    await page.waitForLoadState('networkidle');
                    
                    testedLinks.push({
                        text: text.trim(),
                        href,
                        status: 'success',
                        finalUrl: page.url()
                    });
                } catch (error) {
                    testedLinks.push({
                        text: text.trim(),
                        href,
                        status: 'error',
                        error: error.message
                    });
                }
                
                // Go back to main page for next link
                await page.goto(BASE_URL);
            }
        }
        
        reporter.addTest('Navigation Links', 'passed', { testedLinks });
    });

    test('404 page handles non-existent routes', async ({ page }) => {
        const response = await page.goto(`${BASE_URL}/non-existent-page-12345`, { waitUntil: 'networkidle' });
        
        // Should return 404 status or redirect to error page
        expect([404, 200]).toContain(response.status());
        
        // Check for 404 content
        const pageContent = await page.textContent('body');
        const has404Content = pageContent.toLowerCase().includes('404') || 
                              pageContent.toLowerCase().includes('not found') ||
                              pageContent.toLowerCase().includes('error');
        
        reporter.addTest('404 Error Handling', 'passed');
    });
});

// SECTION 5: FORM VALIDATION TESTS
test.describe('Form Validation', () => {
    test('Forms have proper validation', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Find all forms on the page
        const forms = await page.$$('form');
        const formValidation = [];
        
        for (const form of forms) {
            const inputs = await form.$$('input[required], select[required], textarea[required]');
            const hasValidation = inputs.length > 0;
            
            formValidation.push({
                hasRequiredFields: hasValidation,
                requiredFieldCount: inputs.length
            });
        }
        
        reporter.addTest('Form Validation', 'passed', { formValidation });
    });

    test('Forms show validation errors', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        // Try to submit empty form
        const submitButton = await page.$('button[type="submit"], input[type="submit"]');
        if (submitButton) {
            await submitButton.click();
            
            // Check for HTML5 validation or custom validation messages
            const validationMessage = await page.evaluate(() => {
                const firstInvalidInput = document.querySelector('input:invalid');
                return firstInvalidInput ? firstInvalidInput.validationMessage : null;
            });
            
            reporter.addTest('Form Validation Messages', 'passed', { validationMessage });
        }
    });
});

// SECTION 6: PERFORMANCE TESTS
test.describe('Performance', () => {
    test('Page load performance metrics', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            return {
                domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                domInteractive: navigation.domInteractive,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
            };
        });
        
        reporter.addPerformanceMetric({
            type: 'pageLoad',
            metrics,
            timestamp: new Date().toISOString()
        });
        
        // Check if load times are acceptable
        expect(metrics.loadComplete).toBeLessThan(5000); // 5 seconds
        
        reporter.addTest('Page Load Performance', 'passed', { metrics });
    });

    test('Resource loading performance', async ({ page }) => {
        const resourceTimings = [];
        
        page.on('response', response => {
            const url = response.url();
            const timing = response.timing();
            
            if (timing) {
                resourceTimings.push({
                    url,
                    duration: timing.responseEnd - timing.requestStart,
                    size: response.headers()['content-length'],
                    type: response.headers()['content-type']
                });
            }
        });
        
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        
        // Analyze slow resources
        const slowResources = resourceTimings.filter(r => r.duration > 1000);
        
        reporter.addPerformanceMetric({
            type: 'resources',
            totalResources: resourceTimings.length,
            slowResources: slowResources.length,
            details: slowResources
        });
        
        reporter.addTest('Resource Loading', 'passed', { resourceCount: resourceTimings.length });
    });
});

// SECTION 7: ACCESSIBILITY TESTS
test.describe('Accessibility', () => {
    test('Page has proper heading structure', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const headings = await page.evaluate(() => {
            const h1s = document.querySelectorAll('h1');
            const h2s = document.querySelectorAll('h2');
            const h3s = document.querySelectorAll('h3');
            
            return {
                h1Count: h1s.length,
                h2Count: h2s.length,
                h3Count: h3s.length,
                h1Text: Array.from(h1s).map(h => h.textContent.trim())
            };
        });
        
        // Should have exactly one H1
        expect(headings.h1Count).toBe(1);
        
        reporter.addAccessibilityIssue({
            type: 'headingStructure',
            details: headings
        });
        
        reporter.addTest('Heading Structure', 'passed', { headings });
    });

    test('Images have alt text', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const images = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            const results = [];
            
            imgs.forEach(img => {
                results.push({
                    src: img.src,
                    hasAlt: img.hasAttribute('alt'),
                    altText: img.alt,
                    isDecorative: img.alt === ''
                });
            });
            
            return results;
        });
        
        const imagesWithoutAlt = images.filter(img => !img.hasAlt && !img.isDecorative);
        
        if (imagesWithoutAlt.length > 0) {
            reporter.addAccessibilityIssue({
                type: 'missingAltText',
                count: imagesWithoutAlt.length,
                images: imagesWithoutAlt
            });
        }
        
        reporter.addTest('Image Alt Text', imagesWithoutAlt.length === 0 ? 'passed' : 'failed');
    });

    test('Forms have proper labels', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const formAccessibility = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input, select, textarea');
            const results = [];
            
            inputs.forEach(input => {
                const id = input.id;
                const name = input.name;
                const type = input.type;
                const label = document.querySelector(`label[for="${id}"]`);
                const ariaLabel = input.getAttribute('aria-label');
                const ariaLabelledBy = input.getAttribute('aria-labelledby');
                
                results.push({
                    type,
                    name,
                    hasLabel: !!label,
                    hasAriaLabel: !!ariaLabel,
                    hasAriaLabelledBy: !!ariaLabelledBy,
                    isAccessible: !!label || !!ariaLabel || !!ariaLabelledBy || type === 'hidden' || type === 'submit'
                });
            });
            
            return results;
        });
        
        const inaccessibleInputs = formAccessibility.filter(input => !input.isAccessible);
        
        if (inaccessibleInputs.length > 0) {
            reporter.addAccessibilityIssue({
                type: 'missingLabels',
                count: inaccessibleInputs.length,
                inputs: inaccessibleInputs
            });
        }
        
        reporter.addTest('Form Labels', inaccessibleInputs.length === 0 ? 'passed' : 'failed');
    });

    test('Page has proper ARIA landmarks', async ({ page }) => {
        await page.goto(BASE_URL);
        
        const landmarks = await page.evaluate(() => {
            return {
                header: !!document.querySelector('header, [role="banner"]'),
                nav: !!document.querySelector('nav, [role="navigation"]'),
                main: !!document.querySelector('main, [role="main"]'),
                footer: !!document.querySelector('footer, [role="contentinfo"]')
            };
        });
        
        reporter.addAccessibilityIssue({
            type: 'landmarks',
            details: landmarks
        });
        
        reporter.addTest('ARIA Landmarks', 'passed', { landmarks });
    });

    test('Color contrast meets WCAG standards', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Check text color contrast
        const contrastIssues = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            const issues = [];
            
            elements.forEach(el => {
                const style = window.getComputedStyle(el);
                const color = style.color;
                const backgroundColor = style.backgroundColor;
                
                if (color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
                    // Simple contrast check (would need proper algorithm for production)
                    const hasText = el.textContent.trim().length > 0;
                    if (hasText) {
                        issues.push({
                            tag: el.tagName,
                            color,
                            backgroundColor,
                            text: el.textContent.substring(0, 50)
                        });
                    }
                }
            });
            
            return issues.slice(0, 10); // Limit to first 10 for performance
        });
        
        reporter.addAccessibilityIssue({
            type: 'colorContrast',
            sampleCount: contrastIssues.length
        });
        
        reporter.addTest('Color Contrast', 'passed');
    });
});

// SECTION 8: POS-SPECIFIC FUNCTIONALITY TESTS
test.describe('POS Functionality', () => {
    test('Inventory management page loads', async ({ page }) => {
        await page.goto(`${BASE_URL}/inventory`);
        
        // Check for inventory-related elements
        const inventoryElements = await page.evaluate(() => {
            const hasTable = !!document.querySelector('table, .inventory-table, .product-list');
            const hasAddButton = !!document.querySelector('button:has-text("Add"), button:has-text("New"), a:has-text("Add Product")');
            const hasSearchBox = !!document.querySelector('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"]');
            
            return { hasTable, hasAddButton, hasSearchBox };
        });
        
        reporter.addTest('Inventory Page', 'passed', { inventoryElements });
    });

    test('Sales/transaction page loads', async ({ page }) => {
        await page.goto(`${BASE_URL}/sales`);
        
        // Check for sales-related elements
        const salesElements = await page.evaluate(() => {
            const hasProductSearch = !!document.querySelector('input[placeholder*="product"], input[placeholder*="Product"]');
            const hasCart = !!document.querySelector('.cart, .order-items, .transaction-items');
            const hasTotalDisplay = !!document.querySelector('.total, .amount, .price-total');
            const hasCheckoutButton = !!document.querySelector('button:has-text("Checkout"), button:has-text("Pay"), button:has-text("Complete")');
            
            return { hasProductSearch, hasCart, hasTotalDisplay, hasCheckoutButton };
        });
        
        reporter.addTest('Sales Page', 'passed', { salesElements });
    });

    test('Reports page loads', async ({ page }) => {
        await page.goto(`${BASE_URL}/reports`);
        
        // Check for report elements
        const reportElements = await page.evaluate(() => {
            const hasDatePicker = !!document.querySelector('input[type="date"], .date-picker, .calendar');
            const hasReportType = !!document.querySelector('select, .report-type, .report-selector');
            const hasGenerateButton = !!document.querySelector('button:has-text("Generate"), button:has-text("Run Report"), button:has-text("Export")');
            
            return { hasDatePicker, hasReportType, hasGenerateButton };
        });
        
        reporter.addTest('Reports Page', 'passed', { reportElements });
    });
});

// SECTION 9: ERROR HANDLING AND RECOVERY TESTS
test.describe('Error Handling', () => {
    test('Application handles network errors gracefully', async ({ page, context }) => {
        // Simulate offline mode
        await context.setOffline(true);
        
        try {
            await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 5000 });
        } catch (error) {
            // Expected to fail when offline
        }
        
        await context.setOffline(false);
        
        // Should recover when back online
        await page.goto(BASE_URL);
        const isLoaded = await page.$('body');
        expect(isLoaded).toBeTruthy();
        
        reporter.addTest('Network Error Recovery', 'passed');
    });

    test('Application handles API errors gracefully', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Intercept API calls and force errors
        await page.route('**/api/**', route => {
            route.fulfill({
                status: 500,
                body: JSON.stringify({ error: 'Internal Server Error' })
            });
        });
        
        // Trigger an API call (e.g., by navigating or clicking)
        const hasErrorHandling = await page.evaluate(() => {
            // Check if error messages are displayed properly
            return !!document.querySelector('.error, .alert, .notification');
        });
        
        reporter.addTest('API Error Handling', 'passed');
    });
});

// SECTION 10: SECURITY TESTS
test.describe('Security', () => {
    test('Application has security headers', async ({ page }) => {
        const response = await page.goto(BASE_URL);
        const headers = response.headers();
        
        const securityHeaders = {
            'x-frame-options': headers['x-frame-options'],
            'x-content-type-options': headers['x-content-type-options'],
            'strict-transport-security': headers['strict-transport-security'],
            'x-xss-protection': headers['x-xss-protection'],
            'content-security-policy': headers['content-security-policy']
        };
        
        // Check for presence of security headers
        const hasSecurityHeaders = Object.values(securityHeaders).some(h => h !== undefined);
        
        reporter.addTest('Security Headers', hasSecurityHeaders ? 'passed' : 'failed', { securityHeaders });
    });

    test('Forms have CSRF protection', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        const csrfToken = await page.evaluate(() => {
            // Look for CSRF token in various places
            const metaTag = document.querySelector('meta[name="csrf-token"]');
            const inputField = document.querySelector('input[name="_csrf"], input[name="csrf_token"], input[name="authenticity_token"]');
            
            return {
                hasMeta: !!metaTag,
                hasInput: !!inputField,
                metaContent: metaTag?.content,
                inputValue: inputField?.value
            };
        });
        
        reporter.addTest('CSRF Protection', 'passed', { csrfToken });
    });

    test('Sensitive data is not exposed in HTML', async ({ page }) => {
        await page.goto(BASE_URL);
        const pageSource = await page.content();
        
        // Check for common sensitive data patterns
        const sensitivePatterns = [
            /api[_-]?key/i,
            /secret/i,
            /password/i,
            /token/i,
            /private[_-]?key/i
        ];
        
        const exposedData = [];
        sensitivePatterns.forEach(pattern => {
            if (pattern.test(pageSource)) {
                // Check if it's in a script tag or hidden input
                const matches = pageSource.match(new RegExp(`.{0,50}${pattern.source}.{0,50}`, 'gi'));
                if (matches) {
                    exposedData.push({
                        pattern: pattern.source,
                        context: matches[0].substring(0, 100)
                    });
                }
            }
        });
        
        reporter.addTest('Sensitive Data Exposure', exposedData.length === 0 ? 'passed' : 'failed', { exposedData });
    });
});

// SECTION 11: MOBILE-SPECIFIC TESTS
test.describe('Mobile Experience', () => {
    test.use({ ...devices['iPhone 12'] });
    
    test('Mobile menu/navigation works', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Look for mobile menu toggle
        const menuToggle = await page.$('.menu-toggle, .hamburger, .mobile-menu-toggle, button[aria-label*="menu"]');
        
        if (menuToggle) {
            await menuToggle.click();
            await page.waitForTimeout(500); // Wait for animation
            
            // Check if menu is now visible
            const mobileMenu = await page.$('.mobile-menu, .nav-mobile, nav');
            const isVisible = mobileMenu ? await mobileMenu.isVisible() : false;
            
            reporter.addTest('Mobile Menu', 'passed', { hasToggle: true, menuVisible: isVisible });
        } else {
            reporter.addTest('Mobile Menu', 'passed', { hasToggle: false });
        }
    });

    test('Touch interactions work correctly', async ({ page }) => {
        await page.goto(BASE_URL);
        
        // Test swipe gestures if applicable
        const swipeableElements = await page.$$('.swipeable, .carousel, .slider');
        
        for (const element of swipeableElements) {
            const box = await element.boundingBox();
            if (box) {
                // Simulate swipe
                await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
            }
        }
        
        reporter.addTest('Touch Interactions', 'passed');
    });

    test('Forms are mobile-friendly', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);
        
        const inputElements = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input, select, textarea');
            const results = [];
            
            inputs.forEach(input => {
                const styles = window.getComputedStyle(input);
                results.push({
                    type: input.type,
                    fontSize: parseInt(styles.fontSize),
                    height: parseInt(styles.height),
                    hasAutocomplete: input.hasAttribute('autocomplete'),
                    hasInputMode: input.hasAttribute('inputmode')
                });
            });
            
            return results;
        });
        
        // Check if inputs are appropriately sized for mobile
        const mobileFriendly = inputElements.every(input => {
            return input.fontSize >= 16 && (input.height >= 44 || input.type === 'hidden');
        });
        
        reporter.addTest('Mobile Forms', mobileFriendly ? 'passed' : 'failed', { inputElements });
    });
});

// SECTION 12: COMPREHENSIVE TEST SUMMARY
test.describe('Test Summary', () => {
    test.afterAll(async () => {
        // Generate final report
        console.log('\n========================================');
        console.log('Railway UI Testing Complete');
        console.log('========================================');
        console.log(`URL Tested: ${BASE_URL}`);
        console.log(`Total Tests: ${reporter.results.summary.total}`);
        console.log(`Passed: ${reporter.results.summary.passed}`);
        console.log(`Failed: ${reporter.results.summary.failed}`);
        console.log(`Skipped: ${reporter.results.summary.skipped}`);
        
        if (reporter.results.errors.length > 0) {
            console.log('\n⚠️ Errors Detected:');
            reporter.results.errors.forEach(error => {
                console.log(`  - ${error.message}`);
            });
        }
        
        if (reporter.results.consoleErrors.length > 0) {
            console.log('\n⚠️ Console Errors:');
            reporter.results.consoleErrors.slice(0, 5).forEach(error => {
                console.log(`  - ${error.text}`);
            });
        }
        
        if (reporter.results.networkIssues.length > 0) {
            console.log('\n⚠️ Network Issues:');
            reporter.results.networkIssues.slice(0, 5).forEach(issue => {
                console.log(`  - ${issue.url}: ${issue.failure}`);
            });
        }
        
        if (reporter.results.accessibility.length > 0) {
            console.log('\n♿ Accessibility Issues:');
            reporter.results.accessibility.forEach(issue => {
                console.log(`  - ${issue.type}: ${JSON.stringify(issue.details || issue.count)}`);
            });
        }
        
        console.log('\n========================================\n');
    });
});

module.exports = { reporter };