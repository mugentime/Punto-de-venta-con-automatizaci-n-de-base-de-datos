// Two implementations of one interface, resolved ONCE at startup based on
// useDb (Phase 3 of the architecture cleanup).
//
// This is what fixes the coworking-sessions bug by construction, not just by
// remembering to add a guard: the old code had GET check `useDb` and branch,
// while POST/PUT/DELETE simply never checked it and called `pool.query`
// unconditionally - so they threw and 500'd whenever there was no database.
// Now there's exactly one code path per operation, chosen once, and every
// route handler goes through it the same way. It's structurally impossible
// for one handler on this resource to "forget" the database might be absent
// while its siblings remember.
//
// The file-backed implementation isn't new capability - utils/databaseManager.cjs
// already had full create/update/delete support for coworking sessions via
// utils/fileDatabase.cjs, it just was never wired up to these routes.

/** @returns {{list: Function, create: Function, update: Function, remove: Function}} */
export function createCoworkingSessionsRepository({ useDb, pool, dbManager }) {
    return useDb ? createPostgresImpl(pool) : createFileImpl(dbManager);
}

function normalizePg(session) {
    return {
        ...session,
        hourlyRate: parseFloat(session.hourlyRate),
        total: parseFloat(session.total),
        consumedExtras: session.consumedExtras || [],
    };
}

function createPostgresImpl(pool) {
    return {
        async list({ limit = 100, offset = 0 } = {}) {
            const result = await pool.query(
                'SELECT * FROM coworking_sessions ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            return result.rows.map(normalizePg);
        },

        async create({ clientName, startTime, hourlyRate }) {
            const id = `coworking-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO coworking_sessions (id, "clientName", "startTime", "hourlyRate", "consumedExtras") VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [id, clientName, startTime, hourlyRate || 50, JSON.stringify([])]
            );
            return normalizePg(result.rows[0]);
        },

        // Returns: the updated session, `undefined` if there were no
        // recognized fields to update, or `null` if the id doesn't exist.
        async update(id, updates) {
            const setClauses = [];
            const values = [];
            let paramCount = 1;
            const columnByField = {
                endTime: '"endTime"',
                duration: 'duration',
                total: 'total',
                paymentMethod: '"paymentMethod"',
                status: 'status',
            };
            for (const [field, column] of Object.entries(columnByField)) {
                if (updates[field] !== undefined) {
                    setClauses.push(`${column} = $${paramCount++}`);
                    values.push(updates[field]);
                }
            }
            if (updates.consumedExtras !== undefined) {
                setClauses.push(`"consumedExtras" = $${paramCount++}`);
                values.push(JSON.stringify(updates.consumedExtras));
            }

            if (setClauses.length === 0) return undefined;

            values.push(id);
            const result = await pool.query(
                `UPDATE coworking_sessions SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
                values
            );
            if (result.rows.length === 0) return null;
            return normalizePg(result.rows[0]);
        },

        // Returns true if a row was deleted, false if the id didn't exist.
        async remove(id) {
            const result = await pool.query('DELETE FROM coworking_sessions WHERE id = $1 RETURNING *', [id]);
            return result.rows.length > 0;
        },
    };
}

function normalizeFile(session) {
    return {
        ...session,
        id: session._id || session.id,
        clientName: session.client || session.clientName,
        hourlyRate: parseFloat(session.hourlyRate || 0),
        total: parseFloat(session.total || 0),
        consumedExtras: session.consumedExtras || session.products || [],
    };
}

function createFileImpl(dbManager) {
    return {
        async list() {
            const sessions = await dbManager.getCoworkingSessions();
            return sessions.map(normalizeFile);
        },

        async create({ clientName, startTime, hourlyRate }) {
            const newSession = await dbManager.createCoworkingSession({
                client: clientName,
                startTime,
                hourlyRate: hourlyRate || 50,
                status: 'active',
                products: [],
            });
            return normalizeFile(newSession);
        },

        // Same return contract as the Postgres impl: session | undefined (no
        // fields to update) | null (not found).
        async update(id, updates) {
            const patch = {};
            if (updates.endTime !== undefined) patch.endTime = updates.endTime;
            if (updates.duration !== undefined) patch.duration = updates.duration;
            if (updates.total !== undefined) patch.total = updates.total;
            if (updates.paymentMethod !== undefined) patch.payment = updates.paymentMethod;
            if (updates.status !== undefined) patch.status = updates.status;
            if (updates.consumedExtras !== undefined) patch.products = updates.consumedExtras;

            if (Object.keys(patch).length === 0) return undefined;

            try {
                const updated = await dbManager.updateCoworkingSession(id, patch);
                return normalizeFile(updated);
            } catch (error) {
                if (error.message === 'Coworking session not found') return null;
                throw error;
            }
        },

        async remove(id) {
            try {
                await dbManager.deleteCoworkingSession(id);
                return true;
            } catch (error) {
                if (error.message === 'Coworking session not found') return false;
                throw error;
            }
        },
    };
}
