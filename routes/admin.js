// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createAdminRouter({ pool, useDb, requireAdminKey }) {
    const router = express.Router();

    // --- ADMIN FIX ENDPOINT ---
    router.post('/api/admin/fix-coworking-totals', requireAdminKey, async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        const calculateCoworkingCost = (startTime, endTime) => {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const durationMs = end.getTime() - start.getTime();
            const durationMinutes = Math.max(0, Math.ceil(durationMs / (1000 * 60)));

            // Apply 5-minute tolerance
            let adjustedMinutes = durationMinutes;
            const minutesOverHalfHour = durationMinutes % 30;
            if (minutesOverHalfHour > 0 && minutesOverHalfHour <= 5) {
                adjustedMinutes -= minutesOverHalfHour;
            }

            const durationHours = adjustedMinutes / 60;
            let cost = 0;

            if (adjustedMinutes > 0) {
                if (durationHours >= 3) {
                    cost = 225; // Day rate
                } else if (adjustedMinutes <= 60) {
                    cost = 72; // First hour
                } else {
                    const extraMinutes = adjustedMinutes - 60;
                    const halfHourBlocks = Math.ceil(extraMinutes / 30);
                    cost = 72 + (halfHourBlocks * 36);
                }
            }
            return { cost, minutes: adjustedMinutes };
        };

        try {
            const result = await pool.query(
                'SELECT id, "clientName", "startTime", "endTime", "consumedExtras", total FROM coworking_sessions WHERE status = $1',
                ['finished']
            );

            let updatedCount = 0;
            let skippedCount = 0;
            const updates = [];

            for (const session of result.rows) {
                const { id, clientName, startTime, endTime, consumedExtras, total: currentTotal } = session;

                if (!endTime) {
                    skippedCount++;
                    continue;
                }

                const { cost: baseCost, minutes: duration } = calculateCoworkingCost(startTime, endTime);
                const extras = consumedExtras || [];
                const extrasCost = extras.reduce((acc, item) => acc + ((item.price || 0) * (item.quantity || 0)), 0);
                const calculatedTotal = baseCost + extrasCost;

                await pool.query(
                    'UPDATE coworking_sessions SET total = $1, duration = $2 WHERE id = $3',
                    [calculatedTotal, duration, id]
                );

                updates.push({
                    id,
                    clientName: clientName || 'Unknown',
                    oldTotal: parseFloat(currentTotal || 0),
                    newTotal: calculatedTotal,
                    duration
                });

                updatedCount++;
            }

            res.json({
                success: true,
                message: `Updated ${updatedCount} sessions, skipped ${skippedCount}`,
                updatedCount,
                skippedCount,
                updates
            });
        } catch (error) {
            console.error('Error fixing coworking totals:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // --- DATABASE OPTIMIZATION ENDPOINT ---
    router.post('/api/admin/optimize-database', requireAdminKey, async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        try {
            console.log('🚀 Starting database optimization...');
            const results = {
                fixedDates: 0,
                indexesCreated: 0,
                indexesExisted: 0
            };

            // Fix null dates in expenses
            console.log('📝 Fixing null dates in expenses...');
            const fixDatesResult = await pool.query(`
                UPDATE expenses
                SET created_at = CURRENT_TIMESTAMP
                WHERE created_at IS NULL
            `);
            results.fixedDates = fixDatesResult.rowCount;
            console.log(`✅ Fixed ${results.fixedDates} expenses with null dates`);

            // Add indexes for better performance
            console.log('🚀 Adding database indexes...');

            const indexes = [
                { name: 'idx_orders_created_at', table: 'orders', column: 'created_at DESC' },
                { name: 'idx_expenses_created_at', table: 'expenses', column: 'created_at DESC' },
                { name: 'idx_coworking_created_at', table: 'coworking_sessions', column: 'created_at DESC' },
                { name: 'idx_coworking_status', table: 'coworking_sessions', column: 'status' },
                { name: 'idx_customer_credits_customer', table: 'customer_credits', column: '"customerId"' }
            ];

            for (const idx of indexes) {
                try {
                    await pool.query(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table}(${idx.column})`);
                    results.indexesCreated++;
                    console.log(`✅ Created index ${idx.name}`);
                } catch (e) {
                    results.indexesExisted++;
                    console.log(`ℹ️  Index ${idx.name} already exists`);
                }
            }

            res.json({
                success: true,
                message: 'Database optimization completed successfully',
                results
            });

        } catch (error) {
            console.error('❌ Optimization failed:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    // --- TEMPORARY MIGRATION ENDPOINT ---
    router.post('/api/admin/add-customerId-column', requireAdminKey, async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        try {
            console.log('🔍 Checking if customerId column exists in orders table...');

            // Check if customerId column already exists
            const checkColumn = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'orders'
                AND column_name = 'customerId'
            `);

            if (checkColumn.rows.length > 0) {
                console.log('ℹ️  Column customerId already exists in orders table');
                return res.json({
                    success: true,
                    message: 'Column customerId already exists',
                    alreadyExists: true
                });
            }

            console.log('📝 Adding customerId column to orders table...');
            await pool.query(`
                ALTER TABLE orders
                ADD COLUMN "customerId" VARCHAR(255)
            `);

            console.log('✅ Successfully added customerId column to orders table');

            res.json({
                success: true,
                message: 'Successfully added customerId column to orders table',
                alreadyExists: false
            });

        } catch (error) {
            console.error('❌ Migration failed:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                details: error.stack
            });
        }
    });

    return router;
}
