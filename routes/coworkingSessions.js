// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
//
// NOTE: POST/PUT/DELETE below have no `if (!useDb)` guard, unlike GET. This
// is a known, pre-existing bug (see the architecture audit and
// tests/characterization/server-endpoints.test.js, which pins down the
// current 500-without-a-database behavior on purpose). Phase 2 is a
// verbatim move - this is intentionally NOT fixed here.
import express from 'express';

export function createCoworkingSessionsRouter({ pool, useDb, dbManager, broadcastDataChange }) {
    const router = express.Router();

    router.get('/api/coworking-sessions', async (req, res) => {
        try {
            if (useDb) {
                // PostgreSQL mode
                const limit = parseInt(req.query.limit) || 100;
                const offset = parseInt(req.query.offset) || 0;

                const result = await pool.query(
                    'SELECT * FROM coworking_sessions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                    [limit, offset]
                );
                res.json(result.rows.map(session => ({
                    ...session,
                    hourlyRate: parseFloat(session.hourlyRate),
                    total: parseFloat(session.total),
                    consumedExtras: session.consumedExtras || []
                })));
            } else {
                // File-based mode
                console.log('📁 Fetching coworking sessions from file-based database...');
                const sessions = await dbManager.getCoworkingSessions();
                console.log(`📋 Found ${sessions.length} coworking sessions`);

                // Map field names to match frontend expectations
                const mappedSessions = sessions.map(session => ({
                    ...session,
                    id: session._id || session.id,
                    clientName: session.client || session.clientName,
                    consumedExtras: session.consumedExtras || session.products || []
                }));

                res.json(mappedSessions);
            }
        } catch (error) {
            console.error("Error fetching coworking sessions:", error);
            res.status(500).json({ error: 'Failed to fetch coworking sessions' });
        }
    });

    router.post('/api/coworking-sessions', async (req, res) => {
        try {
            const { clientName, startTime, hourlyRate } = req.body;
            const id = `coworking-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO coworking_sessions (id, "clientName", "startTime", "hourlyRate", "consumedExtras") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, clientName, startTime, hourlyRate || 50, JSON.stringify([])]
            );
            const newSession = result.rows[0];
            broadcastDataChange('coworking-sessions', { action: 'create', id: newSession.id });
            res.status(201).json({
                ...newSession,
                hourlyRate: parseFloat(newSession.hourlyRate),
                total: parseFloat(newSession.total),
                consumedExtras: newSession.consumedExtras || []
            });
        } catch (error) {
            console.error("Error creating coworking session:", error);
            res.status(500).json({ error: 'Failed to create coworking session' });
        }
    });

    router.put('/api/coworking-sessions/:id', async (req, res) => {
        try {
            // Build dynamic update query based on provided fields
            const updates = [];
            const values = [];
            let paramCount = 1;

            if (req.body.endTime !== undefined) {
                updates.push(`"endTime" = $${paramCount++}`);
                values.push(req.body.endTime);
            }
            if (req.body.duration !== undefined) {
                updates.push(`duration = $${paramCount++}`);
                values.push(req.body.duration);
            }
            if (req.body.total !== undefined) {
                updates.push(`total = $${paramCount++}`);
                values.push(req.body.total);
            }
            if (req.body.paymentMethod !== undefined) {
                updates.push(`"paymentMethod" = $${paramCount++}`);
                values.push(req.body.paymentMethod);
            }
            if (req.body.status !== undefined) {
                updates.push(`status = $${paramCount++}`);
                values.push(req.body.status);
            }
            if (req.body.consumedExtras !== undefined) {
                updates.push(`"consumedExtras" = $${paramCount++}`);
                values.push(JSON.stringify(req.body.consumedExtras));
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            values.push(req.params.id);
            const query = `UPDATE coworking_sessions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

            const result = await pool.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Coworking session not found' });
            }
            const updatedSession = result.rows[0];
            broadcastDataChange('coworking-sessions', { action: 'update', id: req.params.id });
            res.json({
                ...updatedSession,
                hourlyRate: parseFloat(updatedSession.hourlyRate),
                total: parseFloat(updatedSession.total),
                consumedExtras: updatedSession.consumedExtras || []
            });
        } catch (error) {
            console.error("Error updating coworking session:", error);
            res.status(500).json({ error: 'Failed to update coworking session' });
        }
    });

    router.delete('/api/coworking-sessions/:id', async (req, res) => {
        try {
            console.log('🗑️ Deleting coworking session:', req.params.id);

            const result = await pool.query('DELETE FROM coworking_sessions WHERE id = $1 RETURNING *', [req.params.id]);

            if (result.rows.length === 0) {
                console.log('❌ Coworking session not found:', req.params.id);
                return res.status(404).json({ error: 'Coworking session not found' });
            }

            console.log('✅ Coworking session deleted successfully:', req.params.id);
            broadcastDataChange('coworking-sessions', { action: 'delete', id: req.params.id });
            res.status(204).send();
        } catch (error) {
            console.error('❌ Error deleting coworking session:', error);
            res.status(500).json({ error: 'Failed to delete coworking session' });
        }
    });

    return router;
}
