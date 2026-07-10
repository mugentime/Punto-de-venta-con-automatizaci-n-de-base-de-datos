// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createAuthRouter({ pool, useDb, loginRateLimiter }) {
    const router = express.Router();

    // --- LOGIN ENDPOINT ---
    router.post('/api/login', loginRateLimiter, async (req, res) => {
        try {
            const { username, password } = req.body;

            // 🧪 IN-MEMORY MODE: Fallback admin login, configured via env vars only (no hardcoded credentials)
            if (!useDb) {
                const fallbackUsername = process.env.FALLBACK_ADMIN_USERNAME;
                const fallbackPassword = process.env.FALLBACK_ADMIN_PASSWORD;
                if (!fallbackUsername || !fallbackPassword) {
                    console.warn('⚠️  No database configured and FALLBACK_ADMIN_USERNAME/FALLBACK_ADMIN_PASSWORD not set — login disabled.');
                    return res.status(503).json({ error: 'No hay base de datos configurada y no hay credenciales de respaldo definidas.' });
                }
                if (username.toLowerCase() !== fallbackUsername.toLowerCase()) {
                    return res.status(401).json({ error: 'Usuario no encontrado.' });
                }
                if (password !== fallbackPassword) {
                    return res.status(401).json({ error: 'Contraseña incorrecta.' });
                }
                return res.json({
                    id: 'fallback-admin',
                    username: fallbackUsername,
                    email: process.env.FALLBACK_ADMIN_EMAIL || '',
                    role: 'admin',
                    status: 'approved'
                });
            }

            // Query database for user with password
            const result = await pool.query(
                'SELECT id, username, email, password, role, status FROM users WHERE LOWER(username) = LOWER($1)',
                [username]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Usuario no encontrado.' });
            }

            const user = result.rows[0];

            // TODO: passwords are stored and compared in plaintext.
            // Migrate to bcrypt: npm install bcryptjs, hash on registration, use bcrypt.compare() here.
            // WARNING: changing this requires a one-time migration of all stored passwords.
            if (user.password !== password) {
                return res.status(401).json({ error: 'Contraseña incorrecta.' });
            }

            // Check if user is approved
            if (user.status !== 'approved') {
                return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación.' });
            }

            // Return user data without password
            res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                status: user.status
            });
        } catch (error) {
            console.error("Error during login:", error);
            res.status(500).json({ error: 'Failed to login' });
        }
    });

    return router;
}
