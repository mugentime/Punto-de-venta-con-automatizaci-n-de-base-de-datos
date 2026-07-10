// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createExpensesRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    router.get('/api/expenses', async (req, res) => {
        try {
            if (!useDb) return res.json([]);

            // 🚀 PAGINATION: Add pagination to prevent fetching all expenses
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;

            const result = await pool.query(
                'SELECT * FROM expenses ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            res.json(result.rows.map(expense => ({
                ...expense,
                amount: parseFloat(expense.amount),
                date: expense.created_at,  // Map created_at to date for frontend compatibility
                paymentSource: expense.paymentSource || 'transferencia',
                type: expense.type || 'Emergente'
            })));
        } catch (error) {
            console.error("Error fetching expenses:", error);
            res.status(500).json({ error: 'Failed to fetch expenses' });
        }
    });

    router.post('/api/expenses', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { description, amount, category, userId, paymentSource, type } = req.body;
            const id = `expense-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO expenses (id, description, amount, category, "userId", "paymentSource", type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [id, description, amount, category, userId, paymentSource || 'transferencia', type || 'Emergente']
            );
            const newExpense = result.rows[0];
            res.status(201).json({
                ...newExpense,
                amount: parseFloat(newExpense.amount),
                date: newExpense.created_at,  // Map created_at to date for frontend compatibility
                paymentSource: newExpense.paymentSource,
                type: newExpense.type
            });
        } catch (error) {
            console.error("Error creating expense:", error);
            res.status(500).json({ error: 'Failed to create expense' });
        }
    });

    router.put('/api/expenses/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { description, amount, category, date, paymentSource, type } = req.body;

            // Update with all fields including paymentSource and type
            const result = await pool.query(
                'UPDATE expenses SET description = $1, amount = $2, category = $3, created_at = COALESCE($4, created_at), "paymentSource" = COALESCE($5, "paymentSource"), type = COALESCE($6, type) WHERE id = $7 RETURNING *',
                [description, amount, category, date || null, paymentSource, type, req.params.id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Expense not found' });
            }
            const updatedExpense = result.rows[0];
            broadcastDataChange('expenses', { action: 'update', id: req.params.id });
            res.json({
                ...updatedExpense,
                amount: parseFloat(updatedExpense.amount),
                date: updatedExpense.created_at,  // Map created_at to date for frontend compatibility
                paymentSource: updatedExpense.paymentSource,
                type: updatedExpense.type
            });
        } catch (error) {
            console.error("Error updating expense:", error);
            res.status(500).json({ error: 'Failed to update expense' });
        }
    });

    router.delete('/api/expenses/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
            broadcastDataChange('expenses', { action: 'delete', id: req.params.id });
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting expense:", error);
            res.status(500).json({ error: 'Failed to delete expense' });
        }
    });

    return router;
}
