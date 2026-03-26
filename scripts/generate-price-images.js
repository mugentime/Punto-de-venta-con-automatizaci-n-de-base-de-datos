// Generate price list images from PostgreSQL database
import pg from 'pg';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
const DATABASE_PUBLIC_URL = 'postgresql://postgres:CdSUGzLIGZhijHJPPTsLVVJjDvtWawvg@yamabiko.proxy.rlwy.net:45660/railway';

const pool = new Pool({
    connectionString: DATABASE_PUBLIC_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Configuration
const OUTPUT_DIR = path.join(__dirname, 'output');
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'price-list-template.html');

// Categories to generate
const CATEGORIES = ['Alimentos', 'Cafetería', 'Refrigerador', 'Membresías'];

/**
 * Get products from PostgreSQL by category
 */
async function getProductsByCategory(category) {
    console.log(`  📊 Consultando productos de categoría: ${category}`);

    const query = `
        SELECT id, name, category, price, cost
        FROM products
        WHERE category = $1
        ORDER BY name ASC
    `;

    const result = await pool.query(query, [category]);
    console.log(`  ✓ ${result.rows.length} productos encontrados`);

    return result.rows;
}

/**
 * Generate HTML from template with products
 */
async function generatePriceListHTML(products, category) {
    console.log(`  🎨 Generando HTML para ${category}`);

    // Read template
    const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

    // Generate product rows
    const productsHTML = products.map(p =>
        `<tr>
            <td>${p.name}</td>
            <td>$${parseFloat(p.price).toFixed(2)}</td>
        </tr>`
    ).join('\n        ');

    // Replace template variables
    const html = template
        .replace('{{category}}', category)
        .replace('{{products}}', productsHTML)
        .replace('{{count}}', products.length)
        .replace('{{date}}', new Date().toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }));

    console.log(`  ✓ HTML generado (${html.length} caracteres)`);
    return html;
}

/**
 * Render HTML to PNG image using Puppeteer
 */
async function renderHTMLToImage(html, outputPath) {
    console.log(`  🖼️  Renderizando imagen con Puppeteer...`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set content
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });

        // Set viewport for high quality
        await page.setViewport({
            width: 900,
            height: 1400,
            deviceScaleFactor: 2  // 2x resolution for crisp text
        });

        // Take screenshot
        await page.screenshot({
            path: outputPath,
            fullPage: true,
            type: 'png'
        });

        const stats = fs.statSync(outputPath);
        console.log(`  ✓ Imagen generada (${(stats.size / 1024).toFixed(2)} KB)`);
    } finally {
        await browser.close();
    }
}

/**
 * Optimize image with Sharp
 */
async function optimizeImage(imagePath) {
    console.log(`  ⚡ Optimizando imagen con Sharp...`);

    const optimizedPath = imagePath.replace('.png', '-optimized.png');

    await sharp(imagePath)
        .resize(900, null, {
            withoutEnlargement: true,
            fit: 'inside'
        })
        .png({
            quality: 90,
            compressionLevel: 9,
            adaptiveFiltering: true
        })
        .toFile(optimizedPath);

    const originalStats = fs.statSync(imagePath);
    const optimizedStats = fs.statSync(optimizedPath);
    const reduction = ((1 - optimizedStats.size / originalStats.size) * 100).toFixed(1);

    console.log(`  ✓ Optimización completa (${reduction}% reducción)`);

    // Delete original, keep optimized
    fs.unlinkSync(imagePath);
    fs.renameSync(optimizedPath, imagePath);

    return imagePath;
}

/**
 * Upload to Google Drive (placeholder - requires Google Drive setup)
 */
async function uploadToGoogleDrive(imagePath, filename) {
    console.log(`  ☁️  Upload a Google Drive (requiere configuración)...`);

    // This function would use the existing googleDrive.js service
    // For now, we'll just show the local path

    console.log(`  ℹ️  Archivo listo para subir: ${imagePath}`);
    console.log(`  ℹ️  Nombre sugerido: ${filename}`);

    return {
        localPath: imagePath,
        filename: filename,
        needsUpload: true
    };
}

/**
 * Generate price list for a single category
 */
async function generateCategoryPriceList(category) {
    console.log(`\n📋 GENERANDO LISTA: ${category}`);
    console.log('─'.repeat(60));

    try {
        // 1. Get products
        const products = await getProductsByCategory(category);

        if (products.length === 0) {
            console.log(`  ⚠️  No hay productos en la categoría ${category}`);
            return null;
        }

        // 2. Generate HTML
        const html = await generatePriceListHTML(products, category);

        // 3. Render to image
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Lista-Precios-${category.replace(/\s+/g, '-')}-${timestamp}.png`;
        const outputPath = path.join(OUTPUT_DIR, filename);

        await renderHTMLToImage(html, outputPath);

        // 4. Optimize image
        await optimizeImage(outputPath);

        // 5. Prepare for Google Drive upload
        const uploadInfo = await uploadToGoogleDrive(outputPath, filename);

        console.log(`\n✅ COMPLETADO: ${category}`);
        console.log(`   Archivo: ${filename}`);
        console.log(`   Ruta: ${outputPath}`);

        return {
            category,
            filename,
            path: outputPath,
            productCount: products.length,
            uploadInfo
        };

    } catch (error) {
        console.error(`\n❌ ERROR en ${category}:`, error.message);
        return null;
    }
}

/**
 * Main function - generate all price lists
 */
async function main() {
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  🎨 GENERADOR DE LISTAS DE PRECIOS - Conejo Negro     ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Directorio creado: ${OUTPUT_DIR}\n`);
    }

    try {
        // Test database connection
        console.log('🔌 Probando conexión a PostgreSQL...');
        const testResult = await pool.query('SELECT COUNT(*) FROM products');
        console.log(`✓ Conexión exitosa: ${testResult.rows[0].count} productos en BD\n`);

        // Generate price lists for all categories
        const results = [];

        for (const category of CATEGORIES) {
            const result = await generateCategoryPriceList(category);
            if (result) {
                results.push(result);
            }
        }

        // Summary
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║  📊 RESUMEN DE GENERACIÓN                              ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        console.log(`✅ Listas generadas: ${results.length}/${CATEGORIES.length}\n`);

        results.forEach(r => {
            console.log(`   ${r.category.padEnd(15)} - ${r.productCount} productos`);
            console.log(`   └─ ${r.filename}`);
        });

        console.log('\n📁 Todas las imágenes están en:');
        console.log(`   ${OUTPUT_DIR}\n`);

        console.log('💡 SIGUIENTE PASO:');
        console.log('   Para subir a Google Drive, configura las credenciales');
        console.log('   en .env y descomenta la función uploadToGoogleDrive()\n');

    } catch (error) {
        console.error('\n❌ ERROR GENERAL:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('🔌 Conexión a BD cerrada');
    }
}

// Run the script
main().catch(console.error);
