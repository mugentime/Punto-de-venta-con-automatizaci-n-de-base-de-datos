// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createHealthRouter({ pool, useDb }) {
    const router = express.Router();

    // Real health check: verifies the process is up AND, when a database is
    // configured, that it can actually be reached. Must stay above the SPA
    // catch-all route so it doesn't silently resolve to index.html.
    router.get('/api/health', async (req, res) => {
        if (!useDb) {
            return res.json({ status: 'ok', database: 'in-memory' });
        }
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok', database: 'connected' });
        } catch (error) {
            console.error('Health check DB query failed:', error.message);
            res.status(503).json({ status: 'error', database: 'unreachable' });
        }
    });

    return router;
}
