#!/usr/bin/env node

/**
 * 🏥 HEALTH CHECK SCRIPT - POS Conejo Negro
 * Script para validar el estado de salud del deployment
 */

const https = require('https');
const fs = require('fs');

const CONFIG = {
    BASE_URL: 'https://pos-conejo-negro.onrender.com',
    TIMEOUT: 30000, // 30 segundos
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 5000, // 5 segundos
};

// Colores para output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

/**
 * Realizar petición HTTP con timeout
 */
function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            timeout: CONFIG.TIMEOUT,
            ...options
        }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: data
                });
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Realizar petición con reintentos
 */
async function requestWithRetry(url, description) {
    for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
        try {
            log(`🔄 ${description} (intento ${attempt}/${CONFIG.RETRY_ATTEMPTS})...`, colors.blue);
            
            const response = await makeRequest(url);
            
            if (response.statusCode >= 200 && response.statusCode < 400) {
                log(`✅ ${description} - OK (${response.statusCode})`, colors.green);
                return response;
            } else {
                throw new Error(`HTTP ${response.statusCode}`);
            }
        } catch (error) {
            log(`❌ ${description} - Error: ${error.message}`, colors.red);
            
            if (attempt === CONFIG.RETRY_ATTEMPTS) {
                throw error;
            }
            
            log(`⏳ Esperando ${CONFIG.RETRY_DELAY/1000}s antes del siguiente intento...`, colors.yellow);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
        }
    }
}

/**
 * Validar endpoint específico
 */
async function validateEndpoint(path, description, expectedStatus = 200) {
    try {
        const url = `${CONFIG.BASE_URL}${path}`;
        const response = await requestWithRetry(url, description);
        
        if (response.statusCode === expectedStatus) {
            return { success: true, status: response.statusCode, message: 'OK' };
        } else {
            return { 
                success: false, 
                status: response.statusCode, 
                message: `Expected ${expectedStatus}, got ${response.statusCode}` 
            };
        }
    } catch (error) {
        return { success: false, status: 0, message: error.message };
    }
}

/**
 * Realizar health check completo
 */
async function performHealthCheck() {
    log('🏥 Iniciando Health Check del POS Conejo Negro...', colors.cyan);
    log(`🌐 URL Base: ${CONFIG.BASE_URL}`, colors.blue);
    log('', '');
    
    const checks = [];
    const startTime = Date.now();
    
    // 1. Health endpoint básico
    const healthCheck = await validateEndpoint('/health', 'Health Endpoint');
    checks.push({ name: 'Health Endpoint', ...healthCheck });
    
    // 2. Página principal
    const homeCheck = await validateEndpoint('/', 'Página Principal');
    checks.push({ name: 'Página Principal', ...homeCheck });
    
    // 3. Recursos estáticos
    const staticCheck = await validateEndpoint('/css/style.css', 'Recursos CSS', 404); // Puede no existir, pero servidor debe responder
    checks.push({ name: 'Recursos Estáticos', success: staticCheck.status !== 0, status: staticCheck.status, message: staticCheck.message });
    
    // 4. API endpoints (requieren autenticación, esperamos 401)
    const apiCheck = await validateEndpoint('/api/auth/verify', 'API Endpoints', 401);
    checks.push({ name: 'API Endpoints', ...apiCheck });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Generar reporte
    log('', '');
    log('📋 RESULTADOS DEL HEALTH CHECK:', colors.cyan);
    log('================================', colors.cyan);
    
    let passedChecks = 0;
    checks.forEach(check => {
        const status = check.success ? '✅' : '❌';
        const color = check.success ? colors.green : colors.red;
        log(`${status} ${check.name}: ${check.message} (${check.status})`, color);
        if (check.success) passedChecks++;
    });
    
    log('', '');
    log(`📊 Resumen: ${passedChecks}/${checks.length} checks pasaron`, colors.blue);
    log(`⏱️ Tiempo total: ${duration}ms`, colors.blue);
    log(`🌐 Servidor: ${CONFIG.BASE_URL}`, colors.blue);
    log(`📅 Timestamp: ${new Date().toISOString()}`, colors.blue);
    
    // Generar archivo de reporte
    const report = {
        timestamp: new Date().toISOString(),
        url: CONFIG.BASE_URL,
        duration: duration,
        totalChecks: checks.length,
        passedChecks: passedChecks,
        success: passedChecks === checks.length,
        checks: checks,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
    };
    
    const reportFile = `health-check-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    log(`📄 Reporte guardado: ${reportFile}`, colors.magenta);
    
    // Exit code
    const exitCode = report.success ? 0 : 1;
    log('', '');
    log(report.success ? '🎉 Health Check EXITOSO!' : '💥 Health Check FALLÓ!', 
        report.success ? colors.green : colors.red);
    
    process.exit(exitCode);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    performHealthCheck().catch(error => {
        log(`💥 Error fatal en health check: ${error.message}`, colors.red);
        process.exit(1);
    });
}

module.exports = {
    performHealthCheck,
    validateEndpoint,
    CONFIG
};
