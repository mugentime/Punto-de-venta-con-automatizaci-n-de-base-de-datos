#!/usr/bin/env node
/**
 * SCRIPT DE BACKUP PRE-DEPLOY
 * Protege datos críticos antes de cada despliegue
 * Evita pérdida de sesiones activas y registros importantes
 */

const fs = require('fs');
const path = require('path');

const CRITICAL_FILES = [
    'data/coworking_sessions.json',
    'data/records.json',
    'data/customers.json',
    'data/cashcuts.json',
    'data/expenses.json',
    'data/users.json'
];

function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = `backups/pre-deploy-${timestamp}`;
    
    // Crear directorio de backup
    if (!fs.existsSync('backups')) {
        fs.mkdirSync('backups', { recursive: true });
    }
    
    fs.mkdirSync(backupDir, { recursive: true });
    
    console.log('🔄 Creando backup pre-deploy...');
    
    let backupSummary = {
        timestamp: new Date().toISOString(),
        files: [],
        activeSessions: 0,
        totalRecords: 0
    };
    
    CRITICAL_FILES.forEach(file => {
        if (fs.existsSync(file)) {
            const backupPath = path.join(backupDir, path.basename(file));
            fs.copyFileSync(file, backupPath);
            
            const stats = fs.statSync(file);
            const fileInfo = {
                file: file,
                size: stats.size,
                lastModified: stats.mtime
            };
            
            // Analizar contenido crítico
            if (file.includes('coworking_sessions')) {
                try {
                    const sessions = JSON.parse(fs.readFileSync(file, 'utf8'));
                    const activeSessions = sessions.filter(s => s.status === 'active').length;
                    fileInfo.activeSessions = activeSessions;
                    backupSummary.activeSessions += activeSessions;
                    
                    if (activeSessions > 0) {
                        console.log(`⚠️  ADVERTENCIA: ${activeSessions} sesiones activas de coworking encontradas`);
                        sessions.filter(s => s.status === 'active').forEach(session => {
                            console.log(`   - Cliente: ${session.client} (ID: ${session._id})`);
                        });
                    }
                } catch (e) {
                    console.log(`⚠️  Error leyendo sesiones: ${e.message}`);
                }
            }
            
            if (file.includes('records')) {
                try {
                    const records = JSON.parse(fs.readFileSync(file, 'utf8'));
                    backupSummary.totalRecords += records.length;
                    fileInfo.recordCount = records.length;
                } catch (e) {
                    console.log(`⚠️  Error leyendo registros: ${e.message}`);
                }
            }
            
            backupSummary.files.push(fileInfo);
            console.log(`✅ Backup creado: ${file} -> ${backupPath}`);
        } else {
            console.log(`⚠️  Archivo no encontrado: ${file}`);
        }
    });
    
    // Guardar resumen del backup
    fs.writeFileSync(
        path.join(backupDir, 'backup-summary.json'), 
        JSON.stringify(backupSummary, null, 2)
    );
    
    console.log(`\n📁 Backup completado en: ${backupDir}`);
    console.log(`📊 Resumen: ${backupSummary.files.length} archivos, ${backupSummary.activeSessions} sesiones activas, ${backupSummary.totalRecords} registros totales`);
    
    return backupDir;
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    try {
        createBackup();
        console.log('\n✅ Backup pre-deploy completado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creando backup:', error.message);
        process.exit(1);
    }
}

module.exports = { createBackup };
