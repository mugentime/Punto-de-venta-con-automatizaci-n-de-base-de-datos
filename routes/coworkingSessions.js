// Phase 3 of the architecture cleanup: routes call the repository, which has
// already resolved which storage backend to use. No `useDb` branching here -
// see repositories/coworkingSessions.js for why that's the point.
import express from 'express';

export function createCoworkingSessionsRouter({ coworkingSessions, broadcastDataChange }) {
    const router = express.Router();

    router.get('/api/coworking-sessions', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const offset = parseInt(req.query.offset) || 0;
            const sessions = await coworkingSessions.list({ limit, offset });
            res.json(sessions);
        } catch (error) {
            console.error("Error fetching coworking sessions:", error);
            res.status(500).json({ error: 'Failed to fetch coworking sessions' });
        }
    });

    router.post('/api/coworking-sessions', async (req, res) => {
        try {
            const newSession = await coworkingSessions.create(req.body);
            broadcastDataChange('coworking-sessions', { action: 'create', id: newSession.id });
            res.status(201).json(newSession);
        } catch (error) {
            console.error("Error creating coworking session:", error);
            res.status(500).json({ error: 'Failed to create coworking session' });
        }
    });

    router.put('/api/coworking-sessions/:id', async (req, res) => {
        try {
            const result = await coworkingSessions.update(req.params.id, req.body);
            if (result === undefined) {
                return res.status(400).json({ error: 'No fields to update' });
            }
            if (result === null) {
                return res.status(404).json({ error: 'Coworking session not found' });
            }
            broadcastDataChange('coworking-sessions', { action: 'update', id: req.params.id });
            res.json(result);
        } catch (error) {
            console.error("Error updating coworking session:", error);
            res.status(500).json({ error: 'Failed to update coworking session' });
        }
    });

    router.delete('/api/coworking-sessions/:id', async (req, res) => {
        try {
            console.log('🗑️ Deleting coworking session:', req.params.id);
            const deleted = await coworkingSessions.remove(req.params.id);
            if (!deleted) {
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
