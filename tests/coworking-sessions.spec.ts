import { test, expect } from '@playwright/test';
import pg from 'pg';

const { Pool } = pg;

/**
 * Coworking Session Cross-Device Closure Bug Reproduction Test
 *
 * BUG: Users on different devices report inability to close coworking sessions.
 * Likely state synchronization issue between devices. Sessions may be stuck
 * in 'active' status.
 *
 * Expected Behavior:
 * 1. User starts coworking session on Device A
 * 2. User opens app on Device B (different browser context)
 * 3. User can see and close the session from Device B
 * 4. Session status updates to 'finished'
 * 5. Changes are persisted to database
 *
 * Current Behavior (BUG):
 * 1. User starts session on Device A
 * 2. User opens app on Device B
 * 3. Session may not be visible OR
 * 4. Session cannot be closed from Device B OR
 * 5. Session stays in 'active' status
 */

test.describe('Coworking Session Cross-Device Bug', () => {
  let pool: pg.Pool;

  test.beforeAll(async () => {
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

  test('should close coworking session from different browser context', async ({ browser }) => {
    // Create two separate browser contexts to simulate different devices
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();

    const pageA = await deviceA.newPage();
    const pageB = await deviceB.newPage();

    try {
      // DEVICE A: Login and start coworking session
      await pageA.goto('/');
      await pageA.fill('input[type="email"]', 'je2alvarela@gmail.com');
      await pageA.fill('input[type="password"]', '1357');
      await pageA.click('button[type="submit"]');
      await pageA.waitForTimeout(2000);

      // Navigate to coworking section
      await pageA.click('text=Coworking').catch(() => {});
      await pageA.waitForTimeout(1000);

      // Start a new coworking session
      const timestamp = Date.now();
      const clientName = `TestClient_${timestamp}`;

      await pageA.click('button:has-text("Nueva Sesión"), button:has-text("Iniciar"), button:has-text("Agregar")');
      await pageA.waitForTimeout(500);

      await pageA.fill('input[name="clientName"], input[placeholder*="Cliente"], input[placeholder*="Nombre"]', clientName);
      await pageA.click('button[type="submit"], button:has-text("Iniciar"), button:has-text("Guardar")');
      await pageA.waitForTimeout(2000);

      // Verify session was created
      await expect(pageA.locator(`text=${clientName}`)).toBeVisible();

      // Get session ID from database
      let sessionId: string | null = null;
      if (pool) {
        const result = await pool.query(
          'SELECT id FROM coworking_sessions WHERE "clientName" = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
          [clientName, 'active']
        );

        expect(result.rows.length, 'Session should be created in database').toBeGreaterThan(0);
        sessionId = result.rows[0]?.id;
      }

      // DEVICE B: Login with same user
      await pageB.goto('/');
      await pageB.fill('input[type="email"]', 'je2alvarela@gmail.com');
      await pageB.fill('input[type="password"]', '1357');
      await pageB.click('button[type="submit"]');
      await pageB.waitForTimeout(2000);

      // Navigate to coworking section on Device B
      await pageB.click('text=Coworking').catch(() => {});
      await pageB.waitForTimeout(1000);

      // TEST 1: Verify session is visible on Device B
      const sessionVisibleOnB = await pageB.locator(`text=${clientName}`).isVisible();
      expect(sessionVisibleOnB, 'Session should be visible on Device B').toBe(true);

      // TEST 2: Try to close the session from Device B
      const sessionRow = pageB.locator(`text=${clientName}`).locator('..');
      const closeButton = sessionRow.locator('button:has-text("Cerrar"), button:has-text("Finalizar"), button:has-text("Terminar")').first();

      const closeButtonExists = await closeButton.count() > 0;
      expect(closeButtonExists, 'Close button should be available on Device B').toBe(true);

      if (closeButtonExists) {
        // Setup API request listener
        let updateApiCalled = false;
        pageB.on('request', request => {
          if (request.url().includes('/api/coworking-sessions') && request.method() === 'PUT') {
            updateApiCalled = true;
          }
        });

        await closeButton.click();
        await pageB.waitForTimeout(1000);

        // Fill payment method if modal appears
        const paymentMethodField = pageB.locator('select[name="paymentMethod"], input[name="paymentMethod"]');
        if (await paymentMethodField.isVisible().catch(() => false)) {
          await paymentMethodField.selectOption('Efectivo').catch(() =>
            paymentMethodField.fill('Efectivo')
          );
          await pageB.click('button[type="submit"], button:has-text("Cerrar"), button:has-text("Finalizar")');
        }

        await pageB.waitForTimeout(2000);

        // TEST 3: Verify PUT API was called
        expect(updateApiCalled, 'PUT /api/coworking-sessions should be called to close session').toBe(true);

        // TEST 4: Verify session is closed in database
        if (pool && sessionId) {
          const result = await pool.query(
            'SELECT status, "endTime", total FROM coworking_sessions WHERE id = $1',
            [sessionId]
          );

          expect(result.rows.length).toBeGreaterThan(0);
          const session = result.rows[0];

          expect(session.status, 'Session status should be "finished"').toBe('finished');
          expect(session.endTime, 'Session should have endTime set').not.toBeNull();
          expect(parseFloat(session.total), 'Session should have total calculated').toBeGreaterThan(0);
        }

        // TEST 5: Verify session status updates on Device A (refresh)
        await pageA.reload();
        await pageA.waitForTimeout(1000);
        await pageA.click('text=Coworking').catch(() => {});
        await pageA.waitForTimeout(1000);

        // Session should not appear in active sessions
        const sessionInActiveList = await pageA.locator(`text=${clientName}`).isVisible().catch(() => false);

        // Or should show as finished
        const finishedStatus = await pageA.locator(`text=${clientName}`).locator('..').locator('text=finished, text=Finalizada, text=Cerrada').isVisible().catch(() => false);

        expect(sessionInActiveList === false || finishedStatus === true, 'Session should not be in active list or show as finished').toBe(true);
      }

      // Cleanup
      if (pool && sessionId) {
        await pool.query('DELETE FROM coworking_sessions WHERE id = $1', [sessionId]);
      }

    } finally {
      await pageA.close();
      await pageB.close();
      await deviceA.close();
      await deviceB.close();
    }
  });

  test('should sync session data between multiple devices in real-time', async ({ browser }) => {
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();

    const pageA = await deviceA.newPage();
    const pageB = await deviceB.newPage();

    try {
      // Login on both devices
      for (const page of [pageA, pageB]) {
        await page.goto('/');
        await page.fill('input[type="email"]', 'je2alvarela@gmail.com');
        await page.fill('input[type="password"]', '1357');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        await page.click('text=Coworking').catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Create session on Device A
      const timestamp = Date.now();
      const clientName = `SyncTest_${timestamp}`;

      await pageA.click('button:has-text("Nueva Sesión"), button:has-text("Iniciar"), button:has-text("Agregar")');
      await pageA.waitForTimeout(500);
      await pageA.fill('input[name="clientName"], input[placeholder*="Cliente"]', clientName);
      await pageA.click('button[type="submit"], button:has-text("Iniciar")');
      await pageA.waitForTimeout(2000);

      // TEST: Refresh Device B and verify session appears
      await pageB.reload();
      await pageB.waitForTimeout(1000);
      await pageB.click('text=Coworking').catch(() => {});
      await pageB.waitForTimeout(1000);

      const sessionVisibleAfterRefresh = await pageB.locator(`text=${clientName}`).isVisible();
      expect(sessionVisibleAfterRefresh, 'Newly created session should appear on Device B after refresh').toBe(true);

      // Cleanup
      if (pool) {
        await pool.query('DELETE FROM coworking_sessions WHERE "clientName" = $1', [clientName]);
      }

    } finally {
      await pageA.close();
      await pageB.close();
      await deviceA.close();
      await deviceB.close();
    }
  });

  test('should handle concurrent session updates from multiple devices', async ({ browser }) => {
    // This test checks for race conditions when multiple devices try to update the same session
    const deviceA = await browser.newContext();
    const deviceB = await browser.newContext();

    const pageA = await deviceA.newPage();
    const pageB = await deviceB.newPage();

    try {
      // Login on both devices
      for (const page of [pageA, pageB]) {
        await page.goto('/');
        await page.fill('input[type="email"]', 'je2alvarela@gmail.com');
        await page.fill('input[type="password"]', '1357');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        await page.click('text=Coworking').catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Create session
      const timestamp = Date.now();
      const clientName = `ConcurrentTest_${timestamp}`;

      await pageA.click('button:has-text("Nueva Sesión"), button:has-text("Iniciar")');
      await pageA.waitForTimeout(500);
      await pageA.fill('input[name="clientName"], input[placeholder*="Cliente"]', clientName);
      await pageA.click('button[type="submit"]');
      await pageA.waitForTimeout(2000);

      // Refresh Device B
      await pageB.reload();
      await pageB.waitForTimeout(1000);
      await pageB.click('text=Coworking').catch(() => {});
      await pageB.waitForTimeout(1000);

      // Try to close from both devices simultaneously
      const closeA = pageA.locator(`text=${clientName}`).locator('..').locator('button:has-text("Cerrar")').first().click();
      const closeB = pageB.locator(`text=${clientName}`).locator('..').locator('button:has-text("Cerrar")').first().click();

      await Promise.all([closeA, closeB]).catch(() => {
        // One might fail, that's okay
      });

      await pageA.waitForTimeout(2000);
      await pageB.waitForTimeout(2000);

      // TEST: Verify session was closed only once in database
      if (pool) {
        const result = await pool.query(
          'SELECT COUNT(*) as count FROM coworking_sessions WHERE "clientName" = $1 AND status = $2',
          [clientName, 'finished']
        );

        const closedCount = parseInt(result.rows[0].count);
        expect(closedCount, 'Session should be closed exactly once, not duplicated').toBeLessThanOrEqual(1);

        // Cleanup
        await pool.query('DELETE FROM coworking_sessions WHERE "clientName" = $1', [clientName]);
      }

    } finally {
      await pageA.close();
      await pageB.close();
      await deviceA.close();
      await deviceB.close();
    }
  });
});
