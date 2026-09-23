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

// Escape untrusted text before interpolating into HTML.
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// A phone camera opening the QR lands on GET /loyalty/scan/:token and, unlike the
// operator page's fetch(), asks for text/html — so we render this self-contained
// page (same dark/neon POS theme) instead of raw JSON. `data` is the same payload
// object the JSON branch returns.
function renderScanPage(data, httpStatus) {
    const activo = data.status === 'activo';
    const total = Number(data.totalSellos || 0);
    const stamps = Array.from({ length: total },
        () => '<div class="stamp">&#9733;</div>').join('');

    let heading, sub, tone;
    if (data.error) {
        tone = 'err';  heading = 'Ups';                 sub = escapeHtml(data.error);
    } else if (!activo) {
        tone = 'warn'; heading = 'Tarjeta sin activar'; sub = 'Acércate al mostrador para activar tu tarjeta y empezar a juntar sellos.';
    } else {
        tone = 'ok';   heading = '¡Hola, ' + escapeHtml(data.nombre || '') + '!';
        sub = data.selloRegistrado ? '¡Sello registrado! 🎉' : 'Ya registraste tu visita de hoy ☕';
    }

    return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Lealtad · Conejo Negro</title>
<style>
:root{--bg:#0a0a0f;--bg2:#12121a;--card:#1a1a2e;--txt:#e0e0ff;--sub:#a0a0c0;--cyan:#00d9ff;--ok:#00ff88;--warn:#ffaa00;--err:#ff0055;}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Roboto',system-ui,sans-serif;background:linear-gradient(135deg,var(--bg),var(--bg2));color:var(--txt);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:var(--card);border:1px solid rgba(0,217,255,.18);border-radius:18px;padding:32px 24px;max-width:420px;width:100%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.brand{font-size:.8rem;letter-spacing:2px;color:var(--cyan);text-transform:uppercase;margin-bottom:20px}
.token{font-family:'Roboto Mono',monospace;color:var(--sub);font-size:.85rem;margin-bottom:18px}
h1{font-size:1.5rem;margin-bottom:8px}
.sub{color:var(--sub);font-size:1rem;margin-bottom:8px}
.sub.ok{color:var(--ok)}.sub.warn{color:var(--warn)}.sub.err{color:var(--err)}
.count{font-size:3rem;font-weight:900;line-height:1;margin:22px 0 6px;color:var(--cyan)}
.count small{font-size:1rem;color:var(--sub);font-weight:400}
.stamps{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:12px}
.stamp{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(0,217,255,.12);border:1px solid var(--cyan);color:var(--cyan);font-size:16px}
.foot{margin-top:24px;font-size:.75rem;color:var(--sub)}
</style></head><body>
<div class="card">
  <div class="brand">🐰 Conejo Negro · Lealtad</div>
  <div class="token">${escapeHtml(data.token || '')}</div>
  <h1>${heading}</h1>
  <div class="sub ${tone}">${sub}</div>
  ${activo ? `<div class="count">${total}<br><small>sello${total === 1 ? '' : 's'} acumulado${total === 1 ? '' : 's'}</small></div><div class="stamps">${stamps}</div>` : ''}
  <div class="foot">Gracias por tu visita ☕</div>
</div>
</body></html>`;
}

export function createLoyaltyRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    // --- GET /loyalty/scan/:token --- PUBLIC. Hit directly when scanning the QR.
    // Content negotiation: a phone camera (Accept: text/html) gets a rendered page;
    // the operator page's fetch() and any API caller get JSON. Force JSON with
    // ?format=json. Business logic is identical for both: inactive/unknown ->
    // pendiente_activacion (no stamp); active -> register today's stamp (max one/day).
    router.get('/loyalty/scan/:token', async (req, res) => {
        const wantsHtml = req.query.format !== 'json'
            && String(req.headers.accept || '').includes('text/html');
        const reply = (status, payload) => wantsHtml
            ? res.status(status).type('html').send(renderScanPage(payload, status))
            : res.status(status).json(payload);

        try {
            if (!useDb) return reply(503, { error: 'Base de datos no disponible' });
            const token = normalizeToken(req.params.token);

            const { rows } = await pool.query('SELECT * FROM clientes WHERE token = $1', [token]);
            const cliente = rows[0];

            if (!cliente || !cliente.activo) {
                return reply(200, {
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

            return reply(200, {
                status: 'activo',
                token: cliente.token,
                nombre: cliente.nombre,
                totalSellos: totalRes.rows[0].total,
                selloRegistrado,
                mensaje: selloRegistrado ? '¡Sello registrado!' : 'Ya se registró un sello hoy'
            });
        } catch (error) {
            console.error('Error scanning loyalty card:', error);
            return reply(500, { error: 'No se pudo registrar el escaneo. Intenta de nuevo.' });
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

    // --- DELETE /loyalty/cliente/:token --- Delete a card and (via ON DELETE
    // CASCADE on sellos.cliente_id) all its stamps.
    router.delete('/loyalty/cliente/:token', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const token = normalizeToken(req.params.token);
            const result = await pool.query(
                'DELETE FROM clientes WHERE token = $1 RETURNING token',
                [token]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Tarjeta no encontrada.' });
            }
            broadcastDataChange('clientes', { action: 'delete', token });
            res.json({ deleted: token });
        } catch (error) {
            console.error('Error deleting loyalty card:', error);
            res.status(500).json({ error: 'Failed to delete loyalty card' });
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
