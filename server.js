
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

// --- CONFIGURATION ---
let pool;
let useDb = false;
let ai = null; // AI client is now nullable
const initialProducts = [
    { id: '1', name: 'Espresso Americano', price: 35, cost: 12, stock: 100, description: 'Intenso y aromático, preparado con granos de especialidad.', imageUrl: 'https://picsum.photos/seed/americano/400', category: 'Cafetería' },
    { id: '2', name: 'Latte', price: 55, cost: 18, stock: 100, description: 'Cremoso y suave, con leche vaporizada a la perfección.', imageUrl: 'https://picsum.photos/seed/latte/400', category: 'Cafetería' },
    { id: '3', name: 'Croissant', price: 40, cost: 20, stock: 50, description: 'Hojaldrado y horneado diariamente.', imageUrl: 'https://picsum.photos/seed/croissant/400', category: 'Alimentos' },
    { id: '4', name: 'Jugo Prensado en Frío', price: 60, cost: 35, stock: 60, description: 'Mezcla de naranja, zanahoria y jengibre.', imageUrl: 'https://picsum.photos/seed/juice/400', category: 'Refrigerador' },
    { id: '5', name: 'Baguette de Pavo y Pesto', price: 95, cost: 55, stock: 30, description: 'Pavo, queso manchego, arúgula y pesto de la casa.', imageUrl: 'https://picsum.photos/seed/sandwich/400', category: 'Alimentos' },
    { id: '6', name: 'Matcha Latte', price: 65, cost: 25, stock: 80, description: 'Té verde matcha ceremonial con leche a elección.', imageUrl: 'https://picsum.photos/seed/matcha/400', category: 'Cafetería' },
    { id: '7', name: 'Pan de Elote', price: 50, cost: 22, stock: 45, description: 'Receta casera, dulce y esponjoso.', imageUrl: 'https://picsum.photos/seed/cornbread/400', category: 'Alimentos' },
];

// --- DATABASE & DATA STORE SETUP ---
async function setupAndGetDataStore() {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
        try {
            pool = new Pool({ connectionString: databaseUrl });
            const client = await pool.connect();
            console.log("Successfully connected to PostgreSQL.");

            await client.query(`
              CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                price NUMERIC(10, 2) NOT NULL,
                cost NUMERIC(10, 2) NOT NULL,
                stock INTEGER NOT NULL,
                description TEXT,
                "imageUrl" TEXT,
                category VARCHAR(255) NOT NULL
              );
            `);

            const res = await client.query('SELECT COUNT(*) FROM products');
            if (res.rows[0].count === '0') {
                console.log('Seeding initial products into database...');
                const insertQuery = 'INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)';
                for (const p of initialProducts) {
                    await client.query(insertQuery, [p.id, p.name, p.price, p.cost, p.stock, p.description, p.imageUrl, p.category]);
                }
                console.log('Database seeded successfully.');
            }
            client.release();
            useDb = true;
            console.log("Running in Database Mode.");
        } catch (err) {
            console.error('*******************************************************************');
            console.error('*** ERROR: Database connection failed.                            ***');
            console.error(`*** Details: ${err.message}`);
            console.error('*** Switching to in-memory mode for development.              ***');
            console.error('*******************************************************************');
            pool = null;
            useDb = false;
        }
    }

    if (!useDb) {
        console.warn("*******************************************************************");
        console.warn("*** WARNING: Running in in-memory mode.                         ***");
        console.warn("*** Data will not be persisted. Set a valid DATABASE_URL        ***");
        console.warn("*** environment variable to connect to a PostgreSQL database.   ***");
        console.warn("*******************************************************************");
    }

    const productStore = {
        async getAll() {
            if (!useDb) return initialProducts;
            const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
            return result.rows.map(product => ({
                ...product,
                price: parseFloat(product.price),
                cost: parseFloat(product.cost),
                stock: parseInt(product.stock)
            }));
        },
        async create(productData) {
            if (!useDb) {
                const newProduct = { ...productData, id: `prod-${Date.now()}` };
                initialProducts.push(newProduct);
                return newProduct;
            }
            const { name, price, cost, stock, description, imageUrl, category } = productData;
            const id = `prod-${Date.now()}`;
            const result = await pool.query(
                'INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [id, name, price, cost, stock, description, imageUrl, category]
            );
            return result.rows[0];
        },
        async update(id, productData) {
            if (!useDb) {
                const index = initialProducts.findIndex(p => p.id === id);
                if (index > -1) {
                    initialProducts[index] = { ...initialProducts[index], ...productData, id };
                    return initialProducts[index];
                }
                return null;
            }
            const { name, price, cost, stock, description, imageUrl, category } = productData;
            const result = await pool.query(
                'UPDATE products SET name = $1, price = $2, cost = $3, stock = $4, description = $5, "imageUrl" = $6, category = $7 WHERE id = $8 RETURNING *',
                [name, price, cost, stock, description, imageUrl, category, id]
            );
            return result.rows[0];
        },
        async delete(id) {
            if (!useDb) {
                const index = initialProducts.findIndex(p => p.id === id);
                if (index > -1) {
                    initialProducts.splice(index, 1);
                }
                return;
            }
            await pool.query('DELETE FROM products WHERE id = $1', [id]);
        },
        async importBatch(productsToImport) {
            if (!useDb) {
                 productsToImport.forEach(p_new => {
                    const index = initialProducts.findIndex(p_old => p_old.name === p_new.name);
                    if (index > -1) {
                        initialProducts[index] = {...initialProducts[index], ...p_new};
                    } else {
                        initialProducts.push({...p_new, id: `prod-${Date.now()}-${Math.random()}`});
                    }
                });
                return initialProducts;
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const product of productsToImport) {
                    const query = `
                        INSERT INTO products (id, name, price, cost, stock, description, "imageUrl", category)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (name) DO UPDATE SET
                            price = EXCLUDED.price,
                            cost = EXCLUDED.cost,
                            stock = EXCLUDED.stock,
                            description = EXCLUDED.description,
                            "imageUrl" = EXCLUDED."imageUrl",
                            category = EXCLUDED.category;
                    `;
                    await client.query(query, [`prod-${Date.now()}-${Math.random()}`, product.name, product.price, product.cost, product.stock, product.description, product.imageUrl, product.category]);
                }
                await client.query('COMMIT');
                const allProducts = await client.query('SELECT * FROM products ORDER BY name ASC');
                return allProducts.rows;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },
        async updateStockBatch(items) {
            if (!useDb) {
                items.forEach(item => {
                    const product = initialProducts.find(p => p.id === item.id);
                    if (product) {
                        product.stock -= item.quantity;
                    }
                });
                return;
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                for (const item of items) {
                    await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
                }
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },
    };

    return productStore;
}

