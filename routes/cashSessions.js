// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createCashSessionsRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    router.get('/api/cash-sessions', async (req, res) => {
        try {
            if (!useDb) return res.json([]);

            // 🚀 PERFORMANCE FIX: Add pagination with sensible defaults
            const limit = parseInt(req.query.limit) || 100; // Default: last 100 sessions
            const offset = parseInt(req.query.offset) || 0;
            const status = req.query.status; // Optional: filter by status ('active' or 'closed')

            // Build query with optional status filter
            let query = 'SELECT * FROM cash_sessions';
            let params = [];

            if (status) {
                query += ' WHERE status = $1';
                params.push(status);
                query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
                params.push(limit, offset);
            } else {
                query += ' ORDER BY created_at DESC LIMIT $1 OFFSET $2';
                params.push(limit, offset);
            }

            console.log(`📊 Fetching cash sessions (limit: ${limit}, offset: ${offset}, status: ${status || 'all'})`);
            const result = await pool.query(query, params);
            console.log(`✅ Retrieved ${result.rows.length} cash sessions`);

            res.json(result.rows.map(session => ({
                ...session,
                startAmount: parseFloat(session.startAmount),
                endAmount: session.endAmount ? parseFloat(session.endAmount) : null,
                totalSales: parseFloat(session.totalSales),
                totalExpenses: parseFloat(session.totalExpenses),
                expectedCash: parseFloat(session.expectedCash),
                difference: parseFloat(session.difference)
            })));
        } catch (error) {
            console.error("Error fetching cash sessions:", error);
            res.status(500).json({ error: 'Failed to fetch cash sessions' });
        }
    });

    router.post('/api/cash-sessions', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { startAmount, startTime, userId } = req.body;
            const id = `cash-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO cash_sessions (id, "startAmount", "startTime", "userId") VALUES ($1, $2, $3, $4) RETURNING *',
                [id, startAmount, startTime, userId]
            );
            const newSession = result.rows[0];
            broadcastDataChange('cash-sessions', { action: 'create', id: newSession.id });
            res.status(201).json({
                ...newSession,
                startAmount: parseFloat(newSession.startAmount),
                endAmount: newSession.endAmount ? parseFloat(newSession.endAmount) : null,
                totalSales: parseFloat(newSession.totalSales),
                totalExpenses: parseFloat(newSession.totalExpenses),
                expectedCash: parseFloat(newSession.expectedCash),
                difference: parseFloat(newSession.difference)
            });
        } catch (error) {
            console.error("Error creating cash session:", error);
            res.status(500).json({ error: 'Failed to create cash session' });
        }
    });

    router.put('/api/cash-sessions/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { endAmount, endTime, totalSales, totalExpenses, expectedCash, difference, status } = req.body;
            const result = await pool.query(
                'UPDATE cash_sessions SET "endAmount" = $1, "endTime" = $2, "totalSales" = $3, "totalExpenses" = $4, "expectedCash" = $5, difference = $6, status = $7 WHERE id = $8 RETURNING *',
                [endAmount, endTime, totalSales, totalExpenses, expectedCash, difference, status, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Cash session not found' });
            }
            const updatedSession = result.rows[0];
            broadcastDataChange('cash-sessions', { action: 'update', id: req.params.id });
            res.json({
                ...updatedSession,
                startAmount: parseFloat(updatedSession.startAmount),
                endAmount: updatedSession.endAmount ? parseFloat(updatedSession.endAmount) : null,
                totalSales: parseFloat(updatedSession.totalSales),
                totalExpenses: parseFloat(updatedSession.totalExpenses),
                expectedCash: parseFloat(updatedSession.expectedCash),
                difference: parseFloat(updatedSession.difference)
            });
        } catch (error) {
            console.error("Error updating cash session:", error);
            res.status(500).json({ error: 'Failed to update cash session' });
        }
    });

    return router;
}
