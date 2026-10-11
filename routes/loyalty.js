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

// Protección sencilla del panel de cajero: clave compartida en el header
// X-Loyalty-Key (o ?key=) que debe coincidir con la variable LOYALTY_KEY.
//   * Si LOYALTY_KEY NO está configurada -> NO bloquea (fail-open), para no romper
//     un POS en producción; avisa una vez en consola. Define LOYALTY_KEY para activar.
//   * Si está configurada -> exige la clave; responde 401 si falta o es incorrecta.
// GET /loyalty/scan/:token queda SIEMPRE público (lo abre el teléfono desde el QR).
let _avisoSinClave = false;
function requireLoyaltyKey(req, res, next) {
    const key = process.env.LOYALTY_KEY;
    if (!key) {
        if (!_avisoSinClave) {
            console.warn('⚠️  LOYALTY_KEY no configurada — panel de lealtad SIN protección. '
                + 'Define LOYALTY_KEY en el entorno (Railway) para activarla.');
            _avisoSinClave = true;
        }
        return next();
    }
    const provided = req.headers['x-loyalty-key'] || req.query.key;
    if (!provided || provided !== key) {
        return res.status(401).json({ error: 'Clave de cajero requerida o incorrecta.' });
    }
    next();
}

// Cuenta corriente de la tarjeta. `saldo` es un número neto:
//   saldo < 0  -> el cliente DEBE (deuda)
//   saldo > 0  -> tiene SALDO A FAVOR
// En la práctica nunca se tienen ambos a la vez (se netean solos).
function desglosarCuenta(saldo) {
    const s = Math.round((Number(saldo) || 0) * 100) / 100;
    return { saldo: s, deuda: s < 0 ? -s : 0, saldoAFavor: s > 0 ? s : 0 };
}

// Tipos de movimiento de cobro y su efecto (signo) sobre el saldo.
//   cargo_credito  : consumo a crédito        -> sube la deuda  (−)
//   consumo_pagado : consumo pagado al momento -> no toca la cuenta (0), solo deja registro
//   uso_saldo      : consumo cubierto con saldo a favor -> baja el saldo a favor (−)
//   pago           : pago/abono del cliente    -> baja la deuda / sube el saldo (+)
const TIPOS_MOVIMIENTO = {
    cargo_credito:  -1,
    consumo_pagado:  0,
    uso_saldo:      -1,
    pago:           +1,
};

// Normaliza un % de descuento a un número 0..100 (o 0 si viene basura).
function normalizarDescuento(raw) {
    let d = Number(raw);
    if (!Number.isFinite(d) || d < 0) d = 0;
    if (d > 100) d = 100;
    return Math.round(d * 100) / 100;
}

// Escape untrusted text before interpolating into HTML.
function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Format a number as pesos for the customer-facing dashboard.
const fmtMoney = (n) => '$' + (Number(n) || 0).toFixed(2);

// Lealtad: cada 5 visitas (sellos) el cliente gana una bebida gratis.
const SELLOS_POR_CAFE = 5;

// Estado del premio a partir del total de sellos (monótono, nunca baja) y de las
// bebidas ya canjeadas. Append-only igual que `sellos`: las bebidas ganadas son
// floor(sellos / SELLOS_POR_CAFE) y las disponibles son las ganadas menos las
// canjeadas, así una bebida ganada NO se pierde al seguir acumulando sellos.
//   ganados     = bebidas gratis ganadas en total
//   canjeados   = bebidas gratis ya entregadas
//   disponibles = bebidas gratis sin canjear (lo que el cajero puede dar hoy)
//   enCiclo     = sellos del ciclo actual (0..SELLOS_POR_CAFE-1)
//   faltan      = sellos que faltan para la PRÓXIMA bebida gratis
function estadoRecompensa(totalSellos, canjeados) {
    const total = Math.max(0, Number(totalSellos) || 0);
    const usados = Math.max(0, Number(canjeados) || 0);
    const ganados = Math.floor(total / SELLOS_POR_CAFE);
    const disponibles = Math.max(0, ganados - usados);
    const enCiclo = total % SELLOS_POR_CAFE;
    const faltan = enCiclo === 0 ? SELLOS_POR_CAFE : SELLOS_POR_CAFE - enCiclo;
    return { porCiclo: SELLOS_POR_CAFE, ganados, canjeados: usados, disponibles, enCiclo, faltan };
}

