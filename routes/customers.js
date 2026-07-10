// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createCustomersRouter({ pool, useDb, broadcastDataChange }) {
    const router = express.Router();

    // --- CUSTOMERS ENDPOINTS ---
    router.get('/api/customers', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });

            // 🚀 PAGINATION: Add pagination to prevent fetching all customers
            const limit = parseInt(req.query.limit) || 200; // Customers might be few
            const offset = parseInt(req.query.offset) || 0;

            const result = await pool.query(
                'SELECT * FROM customers ORDER BY name ASC LIMIT $1 OFFSET $2',
                [limit, offset]
            );
            res.json(result.rows.map(c => ({
                ...c,
                discountPercentage: parseFloat(c.discountPercentage),
                creditLimit: parseFloat(c.creditLimit),
                currentCredit: parseFloat(c.currentCredit),
                createdAt: c.created_at
            })));
        } catch (error) {
            console.error("Error fetching customers:", error);
            res.status(500).json({ error: 'Failed to fetch customers' });
        }
    });

    router.post('/api/customers', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { name, email, phone, discountPercentage, creditLimit } = req.body;
            const id = `cust-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO customers (id, name, email, phone, "discountPercentage", "creditLimit") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [id, name, email || null, phone || null, discountPercentage || 0, creditLimit || 0]
            );
            const customer = result.rows[0];
            broadcastDataChange('customers', { action: 'create', id: customer.id });
            res.status(201).json({
                ...customer,
                discountPercentage: parseFloat(customer.discountPercentage),
                creditLimit: parseFloat(customer.creditLimit),
                currentCredit: parseFloat(customer.currentCredit),
                createdAt: customer.created_at
            });
        } catch (error) {
            console.error("Error creating customer:", error);
            res.status(500).json({ error: 'Failed to create customer' });
        }
    });

    router.put('/api/customers/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { name, email, phone, discountPercentage, creditLimit } = req.body;
            const result = await pool.query(
                'UPDATE customers SET name = $1, email = $2, phone = $3, "discountPercentage" = $4, "creditLimit" = $5 WHERE id = $6 RETURNING *',
                [name, email || null, phone || null, discountPercentage, creditLimit, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }
            const customer = result.rows[0];
            broadcastDataChange('customers', { action: 'update', id: req.params.id });
            res.json({
                ...customer,
                discountPercentage: parseFloat(customer.discountPercentage),
                creditLimit: parseFloat(customer.creditLimit),
                currentCredit: parseFloat(customer.currentCredit),
                createdAt: customer.created_at
            });
        } catch (error) {
            console.error("Error updating customer:", error);
            res.status(500).json({ error: 'Failed to update customer' });
        }
    });

    router.delete('/api/customers/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
            broadcastDataChange('customers', { action: 'delete', id: req.params.id });
            res.status(204).send();
        } catch (error) {
            console.error("Error deleting customer:", error);
            res.status(500).json({ error: 'Failed to delete customer' });
        }
    });

    // --- CUSTOMER CREDITS ENDPOINTS ---
    router.get('/api/customers/:id/credits', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });

            // Get credits with order details if available
            const result = await pool.query(
                `SELECT cc.*, o.items as order_items, o.discount as order_discount, c.name as customer_name, c."discountPercentage" as customer_discount
                 FROM customer_credits cc
                 LEFT JOIN orders o ON cc."orderId" = o.id
                 LEFT JOIN customers c ON cc."customerId" = c.id
                 WHERE cc."customerId" = $1
                 ORDER BY cc.created_at DESC`,
                [req.params.id]
            );

            res.json(result.rows.map(c => {
                // Parse order items to create a summary
                let orderSummary = null;
                if (c.order_items) {
                    try {
                        const items = typeof c.order_items === 'string' ? JSON.parse(c.order_items) : c.order_items;
                        orderSummary = items.map(item => `${item.quantity}x ${item.name}`).join(', ');
                    } catch (e) {
                        orderSummary = null;
                    }
                }

                return {
                    ...c,
                    amount: parseFloat(c.amount),
                    customerId: c.customerId,
                    orderId: c.orderId,
                    createdAt: c.created_at,
                    orderSummary: orderSummary,
                    orderDiscount: c.order_discount ? parseFloat(c.order_discount) : null,
                    customerName: c.customer_name,
                    customerDiscount: c.customer_discount ? parseFloat(c.customer_discount) : null
                };
            }));
        } catch (error) {
            console.error("Error fetching customer credits:", error);
            res.status(500).json({ error: 'Failed to fetch customer credits' });
        }
    });

    router.post('/api/customers/:id/credits', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { amount, type, description, orderId } = req.body;
            const creditId = `credit-${Date.now()}`;
            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Insert credit record
                const creditResult = await client.query(
                    'INSERT INTO customer_credits (id, "customerId", "orderId", amount, type, description, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [creditId, req.params.id, orderId || null, amount, type, description || null, type === 'charge' ? 'pending' : 'paid']
                );

                // Update customer's current credit
                if (type === 'charge') {
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" + $1 WHERE id = $2',
                        [amount, req.params.id]
                    );
                } else if (type === 'payment') {
                    await client.query(
                        'UPDATE customers SET "currentCredit" = "currentCredit" - $1 WHERE id = $2',
                        [amount, req.params.id]
                    );
                }

                await client.query('COMMIT');

                const credit = creditResult.rows[0];
                broadcastDataChange('customers', { action: 'update', id: req.params.id });
                res.status(201).json({
                    ...credit,
                    amount: parseFloat(credit.amount),
                    customerId: credit.customerId,
                    orderId: credit.orderId,
                    createdAt: credit.created_at
                });
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("Error creating customer credit:", error);
            res.status(500).json({ error: 'Failed to create customer credit' });
        }
    });

    router.put('/api/customer-credits/:id', async (req, res) => {
        try {
            if (!useDb) return res.status(503).json({ error: 'Database not available' });
            const { status } = req.body;
            const result = await pool.query(
                'UPDATE customer_credits SET status = $1 WHERE id = $2 RETURNING *',
                [status, req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Credit record not found' });
            }
            const credit = result.rows[0];
            res.json({
                ...credit,
                amount: parseFloat(credit.amount),
                customerId: credit.customerId,
                orderId: credit.orderId,
                createdAt: credit.created_at
            });
        } catch (error) {
            console.error("Error updating customer credit:", error);
            res.status(500).json({ error: 'Failed to update customer credit' });
        }
    });

    return router;
}
