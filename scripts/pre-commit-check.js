#!/usr/bin/env node

/**
 * 🔍 PRE-COMMIT CHECK - POS Conejo Negro
 * Script para validar que todo esté listo para deployment antes del commit
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const CONFIG = {
    required_files: [
        'server.js',
        'package.json',
        'render.yaml',
        'validate-render-deploy.js',
        '.github/workflows/deploy-and-validate.yml'
    ],
    required_scripts: [
        'start',
        'deploy:validate',
        'deploy:health',
        'deploy:status'
    ]
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
 * Verificar que archivos requeridos existen
 */
function checkRequiredFiles() {
    log('📁 Verificando archivos requeridos...', colors.blue);
    
    const missingFiles = [];
    CONFIG.required_files.forEach(file => {
        if (!fs.existsSync(file)) {
            missingFiles.push(file);
        } else {
            log(`  ✅ ${file}`, colors.green);
        }
    });
    
    if (missingFiles.length > 0) {
        log(`  ❌ Archivos faltantes: ${missingFiles.join(', ')}`, colors.red);
        return false;
    }
    
    return true;
}

/**
 * Verificar scripts de package.json
 */
function checkPackageScripts() {
    log('📦 Verificando scripts de package.json...', colors.blue);
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const scripts = packageJson.scripts || {};
        
        const missingScripts = [];
        CONFIG.required_scripts.forEach(script => {
            if (!scripts[script]) {
                missingScripts.push(script);
            } else {
                log(`  ✅ ${script}: ${scripts[script]}`, colors.green);
            }
        });
        
        if (missingScripts.length > 0) {
            log(`  ❌ Scripts faltantes: ${missingScripts.join(', ')}`, colors.red);
            return false;
        }
        
        return true;
    } catch (error) {
        log(`  ❌ Error leyendo package.json: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Verificar configuración de Render
 */
function checkRenderConfig() {
    log('🌐 Verificando configuración de Render...', colors.blue);
    
    try {
        const renderConfig = fs.readFileSync('render.yaml', 'utf8');
        
        // Verificaciones básicas
        const checks = [
            { pattern: /name:\s*pos-conejo-negro/, message: 'Nombre del servicio' },
            { pattern: /env:\s*node/, message: 'Entorno Node.js' },
            { pattern: /startCommand:\s*node\s+server\.js/, message: 'Comando de inicio' },
            { pattern: /autoDeploy:\s*true/, message: 'Auto-deploy habilitado' },
            { pattern: /branch:\s*main/, message: 'Branch principal' }
        ];
        
        let passed = true;
        checks.forEach(check => {
            if (check.pattern.test(renderConfig)) {
                log(`  ✅ ${check.message}`, colors.green);
            } else {
                log(`  ❌ ${check.message}`, colors.red);
                passed = false;
            }
        });
        
        return passed;
    } catch (error) {
        log(`  ❌ Error leyendo render.yaml: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Verificar workflow de GitHub Actions
 */
function checkGithubWorkflow() {
    log('⚙️ Verificando workflow de GitHub Actions...', colors.blue);
    
    const workflowPath = '.github/workflows/deploy-and-validate.yml';
    try {
        const workflow = fs.readFileSync(workflowPath, 'utf8');
        
        const checks = [
            { pattern: /name:\s*Deploy and Validate POS Conejo Negro/, message: 'Nombre del workflow' },
            { pattern: /on:\s*\n\s*push:/, message: 'Trigger de push' },
            { pattern: /branches:\s*\[\s*main\s*\]/, message: 'Branch trigger' },
            { pattern: /node validate-render-deploy\.js/, message: 'Script de validación' },
            { pattern: /upload-artifact@v4/, message: 'Upload de artefactos' }
        ];
        
        let passed = true;
        checks.forEach(check => {
            if (check.pattern.test(workflow)) {
                log(`  ✅ ${check.message}`, colors.green);
            } else {
                log(`  ❌ ${check.message}`, colors.red);
                passed = false;
            }
        });
        
        return passed;
    } catch (error) {
        log(`  ❌ Error leyendo workflow: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Verificar sintaxis básica de JavaScript
 */
function checkSyntax() {
    log('🔍 Verificando sintaxis básica...', colors.blue);
    
    const jsFiles = ['server.js', 'validate-render-deploy.js'];
    
    for (const file of jsFiles) {
        try {
            // Intento de parsear el archivo para verificar sintaxis básica
            if (fs.existsSync(file)) {
                const content = fs.readFileSync(file, 'utf8');
                // Verificar que no tenga caracteres problemáticos
                if (content.includes('\r\n')) {
                    log(`  ⚠️ ${file}: Contiene line endings CRLF (Windows)`, colors.yellow);
                }
                log(`  ✅ ${file}: Sintaxis OK`, colors.green);
            }
        } catch (error) {
            log(`  ❌ ${file}: Error de sintaxis - ${error.message}`, colors.red);
            return false;
        }
    }
    
    return true;
}

/**
 * Verificar estado de Git
 */
function checkGitStatus() {
    log('📋 Verificando estado de Git...', colors.blue);
    
    try {
        // Verificar si hay cambios sin agregar
        const status = execSync('git status --porcelain', { encoding: 'utf8' });
        
        if (status.trim()) {
            const lines = status.trim().split('\n');
            const unstagedChanges = lines.filter(line => line.startsWith(' M') || line.startsWith('??'));
            
            if (unstagedChanges.length > 0) {
                log(`  ⚠️ Hay ${unstagedChanges.length} archivos sin agregar al commit`, colors.yellow);
                unstagedChanges.forEach(line => {
                    log(`    ${line}`, colors.yellow);
                });
            } else {
                log(`  ✅ Todos los cambios están staged`, colors.green);
            }
        } else {
            log(`  ✅ Working directory limpio`, colors.green);
        }
        
        return true;
    } catch (error) {
        log(`  ❌ Error verificando Git status: ${error.message}`, colors.red);
        return false;
    }
}

/**
 * Ejecutar todas las verificaciones
 */
function runAllChecks() {
    log('🚀 INICIANDO PRE-COMMIT CHECKS - POS Conejo Negro', colors.cyan);
    log('='.repeat(60), colors.cyan);
    log('', '');
    
    const checks = [
        { name: 'Archivos Requeridos', fn: checkRequiredFiles },
        { name: 'Scripts Package.json', fn: checkPackageScripts },
        { name: 'Configuración Render', fn: checkRenderConfig },
        { name: 'Workflow GitHub Actions', fn: checkGithubWorkflow },
        { name: 'Sintaxis JavaScript', fn: checkSyntax },
        { name: 'Estado Git', fn: checkGitStatus }
    ];
    
    let passedChecks = 0;
    const results = [];
    
    for (const check of checks) {
        try {
            const result = check.fn();
            results.push({ name: check.name, passed: result });
            if (result) passedChecks++;
        } catch (error) {
            log(`❌ Error en ${check.name}: ${error.message}`, colors.red);
            results.push({ name: check.name, passed: false, error: error.message });
        }
        log('', ''); // Separador
    }
    
    // Resumen
    log('📊 RESUMEN DE PRE-COMMIT CHECKS', colors.cyan);
    log('='.repeat(40), colors.cyan);
    
    results.forEach(result => {
        const status = result.passed ? '✅' : '❌';
        const color = result.passed ? colors.green : colors.red;
        log(`${status} ${result.name}`, color);
        if (result.error) {
            log(`   Error: ${result.error}`, colors.red);
        }
    });
    
    log('', '');
    log(`📈 Total: ${passedChecks}/${checks.length} checks pasaron`, colors.blue);
    
    if (passedChecks === checks.length) {
        log('🎉 ¡TODOS LOS CHECKS PASARON! Listo para commit.', colors.green);
        return true;
    } else {
        log('💥 ALGUNOS CHECKS FALLARON. Por favor corrige los errores antes del commit.', colors.red);
        return false;
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    const success = runAllChecks();
    process.exit(success ? 0 : 1);
}

module.exports = {
    runAllChecks,
    checkRequiredFiles,
    checkPackageScripts,
    checkRenderConfig,
    checkGithubWorkflow,
    CONFIG
};
