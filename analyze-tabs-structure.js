/**
 * Playwright Script para analizar la estructura de pestañas del POS
 * y preparar optimizaciones con Magic UI components
 */

const { chromium } = require('playwright');

async function analyzeTabsStructure() {
    console.log('🔍 Iniciando análisis de la estructura de pestañas...');
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Navegar a la página local del POS
        console.log('🌐 Navegando a la interfaz del POS...');
        await page.goto('http://localhost:3000/conejo_negro_online.html', { 
            waitUntil: 'networkidle' 
        });
        
        // Esperar que la página cargue completamente
        await page.waitForTimeout(3000);
        
        // Analizar la estructura de navegación/pestañas
        console.log('📋 Analizando estructura de pestañas...');
        
        const tabsInfo = await page.evaluate(() => {
            const navElements = document.querySelectorAll('nav, .nav, .tabs, .menu, [role="tablist"]');
            const linkElements = document.querySelectorAll('a[href*="#"], button[data-section]');
            
            const analysis = {
                navigation: [],
                sections: [],
                currentLayout: null,
                styles: []
            };
            
            // Analizar elementos de navegación
            navElements.forEach((nav, index) => {
                const rect = nav.getBoundingClientRect();
                const styles = window.getComputedStyle(nav);
                
                analysis.navigation.push({
                    index,
                    tagName: nav.tagName,
                    className: nav.className,
                    id: nav.id,
                    position: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    },
                    styles: {
                        display: styles.display,
                        flexDirection: styles.flexDirection,
                        justifyContent: styles.justifyContent,
                        backgroundColor: styles.backgroundColor,
                        position: styles.position
                    },
                    children: nav.children.length,
                    innerHTML: nav.innerHTML.substring(0, 200) + '...'
                });
            });
            
            // Analizar enlaces/botones de sección
            linkElements.forEach((link, index) => {
                const rect = link.getBoundingClientRect();
                const styles = window.getComputedStyle(link);
                
                analysis.sections.push({
                    index,
                    text: link.textContent.trim(),
                    href: link.href || link.getAttribute('data-section'),
                    tagName: link.tagName,
                    className: link.className,
                    position: {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    },
                    styles: {
                        color: styles.color,
                        backgroundColor: styles.backgroundColor,
                        fontSize: styles.fontSize,
                        fontWeight: styles.fontWeight,
                        padding: styles.padding,
                        margin: styles.margin,
                        borderRadius: styles.borderRadius
                    },
                    isVisible: rect.width > 0 && rect.height > 0
                });
            });
            
            // Detectar el layout actual
            const header = document.querySelector('header, .header, .top-nav');
            if (header) {
                const headerStyles = window.getComputedStyle(header);
                analysis.currentLayout = {
                    type: 'header',
                    position: headerStyles.position,
                    display: headerStyles.display,
                    flexDirection: headerStyles.flexDirection,
                    height: header.getBoundingClientRect().height
                };
            }
            
            return analysis;
        });
        
        // Capturar screenshot del estado actual
        console.log('📸 Capturando screenshot del estado actual...');
        await page.screenshot({ 
            path: 'current-tabs-structure.png',
            fullPage: false,
            clip: { x: 0, y: 0, width: 1920, height: 200 }
        });
        
        // Analizar la sección de corte de caja específicamente
        console.log('🔍 Analizando sección de corte de caja...');
        
        // Navegar a la sección de corte de caja
        await page.click('a[href="#corte-caja"], button[onclick*="corte-caja"]').catch(() => {
            console.log('⚠️ No se encontró enlace directo, buscando alternativa...');
        });
        
        // Buscar cualquier elemento que contenga "corte" o "caja"
        const cashCutSection = await page.locator('text=Corte').first();
        if (await cashCutSection.count() > 0) {
            await cashCutSection.click();
            await page.waitForTimeout(1000);
        }
        
        // Verificar el estado de cortes automáticos
        const statusInfo = await page.evaluate(() => {
            const statusElement = document.getElementById('auto-cuts-status');
            const lastCutElement = document.getElementById('last-cut-time');
            
            return {
                statusExists: !!statusElement,
                statusText: statusElement ? statusElement.textContent.trim() : 'No encontrado',
                statusHTML: statusElement ? statusElement.innerHTML : 'No encontrado',
                lastCutExists: !!lastCutElement,
                lastCutText: lastCutElement ? lastCutElement.textContent.trim() : 'No encontrado'
            };
        });
        
        console.log('📊 Información de estado de cortes:', JSON.stringify(statusInfo, null, 2));
        
        // Capturar screenshot de la sección de corte de caja
        await page.screenshot({ 
            path: 'cashcut-section-current.png',
            fullPage: false
        });
        
        console.log('\n📋 ANÁLISIS COMPLETADO');
        console.log('========================');
        console.log(`🗂️ Elementos de navegación encontrados: ${tabsInfo.navigation.length}`);
        console.log(`🔗 Enlaces de sección encontrados: ${tabsInfo.sections.length}`);
        console.log(`📱 Layout actual: ${tabsInfo.currentLayout ? tabsInfo.currentLayout.type : 'No detectado'}`);
        
        // Mostrar información de las secciones
        console.log('\n🏷️ SECCIONES IDENTIFICADAS:');
        tabsInfo.sections
            .filter(section => section.isVisible)
            .forEach(section => {
                console.log(`  • ${section.text} (${section.tagName.toLowerCase()}) - ${section.href || 'Sin href'}`);
            });
        
        console.log('\n📊 Estado de cortes automáticos:', statusInfo.statusText);
        
        // Generar recomendaciones de Magic UI
        const recommendations = generateMagicUIRecommendations(tabsInfo);
        console.log('\n✨ RECOMENDACIONES MAGIC UI:');
        recommendations.forEach(rec => console.log(`  • ${rec}`));
        
        return { tabsInfo, statusInfo, recommendations };
        
    } catch (error) {
        console.error('❌ Error durante el análisis:', error);
        return null;
    } finally {
        await browser.close();
        console.log('🏁 Análisis completado');
    }
}

function generateMagicUIRecommendations(tabsInfo) {
    const recommendations = [];
    
    // Analizar el número de secciones para recomendar componentes apropiados
    const visibleSections = tabsInfo.sections.filter(s => s.isVisible).length;
    
    if (visibleSections > 6) {
        recommendations.push('Usar Dock component para navegación compacta con tooltips');
    }
    
    recommendations.push('Implementar Animated Beam para conexiones visuales entre secciones');
    recommendations.push('Agregar Blur Fade animation para transiciones suaves');
    recommendations.push('Usar Shimmer Button para destacar sección activa');
    recommendations.push('Implementar Scroll Progress para indicar posición en formularios largos');
    recommendations.push('Agregar Interactive Hover Button effects para mejor UX');
    
    // Recomendaciones específicas para el estado de cortes
    recommendations.push('Usar Animated Circular Progress Bar para mostrar tiempo hasta próximo corte');
    recommendations.push('Implementar Badge component con Neon Gradient para estado "Activo"');
    
    return recommendations;
}

// Ejecutar el análisis
if (require.main === module) {
    analyzeTabsStructure()
        .then(result => {
            if (result) {
                console.log('\n✅ Análisis completado exitosamente');
                console.log('📁 Screenshots guardados en el directorio actual');
                console.log('🎨 Listo para aplicar optimizaciones Magic UI');
            }
        })
        .catch(console.error);
}

module.exports = { analyzeTabsStructure };