async function startServer() {
    const productStore = await setupAndGetDataStore();

    // --- EXPRESS APP SETUP ---
    const app = express();
    const port = process.env.PORT || 3001;
    app.use(express.json());

    // --- GEMINI API SETUP ---
    const apiKey = process.env.API_KEY;
    if (apiKey) {
        ai = new GoogleGenAI({ apiKey });
        console.log("Gemini AI client initialized successfully.");
    } else {
        console.warn("*******************************************************************");
        console.warn("*** WARNING: API_KEY is not set.                                ***");
        console.warn("*** AI-powered features (description/image generation) will be  ***");
        console.warn("*** disabled. Set the API_KEY environment variable to enable them.***");
        console.warn("*******************************************************************");
    }

    // --- API ENDPOINTS ---
    app.get('/api/products', async (req, res) => {
        try {
            const products = await productStore.getAll();
            res.json(products);
        } catch (error) {
            console.error("Error fetching products:", error);
            res.status(500).json({ error: 'Failed to fetch products' });
        }
    });

    app.post('/api/products', async (req, res) => {
        try {
            const newProduct = await productStore.create(req.body);
            res.status(201).json(newProduct);
        } catch (error) {
            console.error("Error creating product:", error);
            res.status(500).json({ error: 'Failed to create product' });
        }
    });
    
    app.put('/api/products/:id', async (req, res) => {
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

    app.delete('/api/products/:id', async (req, res) => {
        try {
            await productStore.delete(req.params.id);
            res.status(204).send();
        } catch (error) {
            console.error(`Error deleting product ${req.params.id}:`, error);
            res.status(500).json({ error: 'Failed to delete product' });
        }
    });

    app.post('/api/products/import', async (req, res) => {
        try {
            const fullProductList = await productStore.importBatch(req.body);
            res.status(200).json(fullProductList);
        } catch (error) {
            console.error("Error importing products:", error);
            res.status(500).json({ error: 'Failed to import products' });
        }
    });

    app.post('/api/products/update-stock', async (req, res) => {
        try {
            await productStore.updateStockBatch(req.body.items);
            res.status(200).json({ message: 'Stock updated successfully' });
        } catch (error) {
            console.error("Error updating stock:", error);
            res.status(500).json({ error: 'Failed to update stock' });
        }
    });

    // --- GEMINI ENDPOINTS ---
    app.post('/api/generate-description', async (req, res) => {
      if (!ai) {
        return res.status(503).json({ error: 'AI features are not configured on the server.' });
      }
      const { productName, keywords } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }
      const prompt = `Genera una descripción de producto atractiva y concisa para un sistema de punto de venta.
      Nombre del Producto: "${productName}"
      Palabras Clave: "${keywords || ''}"
      La descripción debe ser breve, impactante y adecuada para un catálogo de productos. No uses markdown. Solo texto plano. Limita la respuesta a 2 o 3 frases.`;
      try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        res.json({ description: response.text.trim() });
      } catch (error) {
        console.error("Error generating description with Gemini:", error);
        res.status(500).json({ error: 'Failed to generate description' });
      }
    });
    
    app.post('/api/generate-image', async (req, res) => {
      if (!ai) {
        return res.status(503).json({ error: 'AI features are not configured on the server.' });
      }
      const { productName } = req.body;
      if (!productName) {
        return res.status(400).json({ error: 'productName is required' });
      }
      const prompt = `Dibujo minimalista de "${productName}". Estilo line art, con líneas limpias y simples. El producto debe estar centrado sobre un fondo de color gris claro sólido (#f3f4f6).`;
      try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio: '1:1' },
        });
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
            res.json({ imageUrl });
        } else {
            console.warn("Gemini API did not return an image.");
            res.status(500).json({ error: 'Gemini API did not return an image.' });
        }
      } catch (error) {
        console.error("Error generating image with Gemini:", error);
        res.status(500).json({ error: 'Failed to generate image' });
      }
    });

    // --- SERVE STATIC FILES ---
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });

    // --- START SERVER ---
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

startServer();
