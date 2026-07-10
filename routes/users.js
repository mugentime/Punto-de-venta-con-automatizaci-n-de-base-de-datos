// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createUsersRouter({ pool, useDb }) {
    const router = express.Router();

    router.get('/api/users', async (req, res) => {
        try {
            if (!useDb) return res.json([]);
            const result = await pool.query('SELECT id, username, email, role, status, created_at FROM users ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    router.post('/api/users', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { username, email, password, role, status } = req.body;
            const id = `user-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO users (id, username, email, password, role, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, email, role, status, created_at',
                [id, username, email, password, role || 'user', status || 'pending']
            );
            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error("Error creating user:", error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    router.put('/api/users/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { username, email, role, status } = req.body;
            const result = await pool.query(
                'UPDATE users SET username = $1, email = $2, role = $3, status = $4 WHERE id = $5 RETURNING id, username, email, role, status, created_at',
                [username, email, role, status, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(result.rows[0]);
        } catch (error) {
            console.error("Error updating user:", error);
            res.status(500).json({ error: 'Failed to update user' });
        }
    });

    router.delete('/api/users/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting user:", error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    });

    return router;
}
