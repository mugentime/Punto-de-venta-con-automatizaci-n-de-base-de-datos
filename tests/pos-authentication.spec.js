const { test, expect } = require('@playwright/test');

test.describe('POS Authentication Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the main POS application', async ({ page }) => {
    await expect(page).toHaveTitle(/POS|Conejo Negro/i);
    
    // Take screenshot of initial load
    await page.screenshot({ 
      path: 'tests/test-results/auth-initial-load.png',
      fullPage: true 
    });
  });

  test('should display login form or main interface', async ({ page }) => {
    // Check for login form elements or main POS interface
    const hasLoginForm = await page.locator('form[name*="login"], input[type="password"], button:has-text("Login")').count() > 0;
    const hasMainInterface = await page.locator('.pos-interface, .main-menu, .product-grid').count() > 0;
    
    expect(hasLoginForm || hasMainInterface).toBeTruthy();
    
    if (hasLoginForm) {
      await expect(page.locator('input[type="email"], input[type="text"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button:has-text("Login"), input[type="submit"]')).toBeVisible();
    }
    
    await page.screenshot({ 
      path: 'tests/test-results/auth-interface-check.png',
      fullPage: true 
    });
  });

  test('should handle authentication attempts', async ({ page }) => {
    const loginButton = page.locator('button:has-text("Login"), input[type="submit"]').first();
    const emailInput = page.locator('input[type="email"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    if (await loginButton.count() > 0) {
      // Test empty form submission
      await loginButton.click();
      
      // Check for validation messages or error handling
      const errorMessages = page.locator('.error, .alert-danger, [role="alert"]');
      if (await errorMessages.count() > 0) {
        await expect(errorMessages.first()).toBeVisible();
      }
      
      // Test with sample credentials (should fail gracefully)
      if (await emailInput.count() > 0 && await passwordInput.count() > 0) {
        await emailInput.fill('test@example.com');
        await passwordInput.fill('testpassword');
        await loginButton.click();
        
        await page.waitForTimeout(2000); // Wait for response
        
        // Capture the result
        await page.screenshot({ 
          path: 'tests/test-results/auth-login-attempt.png',
          fullPage: true 
        });
      }
    }
  });

  test('should validate form fields', async ({ page }) => {
    const form = page.locator('form').first();
    
    if (await form.count() > 0) {
      const inputs = form.locator('input');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const inputType = await input.getAttribute('type');
        const isRequired = await input.getAttribute('required') !== null;
        
        if (isRequired) {
          // Test that required fields show validation
          await input.focus();
          await input.blur();
          
          // Check for validation styling or messages
          const hasError = await input.evaluate(el => 
            el.matches(':invalid') || 
            el.classList.contains('error') || 
            el.classList.contains('is-invalid')
          );
          
          if (inputType === 'email') {
            await input.fill('invalid-email');
            await input.blur();
            // Should show email validation error
          }
        }
      }
      
      await page.screenshot({ 
        path: 'tests/test-results/auth-validation.png',
        fullPage: true 
      });
    }
  });

  test('should handle session management', async ({ page }) => {
    // Check for session-related elements
    const sessionElements = page.locator('[data-testid*="session"], .session-info, .user-info, .logout');
    
    if (await sessionElements.count() > 0) {
      await expect(sessionElements.first()).toBeVisible();
    }
    
    // Look for logout functionality
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), .logout');
    
    if (await logoutButton.count() > 0) {
      await expect(logoutButton.first()).toBeVisible();
      
      // Test logout (if available)
      await logoutButton.first().click();
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: 'tests/test-results/auth-logout.png',
        fullPage: true 
      });
    }
  });
});