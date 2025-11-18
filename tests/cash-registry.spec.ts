import { test, expect } from '@playwright/test';
import pg from 'pg';

const { Pool } = pg;

/**
 * Cash Registry Bug Reproduction Test
 *
 * BUG: No cash_registry or cash_drawer table in database. cash_sessions table
 * exists but no daily registry for tracking opening/closing balances across
 * multiple sessions.
 *
 * Expected Behavior:
 * 1. cash_registry or cash_drawer table should exist
 * 2. Each day should have a registry entry with opening balance
 * 3. Multiple cash sessions can be associated with one registry
 * 4. Daily totals should be calculated across all sessions
 * 5. Closing balance should be tracked per day, not per session
 *
 * Current Behavior (BUG):
 * 1. No cash_registry table exists
 * 2. cash_sessions table exists but lacks daily aggregation
 * 3. Cannot track daily opening/closing balances
 * 4. Cannot handle multiple sessions in one day properly
 */

test.describe('Cash Registry Bug', () => {
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

  test('should have cash_registry table in database', async () => {
    if (!pool) {
      test.skip();
      return;
    }

    // TEST 1: Check if cash_registry table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'cash_registry'
      ) as exists;
    `;

    const result = await pool.query(tableCheckQuery);
    const tableExists = result.rows[0].exists;

    expect(tableExists, 'cash_registry table should exist in database').toBe(true);
  });

  test('should have cash_drawer table as alternative', async () => {
    if (!pool) {
      test.skip();
      return;
    }

    // TEST 2: Check if cash_drawer table exists (alternative naming)
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'cash_drawer'
      ) as exists;
    `;

    const result = await pool.query(tableCheckQuery);
    const tableExists = result.rows[0].exists;

    // If cash_registry doesn't exist, at least cash_drawer should
    expect(tableExists, 'cash_drawer table should exist if cash_registry does not').toBe(true);
  });

  test('should have daily_cash_register table for daily tracking', async () => {
    if (!pool) {
      test.skip();
      return;
    }

    // TEST 3: Check for any table that handles daily cash tracking
    const tableCheckQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (
        table_name LIKE '%cash%registry%'
        OR table_name LIKE '%cash%drawer%'
        OR table_name LIKE '%daily%cash%'
      );
    `;

    const result = await pool.query(tableCheckQuery);
    const hasCashRegistryTable = result.rows.length > 0;

    expect(hasCashRegistryTable, 'Should have at least one table for cash registry/drawer management').toBe(true);

    if (hasCashRegistryTable) {
      console.log('Found cash registry tables:', result.rows.map(r => r.table_name));
    }
  });

  test('cash_registry table should have proper schema', async () => {
    if (!pool) {
      test.skip();
      return;
    }

    // First check if table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'cash_registry'
      ) as exists;
    `);

    if (!tableExists.rows[0].exists) {
      test.skip();
      return;
    }

    // TEST 4: Verify cash_registry has required columns
    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'cash_registry';
    `;

    const result = await pool.query(columnsQuery);
    const columns = result.rows.map(r => r.column_name);

    const requiredColumns = [
      'id',
      'date',
      'opening_balance',
      'closing_balance',
      'expected_cash',
      'actual_cash',
      'difference',
      'status',
      'userId',
      'created_at'
    ];

    for (const col of requiredColumns) {
      const hasColumn = columns.some(c => c.toLowerCase().includes(col.toLowerCase().replace('_', '')));
      expect(hasColumn, `cash_registry should have ${col} column`).toBe(true);
    }
  });

  test('should create daily cash registry entry via UI', async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.fill('input[type="email"]', 'je2alvarela@gmail.com');
    await page.fill('input[type="password"]', '1357');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Navigate to cash management section
    const cashSectionExists = await page.locator('text=Caja, text=Cash, text=Efectivo').first().isVisible().catch(() => false);

    if (!cashSectionExists) {
      console.log('Cash management section not found in UI');
      test.skip();
      return;
    }

    await page.click('text=Caja, text=Cash, text=Efectivo').first();
    await page.waitForTimeout(1000);

    // Look for daily registry or drawer management
    const registryButtonExists = await page.locator('button:has-text("Registro"), button:has-text("Abrir Caja"), button:has-text("Nueva Caja")').first().isVisible().catch(() => false);

    expect(registryButtonExists, 'Should have button to open/create daily cash registry').toBe(true);

    if (!registryButtonExists) {
      test.skip();
      return;
    }

    // Try to create daily registry entry
    await page.click('button:has-text("Registro"), button:has-text("Abrir Caja"), button:has-text("Nueva Caja")').first();
    await page.waitForTimeout(500);

    // Fill opening balance
    const openingBalanceField = page.locator('input[name="opening_balance"], input[name="openingBalance"], input[placeholder*="Apertura"], input[placeholder*="Inicial"]').first();
    const fieldExists = await openingBalanceField.isVisible().catch(() => false);

    expect(fieldExists, 'Should have field for opening balance').toBe(true);

    if (fieldExists) {
      await openingBalanceField.fill('1000');

      // Submit form
      await page.click('button[type="submit"], button:has-text("Abrir"), button:has-text("Crear")');
      await page.waitForTimeout(2000);

      // Verify entry was created
      if (pool) {
        const today = new Date().toISOString().split('T')[0];

        // Try to find the registry entry
        const registryQuery = `
          SELECT * FROM cash_registry
          WHERE date >= $1
          ORDER BY created_at DESC
          LIMIT 1;
        `;

        try {
          const result = await pool.query(registryQuery, [today]);
          const hasEntry = result.rows.length > 0;

          expect(hasEntry, 'Daily cash registry entry should be created in database').toBe(true);

          if (hasEntry) {
            const entry = result.rows[0];
            expect(parseFloat(entry.opening_balance)).toBe(1000);

            // Cleanup
            await pool.query('DELETE FROM cash_registry WHERE id = $1', [entry.id]);
          }
        } catch (err) {
          // Table doesn't exist - this is expected to fail
          console.error('cash_registry table does not exist:', err);
          throw err;
        }
      }
    }
  });

  test('should support multiple cash sessions per day', async () => {
    if (!pool) {
      test.skip();
      return;
    }

    // Check if cash_registry table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'cash_registry'
      ) as exists;
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Skipping test - cash_registry table does not exist');
      test.skip();
      return;
    }

    // Create a test registry entry
    const registryId = `registry-test-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    await pool.query(`
      INSERT INTO cash_registry (id, date, opening_balance, status, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [registryId, today, 1000, 'active']);

    // Create multiple cash sessions for the same day
    const session1Id = `session-1-${Date.now()}`;
    const session2Id = `session-2-${Date.now()}`;

    await pool.query(`
      INSERT INTO cash_sessions (id, "startAmount", "startTime", status, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP)
    `, [session1Id, 1000, 'closed']);

    await pool.query(`
      INSERT INTO cash_sessions (id, "startAmount", "startTime", status, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP)
    `, [session2Id, 1500, 'active']);

    // TEST: Verify both sessions exist for the same day
    const sessionsQuery = `
      SELECT COUNT(*) as count
      FROM cash_sessions
      WHERE DATE(created_at) = $1
    `;

    const result = await pool.query(sessionsQuery, [today]);
    const sessionCount = parseInt(result.rows[0].count);

    expect(sessionCount, 'Should support multiple cash sessions per day').toBeGreaterThanOrEqual(2);

    // Cleanup
    await pool.query('DELETE FROM cash_registry WHERE id = $1', [registryId]);
    await pool.query('DELETE FROM cash_sessions WHERE id IN ($1, $2)', [session1Id, session2Id]);
  });

  test('should aggregate totals across multiple sessions per day', async () => {
    if (!pool) {
      test.skip();
      return;
    }

    // Check table existence
    const tableExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cash_registry') as exists;
    `);

    if (!tableExists.rows[0].exists) {
      test.skip();
      return;
    }

    const registryId = `registry-agg-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    // Create registry
    await pool.query(`
      INSERT INTO cash_registry (id, date, opening_balance, status, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `, [registryId, today, 1000, 'active']);

    // Create sessions with sales
    const session1Id = `session-agg-1-${Date.now()}`;
    const session2Id = `session-agg-2-${Date.now()}`;

    await pool.query(`
      INSERT INTO cash_sessions (id, "startAmount", "startTime", "totalSales", status, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, CURRENT_TIMESTAMP)
    `, [session1Id, 1000, 500, 'closed']);

    await pool.query(`
      INSERT INTO cash_sessions (id, "startAmount", "startTime", "totalSales", status, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, CURRENT_TIMESTAMP)
    `, [session2Id, 1500, 750, 'closed']);

    // TEST: Calculate daily totals
    const aggregateQuery = `
      SELECT
        SUM("totalSales") as total_sales,
        SUM("totalExpenses") as total_expenses
      FROM cash_sessions
      WHERE DATE(created_at) = $1
    `;

    const result = await pool.query(aggregateQuery, [today]);
    const totalSales = parseFloat(result.rows[0].total_sales || 0);

    expect(totalSales, 'Should aggregate sales across multiple sessions').toBe(1250);

    // Cleanup
    await pool.query('DELETE FROM cash_registry WHERE id = $1', [registryId]);
    await pool.query('DELETE FROM cash_sessions WHERE id IN ($1, $2)', [session1Id, session2Id]);
  });
});
