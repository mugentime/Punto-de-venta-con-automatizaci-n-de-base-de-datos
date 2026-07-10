// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createOrdersRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    router.get('/api/orders', async (req, res) => {
        try {
            if (!useDb) return res.json([]);

            // 🚀 PAGINATION: Add pagination to prevent fetching all orders
            const limit  = Math.min(Math.max(parseInt(req.query.limit,  10) || 100, 1), 500); // cap 1–500
            const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

            const result = await pool.query(
                'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
                [limit, offset]
            );

            res.json(result.rows.map(order => ({
                ...order,
                subtotal: parseFloat(order.subtotal),
                discount: parseFloat(order.discount || 0),
                tip: parseFloat(order.tip || 0),
                total: parseFloat(order.total),
                date: order.created_at,  // Map created_at to date for frontend compatibility
                totalCost: order.items ? order.items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
            })));
        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    });

    // FIX BUG 3: Store for idempotency checking (in-memory cache for recent orders)
    const recentOrderKeys = new Map(); // Map<idempotencyKey, orderId>
    const ORDER_KEY_TTL = 60000; // 1 minute TTL for idempotency keys

    router.post('/api/orders', async (req, res) => {
        try {
            const { clientName, serviceType, paymentMethod, items, subtotal, discount, tip, total, userId, customerId, idempotencyKey } = req.body;

            console.log('📦 Creating order:', { clientName, serviceType, paymentMethod, subtotal, discount: discount || 0, tip: tip || 0, total, userId, customerId, itemsCount: items?.length, idempotencyKey });

            // 🧪 IN-MEMORY MODE: Store orders in memory
            if (!useDb) {
                const id = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const newOrder = {
                    id,
                    clientName,
                    serviceType,
                    paymentMethod,
                    items,
                    subtotal,
                    discount: discount || 0,
                    tip: tip || 0,
                    total,
                    userId,
                    customerId: customerId || null,
                    created_at: new Date().toISOString(),
                    date: new Date().toISOString(),
                    totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
                };
                console.log('✅ Order created in memory:', id);
                return res.status(201).json(newOrder);
            }

            // FIX BUG 3: Check idempotency key to prevent duplicate submissions
            if (idempotencyKey && recentOrderKeys.has(idempotencyKey)) {
                const existingOrderId = recentOrderKeys.get(idempotencyKey);
                console.log('⚠️ Duplicate order attempt detected via idempotency key:', idempotencyKey);

                // Return existing order
                const client = await pool.connect();
                try {
                    const result = await client.query('SELECT * FROM orders WHERE id = $1', [existingOrderId]);
                    if (result.rows.length > 0) {
                        const existingOrder = result.rows[0];
                        return res.status(200).json({
                            ...existingOrder,
                            subtotal: parseFloat(existingOrder.subtotal),
                            total: parseFloat(existingOrder.total),
                            date: existingOrder.created_at,
                            customerId: existingOrder.customerId,
                            totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0,
                            isDuplicate: true
                        });
                    }
                } finally {
                    client.release();
                }
            }

            const id = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Ensure customerId is properly null if not provided
                const cleanCustomerId = customerId && customerId !== '' ? customerId : null;

                console.log('💾 Inserting order into database...', { id, cleanCustomerId });

                // Insert order with discount and tip
                const result = await client.query(
                    'INSERT INTO orders (id, "clientName", "serviceType", "paymentMethod", items, subtotal, discount, tip, total, "userId", "customerId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
                    [id, clientName, serviceType, paymentMethod, JSON.stringify(items), subtotal, discount || 0, tip || 0, total, userId, cleanCustomerId]
                );
                const newOrder = result.rows[0];
                console.log('✅ Order inserted successfully:', newOrder.id, { discount: discount || 0, tip: tip || 0 });

                // FIX BUG 3: Store idempotency key
                if (idempotencyKey) {
                    // Guard against unbounded growth under heavy traffic
                    if (recentOrderKeys.size >= 2000) {
                        // Evict all expired entries before adding a new one
                        const nowMs = Date.now();
                        for (const [k] of recentOrderKeys) {
                            // TTL eviction is handled by setTimeout; do a full clear as a safety net
                            if (recentOrderKeys.size >= 2000) recentOrderKeys.delete(k);
                            else break;
                        }
                    }
                    recentOrderKeys.set(idempotencyKey, id);
                    setTimeout(() => recentOrderKeys.delete(idempotencyKey), ORDER_KEY_TTL);
                }

                // If it's a credit payment and customer exists, create credit record
                if (cleanCustomerId && (paymentMethod === 'Crédito' || paymentMethod === 'Fiado')) {
                    console.log('💳 Creating customer credit record...');
                    await client.query(
                        'INSERT INTO customer_credits (id, "customerId", "orderId", amount, type, status, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [`credit-${Date.now()}`, cleanCustomerId, id, total, 'charge', 'pending', `Orden #${id}`]
                    );
                    // Update customer's current credit
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" + $1 WHERE id = $2',
                        [total, cleanCustomerId]
                    );
                    console.log('✅ Customer credit updated');
                }

                await client.query('COMMIT');
                console.log('✅ Transaction committed successfully');

                res.status(201).json({
                    ...newOrder,
                    subtotal: parseFloat(newOrder.subtotal),
                    discount: parseFloat(newOrder.discount || 0),
                    tip: parseFloat(newOrder.tip || 0),
                    total: parseFloat(newOrder.total),
                    date: newOrder.created_at,
                    customerId: newOrder.customerId,
                    totalCost: items ? items.reduce((acc, item) => acc + (item.cost * item.quantity), 0) : 0
                });
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('❌ Database transaction error:', error.message, error.stack);
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("❌ Error creating order:", error.message);
            console.error("Stack trace:", error.stack);
            res.status(500).json({
                error: 'Failed to create order',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    router.delete('/api/orders/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });

            console.log('🗑️  Deleting order:', req.params.id);

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // First, check if order has associated customer credit and remove it
                const creditCheck = await client.query(
                    'SELECT * FROM customer_credits WHERE "orderId" = $1',
                    [req.params.id]
                );

                if (creditCheck.rows.length > 0) {
                    const credit = creditCheck.rows[0];
                    console.log('💳 Reversing customer credit for order...');

                    // Reverse the credit from customer's balance
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" - $1 WHERE id = $2',
                        [credit.amount, credit.customerId]
                    );

                    // Delete the credit record
                    await client.query('DELETE FROM customer_credits WHERE "orderId" = $1', [req.params.id]);
                }

                // Delete the order
                const result = await client.query('DELETE FROM orders WHERE id = $1 RETURNING *', [req.params.id]);

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({ error: 'Order not found' });
                }

                await client.query('COMMIT');
                console.log('✅ Order deleted successfully:', req.params.id);

                broadcastDataChange('orders', { action: 'delete', id: req.params.id });
                res.status(204).send();
            } catch (error) {
                await client.query('ROLLBACK');
                console.error('❌ Database transaction error:', error.message);
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("❌ Error deleting order:", error.message);
            res.status(500).json({ error: 'Failed to delete order' });
        }
    });

    // 🧹 Cleanup duplicate orders from database
    router.post('/api/orders/cleanup-duplicates', async (req, res) => {
        if (!useDb) {
            return res.status(500).json({ error: 'Database mode only' });
        }

        try {
            const client = await pool.connect();

            // Find duplicates (same clientName, total, timestamp within same second)
            const findQuery = `
                WITH duplicates AS (
                    SELECT
                        id,
                        client_name,
                        total,
                        created_at,
                        ROW_NUMBER() OVER (
                            PARTITION BY client_name, total, FLOOR(EXTRACT(EPOCH FROM created_at))
                            ORDER BY id ASC
                        ) as row_num
                    FROM orders
                )
                SELECT id, client_name, total, created_at
                FROM duplicates
                WHERE row_num > 1
                ORDER BY created_at DESC;
            `;

            const duplicates = await client.query(findQuery);
            console.log(`📊 Found ${duplicates.rows.length} duplicate orders`);

            if (duplicates.rows.length === 0) {
                client.release();
                return res.json({ message: 'No duplicates found', deleted: 0 });
            }

            // Delete duplicates (keep first occurrence by smallest ID)
            const deleteQuery = `
                WITH duplicates AS (
                    SELECT
                        id,
                        ROW_NUMBER() OVER (
                            PARTITION BY client_name, total, FLOOR(EXTRACT(EPOCH FROM created_at))
                            ORDER BY id ASC
                        ) as row_num
                    FROM orders
                )
                DELETE FROM orders
                WHERE id IN (
                    SELECT id FROM duplicates WHERE row_num > 1
                )
                RETURNING id, client_name, total, created_at;
            `;

            const deleteResult = await client.query(deleteQuery);
            console.log(`✅ Deleted ${deleteResult.rows.length} duplicate orders`);

            client.release();
            res.json({
                message: `Successfully deleted ${deleteResult.rows.length} duplicate orders`,
                deleted: deleteResult.rows.length,
                duplicates: deleteResult.rows
            });
        } catch (err) {
            console.error('❌ Error cleaning up duplicates:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
}