// A phone camera opening the QR lands on GET /loyalty/scan/:token and, unlike the
// operator page's fetch(), asks for text/html — so we render this self-contained
// page (same dark/neon POS theme) instead of raw JSON. `data` is the same payload
// object the JSON branch returns.
function renderScanPage(data, httpStatus) {
    const activo = data.status === 'activo';
    const total = Number(data.totalSellos || 0);

    // La disponibilidad del premio la decide `disponibles` (ganados − canjeados), no
    // `total % 5`: así una bebida ganada sigue disponible aunque el cliente siga
    // acumulando sellos, hasta que el cajero la canjee.
    const enCiclo = Number.isFinite(data.enCiclo) ? data.enCiclo : (total % SELLOS_POR_CAFE);
    const disponibles = Number(data.disponibles || 0);
    const faltan = Number.isFinite(data.faltan)
        ? data.faltan
        : (enCiclo === 0 ? SELLOS_POR_CAFE : SELLOS_POR_CAFE - enCiclo);
    const cafeListo = disponibles > 0;
    // Ciclo recién completado y sin canjear -> anillo lleno; si no, progreso del ciclo.
    const llenos = (cafeListo && enCiclo === 0) ? SELLOS_POR_CAFE : enCiclo;
    const slots = Array.from({ length: SELLOS_POR_CAFE }, (_, i) =>
        '<div class="slot' + (i < llenos ? ' on' : '') + '">' + (i < llenos ? '&#9733;' : '&#9734;') + '</div>'
    ).join('');
    const freeMsg = cafeListo
        ? ('🎉 ¡Tienes ' + (disponibles === 1 ? 'una bebida gratis' : disponibles + ' bebidas gratis')
            + ' disponible' + (disponibles === 1 ? '' : 's') + '!')
        : ('Te falta' + (faltan === 1 ? '' : 'n') + ' ' + faltan + ' visita' + (faltan === 1 ? '' : 's') + ' para tu bebida gratis');

    const deuda = Number(data.deuda || 0);
    const saldoAFavor = Number(data.saldoAFavor || 0);

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
.logo-badge{width:92px;height:92px;margin:0 auto 16px;background:#fff;border-radius:22px;display:flex;align-items:center;justify-content:center;padding:10px;box-shadow:0 6px 20px rgba(0,0,0,.35)}
.logo-badge img{width:100%;height:100%;object-fit:contain;display:block}
.brand{font-size:.8rem;letter-spacing:2px;color:var(--cyan);text-transform:uppercase;margin-bottom:18px}
.token{font-family:'Roboto Mono',monospace;color:var(--sub);font-size:.85rem;margin-bottom:18px}
h1{font-size:1.5rem;margin-bottom:8px}
.sub{color:var(--sub);font-size:1rem;margin-bottom:8px}
.sub.ok{color:var(--ok)}.sub.warn{color:var(--warn)}.sub.err{color:var(--err)}
.count{font-size:3rem;font-weight:900;line-height:1;margin:22px 0 6px;color:var(--cyan)}
.count small{font-size:1rem;color:var(--sub);font-weight:400}
.metrics{display:flex;gap:12px;margin:22px 0 4px}
.metric{flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(0,217,255,.14);border-radius:14px;padding:12px 10px}
.metric .ml{font-size:.66rem;letter-spacing:.5px;text-transform:uppercase;color:var(--sub)}
.metric .mv{font-size:1.25rem;font-weight:800;margin-top:4px}
.metric .mv.ok{color:var(--ok)}.metric .mv.err{color:var(--err)}
.metric .mv.zero{color:var(--sub)}
.progress{margin-top:24px}
.free{font-size:.98rem;font-weight:700;color:var(--cyan);margin-bottom:12px}
.free.ready{color:var(--ok)}
.slots{display:flex;gap:10px;justify-content:center}
.slot{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;border:1px solid var(--cyan);background:rgba(0,217,255,.08);color:var(--sub)}
.slot.on{background:var(--cyan);color:#06202a;border-color:var(--cyan)}
.foot{margin-top:24px;font-size:.75rem;color:var(--sub)}
</style></head><body>
<div class="card">
  <div class="logo-badge"><img src="/logos/Conejo%20negro%20logo%20NEGATIVO.svg" alt="Conejo Negro" onerror="this.closest('.logo-badge').style.display='none'"></div>
  <div class="brand">Conejo Negro · Lealtad</div>
  <div class="token">${escapeHtml(data.token || '')}</div>
  <h1>${heading}</h1>
  <div class="sub ${tone}">${sub}</div>
  ${activo ? `
  <div class="count">${total}<br><small>sello${total === 1 ? '' : 's'} en total</small></div>
  <div class="metrics">
    <div class="metric"><div class="ml">Saldo a favor</div><div class="mv ${saldoAFavor > 0 ? 'ok' : 'zero'}">${fmtMoney(saldoAFavor)}</div></div>
    <div class="metric"><div class="ml">Deuda</div><div class="mv ${deuda > 0 ? 'err' : 'zero'}">${fmtMoney(deuda)}</div></div>
  </div>
  <div class="progress">
    <div class="free ${cafeListo ? 'ready' : ''}">${freeMsg}</div>
    <div class="slots">${slots}</div>
  </div>` : ''}
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
            const canjeRes = await pool.query(
                'SELECT COUNT(*)::int AS total FROM loyalty_canjes WHERE cliente_id = $1',
                [cliente.id]
            );
            const recompensa = estadoRecompensa(totalRes.rows[0].total, canjeRes.rows[0].total);

            return reply(200, {
                status: 'activo',
                token: cliente.token,
                nombre: cliente.nombre,
                totalSellos: totalRes.rows[0].total,
                selloRegistrado,
                mensaje: selloRegistrado ? '¡Sello registrado!' : 'Ya se registró un sello hoy',
                ...desglosarCuenta(cliente.saldo),
                ...recompensa
            });
        } catch (error) {
            console.error('Error scanning loyalty card:', error);
            return reply(500, { error: 'No se pudo registrar el escaneo. Intenta de nuevo.' });
        }
    });

    // --- POST /loyalty/activar/:token --- Alta/activación de la tarjeta con
    // { nombre (o pseudónimo), telefono?, descuento?, nota? }.
    router.post('/loyalty/activar/:token', requireLoyaltyKey, async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const token = normalizeToken(req.params.token);
            const { nombre, telefono, descuento, nota } = req.body || {};

            if (!nombre || !String(nombre).trim()) {
                return res.status(400).json({ error: 'El nombre es obligatorio.' });
            }

            const result = await pool.query(
                `UPDATE clientes
                    SET nombre = $1,
                        telefono = $2,
                        descuento = $3,
                        nota = $4,
                        activo = true,
                        fecha_registro = COALESCE(fecha_registro, CURRENT_TIMESTAMP)
                  WHERE token = $5
              RETURNING id, token, nombre, telefono, descuento, nota, activo, saldo, fecha_registro, created_at`,
                [
                    String(nombre).trim(),
                    telefono ? String(telefono).trim() : null,
                    normalizarDescuento(descuento),
                    nota ? String(nota).trim() : null,
                    token
                ]
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

    // --- PUT /loyalty/cliente/:token --- Editar datos del cliente (nombre,
    // teléfono, descuento, nota) SIN tocar saldo ni sellos. Para corregir el
    // descuento o la nota después del alta.
    router.put('/loyalty/cliente/:token', requireLoyaltyKey, async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const token = normalizeToken(req.params.token);
            const { nombre, telefono, descuento, nota } = req.body || {};

            if (!nombre || !String(nombre).trim()) {
                return res.status(400).json({ error: 'El nombre es obligatorio.' });
            }

            const result = await pool.query(
                `UPDATE clientes
                    SET nombre = $1, telefono = $2, descuento = $3, nota = $4
                  WHERE token = $5
              RETURNING id, token, nombre, telefono, descuento, nota, activo, saldo`,
                [
                    String(nombre).trim(),
                    telefono ? String(telefono).trim() : null,
                    normalizarDescuento(descuento),
                    nota ? String(nota).trim() : null,
                    token
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Tarjeta no encontrada.' });
            }

            broadcastDataChange('clientes', { action: 'update', token });
            res.json({ cliente: result.rows[0] });
        } catch (error) {
            console.error('Error updating loyalty client:', error);
            res.status(500).json({ error: 'Failed to update loyalty client' });
        }
    });

    // --- POST /loyalty/cliente/:token/cobro --- Registra un movimiento de cuenta:
    // body { tipo, monto, descripcion? }. Actualiza `saldo` transaccionalmente y
    // deja un renglón en loyalty_movimientos. El signo/efecto lo decide el servidor
    // según el tipo (no se confía en el cliente).
    router.post('/loyalty/cliente/:token/cobro', requireLoyaltyKey, async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        const token = normalizeToken(req.params.token);
        const tipo = String(req.body?.tipo || '');
        const monto = Math.round(Number(req.body?.monto) * 100) / 100;
        const descripcion = req.body?.descripcion ? String(req.body.descripcion).trim().slice(0, 500) : null;

        if (!(tipo in TIPOS_MOVIMIENTO)) {
            return res.status(400).json({ error: 'Tipo de movimiento inválido.' });
        }
        if (!Number.isFinite(monto) || monto <= 0) {
            return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
        }

        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');

            // Bloquea la fila del cliente para que dos cobros simultáneos no pisen el saldo.
            const { rows } = await client.query('SELECT * FROM clientes WHERE token = $1 FOR UPDATE', [token]);
            const c = rows[0];
            if (!c) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Cliente no encontrado.' });
            }
            if (!c.activo) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'La tarjeta no está activada.' });
            }

            const saldoActual = Number(c.saldo) || 0;
            const delta = Math.round(TIPOS_MOVIMIENTO[tipo] * monto * 100) / 100;

            // Guardia: "usar saldo a favor" no puede exceder el saldo a favor disponible
            // (si no, estaría generando deuda, que no es lo que quiere esa acción).
            if (tipo === 'uso_saldo' && monto > Math.max(saldoActual, 0) + 1e-9) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Saldo a favor insuficiente.' });
            }

            const saldoPost = Math.round((saldoActual + delta) * 100) / 100;

            await client.query('UPDATE clientes SET saldo = $1 WHERE id = $2', [saldoPost, c.id]);
            const movRes = await client.query(
                `INSERT INTO loyalty_movimientos (cliente_id, tipo, monto, delta, saldo_post, descripcion)
                 VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, tipo, monto, delta, saldo_post, descripcion, fecha`,
                [c.id, tipo, monto, delta, saldoPost, descripcion]
            );

            await client.query('COMMIT');
            broadcastDataChange('clientes', { action: 'cobro', token, tipo });

            res.status(201).json({
                movimiento: movRes.rows[0],
                ...desglosarCuenta(saldoPost)
            });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error('Error registrando cobro de lealtad:', error);
            res.status(500).json({ error: 'No se pudo registrar el cobro.' });
        } finally {
            if (client) client.release();
        }
    });

    // --- POST /loyalty/cliente/:token/canjear --- Canjea UNA bebida gratis.
    // Append-only: inserta un renglón en loyalty_canjes. Transaccional y con bloqueo
    // de la fila del cliente para que dos canjes simultáneos no entreguen la misma
    // bebida dos veces: el total de ganados/canjeados se recalcula DENTRO de la
    // transacción y se exige disponibles > 0.
    router.post('/loyalty/cliente/:token/canjear', requireLoyaltyKey, async (req, res) => {
        if (!useDb) return res.status(503).json({ error: 'Database not available' });

        const token = normalizeToken(req.params.token);
        const descripcion = req.body?.descripcion ? String(req.body.descripcion).trim().slice(0, 500) : null;

        let client;
        try {
            client = await pool.connect();
            await client.query('BEGIN');

            const { rows } = await client.query('SELECT * FROM clientes WHERE token = $1 FOR UPDATE', [token]);
            const c = rows[0];
            if (!c) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Cliente no encontrado.' });
            }
            if (!c.activo) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'La tarjeta no está activada.' });
            }

            const sellosRes = await client.query(
                'SELECT COUNT(*)::int AS total FROM sellos WHERE cliente_id = $1', [c.id]
            );
            const canjeRes = await client.query(
                'SELECT COUNT(*)::int AS total FROM loyalty_canjes WHERE cliente_id = $1', [c.id]
            );
            const totalSellos = sellosRes.rows[0].total;
            const estado = estadoRecompensa(totalSellos, canjeRes.rows[0].total);

            if (estado.disponibles <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: 'El cliente no tiene bebidas gratis disponibles.',
                    totalSellos,
                    ...estado
                });
            }

            const ins = await client.query(
                'INSERT INTO loyalty_canjes (cliente_id, descripcion) VALUES ($1, $2) RETURNING id, fecha, descripcion',
                [c.id, descripcion]
            );

            await client.query('COMMIT');
            broadcastDataChange('clientes', { action: 'canje', token });

            res.status(201).json({
                canje: ins.rows[0],
                totalSellos,
                ...estadoRecompensa(totalSellos, canjeRes.rows[0].total + 1)
            });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error('Error canjeando bebida gratis:', error);
            res.status(500).json({ error: 'No se pudo canjear la bebida gratis.' });
        } finally {
            if (client) client.release();
        }
    });

    // --- GET /loyalty/cliente/:token --- Full profile + stamp count (does NOT stamp).
    router.get('/loyalty/cliente/:token', requireLoyaltyKey, async (req, res) => {
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

            const movRes = await pool.query(
                `SELECT id, tipo, monto, delta, saldo_post, descripcion, fecha
                   FROM loyalty_movimientos
                  WHERE cliente_id = $1
               ORDER BY fecha DESC, id DESC
                  LIMIT 30`,
                [c.id]
            );

            const canjeRes = await pool.query(
                'SELECT COUNT(*)::int AS total FROM loyalty_canjes WHERE cliente_id = $1',
                [c.id]
            );
            const recompensa = estadoRecompensa(sellosRes.rows.length, canjeRes.rows[0].total);

            res.json({
                id: c.id,
                token: c.token,
                nombre: c.nombre,
                telefono: c.telefono,
                descuento: Number(c.descuento) || 0,
                nota: c.nota,
                activo: c.activo,
                fecha_registro: c.fecha_registro,
                created_at: c.created_at,
                totalSellos: sellosRes.rows.length,
                sellos: sellosRes.rows,
                ...desglosarCuenta(c.saldo),
                ...recompensa,
                movimientos: movRes.rows
            });
        } catch (error) {
            console.error('Error fetching loyalty client:', error);
            res.status(500).json({ error: 'Failed to fetch loyalty client' });
        }
    });

    // --- DELETE /loyalty/cliente/:token --- Delete a card and (via ON DELETE
    // CASCADE on sellos.cliente_id) all its stamps.
    router.delete('/loyalty/cliente/:token', requireLoyaltyKey, async (req, res) => {
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
    router.get('/loyalty/clientes', requireLoyaltyKey, async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { rows } = await pool.query(
                `SELECT c.id, c.token, c.nombre, c.telefono, c.activo,
                        c.descuento, c.nota, c.saldo,
                        c.fecha_registro, c.created_at,
                        COUNT(s.id)::int AS "totalSellos",
                        MAX(s.fecha)     AS "ultimoSello",
                        (SELECT COUNT(*) FROM loyalty_canjes k WHERE k.cliente_id = c.id)::int AS "canjeados"
                   FROM clientes c
              LEFT JOIN sellos s ON s.cliente_id = c.id
               GROUP BY c.id
               ORDER BY c.token ASC`
            );
            res.json(rows.map(r => ({
                ...r,
                descuento: Number(r.descuento) || 0,
                ...desglosarCuenta(r.saldo),
                ...estadoRecompensa(r.totalSellos, r.canjeados)
            })));
        } catch (error) {
            console.error('Error listing loyalty clients:', error);
            res.status(500).json({ error: 'Failed to list loyalty clients' });
        }
    });

    // --- POST /loyalty/generar --- Generate N new inactive CNK-XXXX cards.
    router.post('/loyalty/generar', requireLoyaltyKey, async (req, res) => {
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
