import { test, expect } from '@playwright/test';
import pg from 'pg';

const { Pool } = pg;

/**
 * Registration Bug Reproduction Test
 *
 * BUG: User registration function (AppContext.tsx lines 205-222) only updates
 * local React state with setUsers() but never calls POST /api/users endpoint.
 * New users are created in memory only and lost on refresh.
 *
 * Expected Behavior:
 * 1. User fills registration form
 * 2. Form submits to POST /api/users
 * 3. User is persisted to database
 * 4. User appears in admin panel with "pending" status
 * 5. Admin receives notification
 *
 * Current Behavior (BUG):
 * 1. User fills registration form
 * 2. User is added to local state only
 * 3. No API call to POST /api/users
 * 4. User disappears on refresh
 * 5. Admin never sees the user
 */

test.describe('User Registration Bug', () => {
  let pool: pg.Pool;

  test.beforeAll(async () => {
    // Setup database connection for verification
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      pool = new Pool({ connectionString: databaseUrl });
    }
  });

  test.afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  test('should persist user to database after registration', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/');

    // Click on register link
    await page.click('text=Registrarse');

    // Wait for registration form to load
    await page.waitForSelector('form');

    // Generate unique test user data
    const timestamp = Date.now();
    const testUser = {
      username: `testuser_${timestamp}`,
      email: `test_${timestamp}@example.com`,
      password: 'TestPassword123!',
    };

    // Fill registration form
    await page.fill('input[name="username"], input[placeholder*="Usuario"], input[placeholder*="usuario"]', testUser.username);
    await page.fill('input[name="email"], input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]', testUser.email);
    await page.fill('input[name="password"], input[type="password"]:first-of-type, input[placeholder*="Contraseña"]:first-of-type', testUser.password);

    // Find and fill confirm password field if it exists
    const confirmPasswordFields = await page.locator('input[type="password"]').count();
    if (confirmPasswordFields > 1) {
      await page.fill('input[type="password"]:last-of-type', testUser.password);
    }

    // Setup network request listener to verify API call
    let apiCallMade = false;
    page.on('request', request => {
      if (request.url().includes('/api/users') && request.method() === 'POST') {
        apiCallMade = true;
      }
    });

    // Submit registration form
    await page.click('button[type="submit"]');

    // Wait for potential success message or redirect
    await page.waitForTimeout(2000);

    // TEST 1: Verify API call was made (EXPECTED TO FAIL - this is the bug)
    expect(apiCallMade, 'POST /api/users should be called during registration').toBe(true);

    // TEST 2: Verify user exists in database (EXPECTED TO FAIL)
    if (pool) {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [testUser.email]
      );

      expect(result.rows.length, 'User should be persisted to database').toBeGreaterThan(0);

      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        expect(dbUser.username).toBe(testUser.username);
        expect(dbUser.email).toBe(testUser.email);
        expect(dbUser.status).toBe('pending');
        expect(dbUser.role).toBe('user');
      }
    }

    // Cleanup: Delete test user if it was created
    if (pool) {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    }
  });

  test('should show user in admin panel after registration', async ({ page, context }) => {
    // Test user data
    const timestamp = Date.now();
    const testUser = {
      username: `admintest_${timestamp}`,
      email: `admintest_${timestamp}@example.com`,
      password: 'TestPassword123!',
    };

    // STEP 1: Register a new user
    await page.goto('/');
    await page.click('text=Registrarse');
    await page.waitForSelector('form');

    await page.fill('input[name="username"], input[placeholder*="Usuario"]', testUser.username);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[type="password"]:first-of-type', testUser.password);

    const confirmPasswordFields = await page.locator('input[type="password"]').count();
    if (confirmPasswordFields > 1) {
      await page.fill('input[type="password"]:last-of-type', testUser.password);
    }

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // STEP 2: Login as admin in new tab/page
    const adminPage = await context.newPage();
    await adminPage.goto('/');

    // Find and click login
    await adminPage.waitForSelector('input[type="email"], input[placeholder*="Email"]');
    await adminPage.fill('input[type="email"], input[placeholder*="Email"]', 'je2alvarela@gmail.com');
    await adminPage.fill('input[type="password"]', '1357');
    await adminPage.click('button[type="submit"]');

    // Wait for dashboard to load
    await adminPage.waitForTimeout(2000);

    // Navigate to admin panel/users section
    await adminPage.click('text=Admin').catch(() => {});
    await adminPage.click('text=Usuarios').catch(() => {});
    await adminPage.waitForTimeout(1000);

    // TEST 3: Verify user appears in admin panel (EXPECTED TO FAIL)
    const userVisible = await adminPage.locator(`text=${testUser.email}`).isVisible().catch(() => false);
    expect(userVisible, 'Registered user should be visible in admin panel').toBe(true);

    // TEST 4: Verify user has "pending" status
    if (userVisible) {
      const statusElement = await adminPage.locator(`text=${testUser.email}`).locator('..').locator('text=pending, text=Pendiente');
      await expect(statusElement).toBeVisible();
    }

    // Cleanup
    if (pool) {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    }
    await adminPage.close();
  });

  test('should not lose user data on page refresh', async ({ page }) => {
    const timestamp = Date.now();
    const testUser = {
      username: `refreshtest_${timestamp}`,
      email: `refreshtest_${timestamp}@example.com`,
      password: 'TestPassword123!',
    };

    // Register user
    await page.goto('/');
    await page.click('text=Registrarse');
    await page.waitForSelector('form');

    await page.fill('input[name="username"], input[placeholder*="Usuario"]', testUser.username);
    await page.fill('input[name="email"], input[type="email"]', testUser.email);
    await page.fill('input[type="password"]:first-of-type', testUser.password);

    const confirmPasswordFields = await page.locator('input[type="password"]').count();
    if (confirmPasswordFields > 1) {
      await page.fill('input[type="password"]:last-of-type', testUser.password);
    }

    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Try to login with new user
    await page.goto('/');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const loginSuccessful = !await page.locator('text=error, text=inválido, text=incorrecto').isVisible().catch(() => false);

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(1000);

    // TEST 5: Try to login again after refresh (EXPECTED TO FAIL - user lost)
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    const loginAfterRefresh = !await page.locator('text=error, text=inválido, text=incorrecto').isVisible().catch(() => false);

    expect(loginAfterRefresh, 'User should still be able to login after page refresh').toBe(true);

    // Cleanup
    if (pool) {
      await pool.query('DELETE FROM users WHERE email = $1', [testUser.email]);
    }
  });
});
