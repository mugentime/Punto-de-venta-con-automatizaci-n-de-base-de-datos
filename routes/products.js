// Moved out of server.js verbatim (Phase 2 of the architecture cleanup).
import express from 'express';

export function createProductsRouter({ productStore, pool, useDb }) {
    const router = express.Router();

    router.get('/api/products', async (req, res) => {
        try {
            const products = await productStore.getAll();
            res.json(products);
        } catch (error) {
            console.error("Error fetching products:", error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    });

    router.post('/api/products', async (req, res) => {
        try {
            const newProduct = await productStore.create(req.body);
            res.status(201).json(newProduct);
        } catch (error) {
            console.error("Error creating product:", error);
            res.status(500).json({ error: 'Failed to create product' });
        }
    });

    router.put('/api/products/:id', async (req, res) => {
        try {
            const updatedProduct = await productStore.update(req.params.id, req.body);
            if (updatedProduct) {
                res.json(updatedProduct);
            } else {
                res.status(404).json({ error: 'Product not found' });
            }
        } catch (error) {
            console.error(`Error updating product ${req.params.id}:`, error);
            res.status(500).json({ error: 'Failed to update product' });
        }
    });

    router.delete('/api/products/:id', async (req, res) => {
        try {
            await productStore.delete(req.params.id);
            res.status(204).send();
        } catch (error) {
            console.error(`Error deleting product ${req.params.id}:`, error);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    });

    router.post('/api/products/import', async (req, res) => {
        try {
            const fullProductList = await productStore.importBatch(req.body);
            res.status(200).json(fullProductList);
        } catch (error) {
            console.error("Error importing products:", error);
            res.status(500).json({ error: 'Failed to import products' });
        }
    });

    // ADMIN: Increase all prices by 25% to reach break-even point
    router.post('/api/products/increase-prices', async (req, res) => {
        try {
            if (!useDb) {
                return res.status(400).json({ error: 'Database not connected' });
            }

            const { percentage = 25 } = req.body;
            const multiplier = 1 + (percentage / 100);

            console.log(`📈 Increasing all product prices by ${percentage}%...`);

            // Get current prices
            const beforeResult = await pool.query(`
                SELECT id, name, category, price
                FROM products
                ORDER BY category, name
            `);

            // Update prices - FLOOR to round down, no decimals
            const updateResult = await pool.query(`
                UPDATE products
                SET
                    price = FLOOR(price * $1),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, name, category, price
            `, [multiplier]);

            // Get summary
            const summaryResult = await pool.query(`
                SELECT
                    COUNT(*) AS total_products,
                    ROUND(AVG(price), 2) AS avg_price,
                    ROUND(MIN(price), 2) AS min_price,
                    ROUND(MAX(price), 2) AS max_price
                FROM products
            `);

            console.log(`✅ Updated ${updateResult.rowCount} products`);

            res.json({
                success: true,
                percentage,
                productsUpdated: updateResult.rowCount,
                before: beforeResult.rows,
                after: updateResult.rows,
                summary: summaryResult.rows[0]
            });
        } catch (error) {
            console.error("Error increasing prices:", error);
            res.status(500).json({ error: 'Failed to increase prices' });
        }
    });

    router.post('/api/products/update-stock', async (req, res) => {
        try {
            await productStore.updateStockBatch(req.body.items);
            res.status(200).json({ message: 'Stock updated successfully' });
        } catch (error) {
            console.error("Error updating stock:", error);
            res.status(500).json({ error: 'Failed to update stock' });
        }
    });

    return router;
}
