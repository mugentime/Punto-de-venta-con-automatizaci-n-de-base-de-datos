// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createCashWithdrawalsRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    router.get('/api/cash-withdrawals', async (req, res) => {
        try {
            if (!useDb) return res.json([]);

            // 🚀 PAGINATION: Add pagination to prevent fetching all withdrawals
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;

            const result = await pool.query(
                'SELECT * FROM cash_withdrawals ORDER BY withdrawn_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            res.json(result.rows.map(withdrawal => ({
                ...withdrawal,
                amount: parseFloat(withdrawal.amount)
            })));
        } catch (error) {
            console.error("Error fetching cash withdrawals:", error);
            res.status(500).json({ error: 'Failed to fetch cash withdrawals' });
        }
    });

    router.get('/api/cash-withdrawals/session/:sessionId', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query(
                'SELECT * FROM cash_withdrawals WHERE cash_session_id = $1 ORDER BY withdrawn_at DESC',
                [req.params.sessionId]
            );
            res.json(result.rows.map(withdrawal => ({
                ...withdrawal,
                amount: parseFloat(withdrawal.amount)
            })));
        } catch (error) {
            console.error("Error fetching session withdrawals:", error);
            res.status(500).json({ error: 'Failed to fetch session withdrawals' });
        }
    });

    router.post('/api/cash-withdrawals', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { cashSessionId, amount, description, userId } = req.body;
            const id = `withdrawal-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO cash_withdrawals (id, cash_session_id, amount, description, withdrawn_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, cashSessionId, amount, description, userId]
            );
            const newWithdrawal = result.rows[0];
            broadcastDataChange('cash-withdrawals', { action: 'create', id: newWithdrawal.id });
            res.status(201).json({
                ...newWithdrawal,
                amount: parseFloat(newWithdrawal.amount)
            });
        } catch (error) {
            console.error("Error creating cash withdrawal:", error);
            res.status(500).json({ error: 'Failed to create cash withdrawal' });
        }
    });

    router.delete('/api/cash-withdrawals/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM cash_withdrawals WHERE id = $1', [req.params.id]);
            broadcastDataChange('cash-withdrawals', { action: 'delete', id: req.params.id });
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting cash withdrawal:", error);
            res.status(500).json({ error: 'Failed to delete cash withdrawal' });
        }
    });

    return router;
}
