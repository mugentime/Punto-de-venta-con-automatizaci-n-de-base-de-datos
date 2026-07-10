// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
// No logic changed - same rate limiter, same admin-key guard.

/** Lightweight in-process rate limiter (no external library needed). */
export function createSimpleRateLimiter(maxRequests, windowMs) {
    const hits = new Map(); // ip -> { count, resetAt }
    return (req, res, next) => {
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
        const now = Date.now();
        let entry = hits.get(ip);
        if (!entry || now > entry.resetAt) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(ip, entry);
        }
        entry.count++;
        if (entry.count > maxRequests) {
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
        // Periodic cleanup to prevent unbounded map growth
        if (hits.size > 5000) {
            for (const [k, v] of hits) {
                if (now > v.resetAt) hits.delete(k);
            }
        }
        next();
    };
}

/** Admin-key guard - requires X-Admin-Key header matching ADMIN_SECRET_KEY env var. */
export function requireAdminKey(req, res, next) {
    const adminKey = process.env.ADMIN_SECRET_KEY;
    if (!adminKey) {
        console.warn('⚠️  ADMIN_SECRET_KEY not configured — admin endpoint blocked for safety. Set it in .env to enable.');
        return res.status(503).json({ error: 'Admin endpoints disabled: configure ADMIN_SECRET_KEY in environment.' });
    }
    const provided = req.headers['x-admin-key'] || req.query.adminKey;
    if (!provided || provided !== adminKey) {
        return res.status(403).json({ error: 'Forbidden: valid X-Admin-Key header required.' });
    }
    next();
}
