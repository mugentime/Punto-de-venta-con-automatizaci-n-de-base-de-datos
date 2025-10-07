/**
 * Script to fix coworking session totals in the database
 * This recalculates and updates the total field for all finished coworking sessions
 */

import pg from 'pg';
const { Pool } = pg;

const calculateCoworkingCost = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.max(0, Math.ceil(durationMs / (1000 * 60)));

    // Apply 5-minute tolerance (65 min = 60 min, 95 min = 90 min, etc.)
    let adjustedMinutes = durationMinutes;
    const minutesOverHalfHour = durationMinutes % 30;
    if (minutesOverHalfHour > 0 && minutesOverHalfHour <= 5) {
        adjustedMinutes -= minutesOverHalfHour;
    }

    const durationHours = adjustedMinutes / 60;

    let cost = 0;
    if (adjustedMinutes > 0) {
        if (durationHours >= 3) {
            // 3+ hours = day rate
            cost = 180;
        } else if (adjustedMinutes <= 60) {
            // First hour: $58
            cost = 58;
        } else {
            // After first hour: $29 per half-hour block
            const extraMinutes = adjustedMinutes - 60;
            const halfHourBlocks = Math.ceil(extraMinutes / 30);
            cost = 58 + (halfHourBlocks * 29);
        }
    }
    return { cost, minutes: adjustedMinutes };
};

async function fixCoworkingTotals() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('❌ ERROR: DATABASE_URL environment variable not set');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: databaseUrl });

    try {
        console.log('🔍 Connecting to database...');
        const client = await pool.connect();

        // Get all finished coworking sessions
        const result = await client.query(
            'SELECT id, "startTime", "endTime", "consumedExtras", total FROM coworking_sessions WHERE status = $1',
            ['finished']
        );

        console.log(`📊 Found ${result.rows.length} finished coworking sessions`);

        let updatedCount = 0;
        let skippedCount = 0;

        for (const session of result.rows) {
            const { id, startTime, endTime, consumedExtras, total: currentTotal } = session;

            if (!endTime) {
                console.log(`⏭️  Skipping ${id} - no end time`);
                skippedCount++;
                continue;
            }

            // Calculate coworking cost based on duration
            const { cost: baseCost, minutes: duration } = calculateCoworkingCost(startTime, endTime);

            // Calculate extras cost
            const extras = consumedExtras || [];
            const extrasCost = extras.reduce((acc, item) => {
                return acc + ((item.price || 0) * (item.quantity || 0));
            }, 0);

            const calculatedTotal = baseCost + extrasCost;

            // Update the session
            await client.query(
                'UPDATE coworking_sessions SET total = $1, duration = $2 WHERE id = $3',
                [calculatedTotal, duration, id]
            );

            console.log(`✅ Updated ${id}: ${session.clientName || 'Unknown'} - $${currentTotal} → $${calculatedTotal} (${duration} min)`);
            updatedCount++;
        }

        client.release();
        await pool.end();

        console.log('\n✨ Update complete!');
        console.log(`   Updated: ${updatedCount} sessions`);
        console.log(`   Skipped: ${skippedCount} sessions`);

    } catch (error) {
        console.error('❌ Error updating coworking sessions:', error);
        process.exit(1);
    }
}

// Run the fix
fixCoworkingTotals();
