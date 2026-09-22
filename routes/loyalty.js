// Loyalty program (tarjetas de lealtad con QR de madera).
// Follows the same router-factory pattern as the rest of routes/ : a factory that
// receives the shared pg pool + useDb flag and returns an express.Router with
// full-path routes mounted in server.js.
//
// Auth: these routes are intentionally left open (same posture as /api/customers and
// /api/users today). GET /loyalty/scan/:token in particular MUST be public so a phone
// can hit it straight from the QR code.
import express from 'express';

// Timezone used to decide what "today" means for the one-stamp-per-day rule.
// The café operates in Mexico; override with LOYALTY_TZ if needed.
const LOYALTY_TZ = process.env.LOYALTY_TZ || 'America/Mexico_City';

// Cards look like CNK-0042. Normalise user/QR input to a canonical uppercase form.
function normalizeToken(raw) {
    return String(raw || '').trim().toUpperCase();
}

export function createLoyaltyRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    // --- GET /loyalty/scan/:token --- PUBLIC. Hit directly when scanning the QR.
    // Inactive / unknown card -> { status: 'pendiente_activacion' }.
    // Active card -> registers today's stamp (max one per day) and returns the total.
    router.get('/loyalty/scan/:token', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const token = normalizeToken(req.params.token);

            const { rows } = await pool.query('SELECT * FROM clientes WHERE token = $1', [token]);
            const cliente = rows[0];

            if (!cliente || !cliente.activo) {
                return res.json({
                    status: 'pendiente_activacion',
                    token,
                    existe: Boolean(cliente),
                    mensaje: 'Tarjeta pendiente de activación'
                });
            }

            // One stamp per client per calendar day (in LOYALTY_TZ).
            const dup = await pool.query(
                `SELECT 1 FROM sellos
                  WHERE cliente_id = $1
                    AND (fecha AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
                  LIMIT 1`,
                [cliente.id, LOYALTY_TZ]
            );

            let selloRegistrado = false;
            if (dup.rows.length === 0) {
                await pool.query('INSERT INTO sellos (cliente_id) VALUES ($1)', [cliente.id]);
                selloRegistrado = true;
                broadcastDataChange('sellos', { action: 'create', clienteId: cliente.id });
            }

            const totalRes = await pool.query(
                'SELECT COUNT(*)::int AS total FROM sellos WHERE cliente_id = $1',
                [cliente.id]
            );

            res.json({
                status: 'activo',
                token: cliente.token,
                nombre: cliente.nombre,
                totalSellos: totalRes.rows[0].total,
                selloRegistrado,
                mensaje: selloRegistrado ? '¡Sello registrado!' : 'Ya se registró un sello hoy'
            });
        } catch (error) {
            console.error('Error scanning loyalty card:', error);
            res.status(500).json({ error: 'Failed to scan loyalty card' });
        }
    });

    // --- POST /loyalty/activar/:token --- Activate a card with { nombre, telefono }.
    router.post('/loyalty/activar/:token', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const token = normalizeToken(req.params.token);
            const { nombre, telefono } = req.body || {};

            if (!nombre || !String(nombre).trim()) {
                return res.status(400).json({ error: 'El nombre es obligatorio.' });
            }

            const result = await pool.query(
                `UPDATE clientes
                    SET nombre = $1,
                        telefono = $2,
                        activo = true,
                        fecha_registro = COALESCE(fecha_registro, CURRENT_TIMESTAMP)
                  WHERE token = $3
              RETURNING id, token, nombre, telefono, activo, fecha_registro, created_at`,
                [String(nombre).trim(), telefono ? String(telefono).trim() : null, token]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Tarjeta no encontrada.' });
            }

            broadcastDataChange('clientes', { action: 'activate', token });
            res.json({ status: 'activo', cliente: result.rows[0] });
        } catch (error) {
            console.error('Error activating loyalty card:', error);
            res.status(500).json({ error: 'Failed to activate loyalty card' });
        }
    });

    // --- GET /loyalty/cliente/:token --- Full profile + stamp count (does NOT stamp).
    router.get('/loyalty/cliente/:token', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const token = normalizeToken(req.params.token);

            const { rows } = await pool.query('SELECT * FROM clientes WHERE token = $1', [token]);
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Cliente no encontrado.' });
            }
            const c = rows[0];

            const sellosRes = await pool.query(
                'SELECT id, fecha, venta_id FROM sellos WHERE cliente_id = $1 ORDER BY fecha DESC',
                [c.id]
            );

            res.json({
                id: c.id,
                token: c.token,
                nombre: c.nombre,
                telefono: c.telefono,
                activo: c.activo,
                fecha_registro: c.fecha_registro,
                created_at: c.created_at,
                totalSellos: sellosRes.rows.length,
                sellos: sellosRes.rows
            });
        } catch (error) {
            console.error('Error fetching loyalty client:', error);
            res.status(500).json({ error: 'Failed to fetch loyalty client' });
        }
    });

    // --- GET /loyalty/clientes --- Admin list of every card with its stamp totals.
    router.get('/loyalty/clientes', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { rows } = await pool.query(
                `SELECT c.id, c.token, c.nombre, c.telefono, c.activo,
                        c.fecha_registro, c.created_at,
                        COUNT(s.id)::int AS "totalSellos",
                        MAX(s.fecha)     AS "ultimoSello"
                   FROM clientes c
              LEFT JOIN sellos s ON s.cliente_id = c.id
               GROUP BY c.id
               ORDER BY c.token ASC`
            );
            res.json(rows);
        } catch (error) {
            console.error('Error listing loyalty clients:', error);
            res.status(500).json({ error: 'Failed to list loyalty clients' });
        }
    });

    // --- POST /loyalty/generar --- Generate N new inactive CNK-XXXX cards.
    router.post('/loyalty/generar', async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        const cantidad = parseInt(req.body?.cantidad, 10);
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
            return res.status(400).json({ error: 'cantidad debe ser un entero entre 1 y 1000.' });
        }

        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // Next correlative = max existing CNK-<number> + 1.
            const existing = await client.query(
                `SELECT token FROM clientes WHERE token ~ '^CNK-[0-9]+$'`
            );
            let maxN = 0;
            for (const r of existing.rows) {
                const n = parseInt(r.token.slice(4), 10);
                if (Number.isInteger(n) && n > maxN) maxN = n;
            }

            const nuevos = [];
            for (let i = 1; i <= cantidad; i++) {
                const token = `CNK-${String(maxN + i).padStart(4, '0')}`;
                const ins = await client.query(
                    'INSERT INTO clientes (token) VALUES ($1) RETURNING id, token, activo, created_at',
                    [token]
                );
                nuevos.push(ins.rows[0]);
            }

            await client.query('COMMIT');
            broadcastDataChange('clientes', { action: 'generate', count: nuevos.length });

            res.status(201).json({
                generados: nuevos.length,
                tokens: nuevos.map(n => n.token),
                clientes: nuevos
            });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error('Error generating loyalty cards:', error);
            res.status(500).json({ error: 'Failed to generate loyalty cards' });
        } finally {
            if (client) client.release();
        }
    });

    return router;
}
