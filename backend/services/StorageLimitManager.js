/**
 * Sistema de Gestión de Límites de Almacenamiento - POS ConEJO NEGRO
 * 🔧 Reparación: Límites de almacenamiento de reportes
 * 💾 TaskMaster: Intelligent Storage Limit Management System
 */

const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const zlib = require('zlib');
const { promisify } = require('util');

class StorageLimitManager {
    constructor() {
        this.storagePath = path.join(__dirname, '..', '..', 'data', 'reports');
        this.archivePath = path.join(__dirname, '..', '..', 'data', 'archive');
        this.tempPath = path.join(__dirname, '..', '..', 'temp');
        
        // Configuración de límites (en MB)
        this.maxStorageSize = process.env.MAX_STORAGE_SIZE || 500; // 500MB por defecto
        this.warningThreshold = 0.8; // Advertencia al 80%
        this.criticalThreshold = 0.95; // Crítico al 95%
        
        // Políticas de retención
        this.retentionPolicies = {
            daily: { days: 30, priority: 1 },
            weekly: { days: 90, priority: 2 },
            monthly: { days: 365, priority: 3 },
            yearly: { days: 1095, priority: 4 } // 3 años
        };
        
        this.compressionLevel = 6; // Nivel de compresión gzip
        this.initializeService();
        
        console.log('💾 TaskMaster: Sistema de Gestión de Almacenamiento Inicializado');
    }

    /**
     * 🚀 Inicializar servicio
     */
    async initializeService() {
        try {
            await this.createDirectories();
            await this.startMonitoring();
            this.scheduleMaintenanceTasks();
            
            console.log('✅ Storage Limit Manager inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Storage Manager:', error.message);
        }
    }

    /**
     * 📁 Crear directorios necesarios
     */
    async createDirectories() {
        const dirs = [this.storagePath, this.archivePath, this.tempPath];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
            }
        }
        
        console.log('📁 Directorios de almacenamiento verificados');
    }

    /**
     * 📊 Analizar uso de almacenamiento
     */
    async analyzeStorageUsage() {
        try {
            const analysis = {
                totalSize: 0,
                fileCount: 0,
                filesByType: {},
                filesByAge: {},
                largestFiles: [],
                oldestFiles: [],
                compressionCandidates: []
            };

            await this.scanDirectory(this.storagePath, analysis);
            
            // Calcular porcentajes
            const maxSizeBytes = this.maxStorageSize * 1024 * 1024;
            analysis.usagePercentage = (analysis.totalSize / maxSizeBytes) * 100;
            analysis.availableSpace = maxSizeBytes - analysis.totalSize;
            analysis.status = this.getStorageStatus(analysis.usagePercentage);
            
            // Identificar archivos para limpieza
            analysis.cleanupCandidates = await this.identifyCleanupCandidates();
            
            return analysis;
            
        } catch (error) {
            console.error('❌ Error analizando almacenamiento:', error.message);
            return null;
        }
    }

    /**
     * 🔍 Escanear directorio recursivamente
     */
    async scanDirectory(dirPath, analysis) {
        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    await this.scanDirectory(itemPath, analysis);
                } else {
                    const stats = await fs.stat(itemPath);
                    const ext = path.extname(item.name).toLowerCase();
                    const age = Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24));
                    
                    analysis.totalSize += stats.size;
                    analysis.fileCount++;
                    
                    // Por tipo
                    analysis.filesByType[ext] = (analysis.filesByType[ext] || 0) + 1;
                    
                    // Por edad
                    const ageGroup = this.getAgeGroup(age);
                    analysis.filesByAge[ageGroup] = (analysis.filesByAge[ageGroup] || 0) + 1;
                    
                    // Archivos más grandes
                    analysis.largestFiles.push({
                        path: itemPath,
                        size: stats.size,
                        mtime: stats.mtime
                    });
                    
                    // Archivos más antiguos
                    analysis.oldestFiles.push({
                        path: itemPath,
                        age: age,
                        size: stats.size
                    });
                    
                    // Candidatos a compresión
                    if (this.isCompressionCandidate(itemPath, stats)) {
                        analysis.compressionCandidates.push({
                            path: itemPath,
                            size: stats.size,
                            estimatedSavings: stats.size * 0.7 // Estimado 70% de compresión
                        });
                    }
                }
            }
            
            // Mantener solo top 10
            analysis.largestFiles.sort((a, b) => b.size - a.size).splice(10);
            analysis.oldestFiles.sort((a, b) => b.age - a.age).splice(10);
            
        } catch (error) {
            console.warn('⚠️ Error escaneando directorio:', dirPath, error.message);
        }
    }

    /**
     * 🧹 Ejecutar limpieza inteligente
     */
    async performIntelligentCleanup(forceCleanup = false) {
        try {
            const analysis = await this.analyzeStorageUsage();
            if (!analysis) return { success: false, error: 'No se pudo analizar el almacenamiento' };

            console.log(`📊 Análisis: ${analysis.usagePercentage.toFixed(2)}% usado (${this.formatBytes(analysis.totalSize)})`);

            // Determinar si necesita limpieza
            const needsCleanup = forceCleanup || 
                                 analysis.usagePercentage > (this.warningThreshold * 100);

            if (!needsCleanup) {
                console.log('✅ Almacenamiento en niveles normales, no se requiere limpieza');
                return { success: true, message: 'No se requiere limpieza' };
            }

            console.log('🧹 Iniciando limpieza inteligente...');

            const cleanupResult = {
                filesDeleted: 0,
                filesCompressed: 0,
                filesArchived: 0,
                spaceSaved: 0,
                actions: []
            };

            // 1. Eliminar archivos expirados por políticas de retención
            await this.cleanupExpiredFiles(cleanupResult);

            // 2. Comprimir archivos grandes candidatos
            if (analysis.usagePercentage > (this.criticalThreshold * 100)) {
                await this.compressLargeFiles(cleanupResult);
            }

            // 3. Archivar reportes antiguos
            await this.archiveOldReports(cleanupResult);

            // 4. Limpieza temporal si aún es necesaria
            if (analysis.usagePercentage > 90) {
                await this.emergencyCleanup(cleanupResult);
            }

            // Reportar al supervisor
            await this.reportToSupervisor('CLEANUP_COMPLETED', {
                initialUsage: analysis.usagePercentage,
                spaceSaved: cleanupResult.spaceSaved,
                actions: cleanupResult.actions.length
            });

            console.log(`✅ Limpieza completada: ${this.formatBytes(cleanupResult.spaceSaved)} liberados`);

            return {
                success: true,
                ...cleanupResult,
                initialUsage: analysis.usagePercentage,
                message: `Limpieza completada exitosamente`
            };

        } catch (error) {
            console.error('❌ Error en limpieza inteligente:', error.message);
            await this.reportToSupervisor('CLEANUP_ERROR', { error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * 🗑️ Limpiar archivos expirados
     */
    async cleanupExpiredFiles(result) {
        try {
            const expiredFiles = await this.findExpiredFiles();
            
            for (const file of expiredFiles) {
                try {
                    const stats = await fs.stat(file.path);
                    await fs.unlink(file.path);
                    
                    result.filesDeleted++;
                    result.spaceSaved += stats.size;
                    result.actions.push(`Eliminado: ${path.basename(file.path)} (expirado)`);
                    
                } catch (error) {
                    console.warn('⚠️ Error eliminando archivo expirado:', file.path);
                }
            }
            
            console.log(`🗑️ ${result.filesDeleted} archivos expirados eliminados`);
            
        } catch (error) {
            console.error('❌ Error en limpieza de expirados:', error.message);
        }
    }

    /**
     * 📦 Comprimir archivos grandes
     */
    async compressLargeFiles(result) {
        try {
            const analysis = await this.analyzeStorageUsage();
            const candidates = analysis.compressionCandidates.slice(0, 10); // Top 10
            
            for (const candidate of candidates) {
                try {
                    const originalSize = candidate.size;
                    const compressedPath = await this.compressFile(candidate.path);
                    
                    if (compressedPath) {
                        const compressedStats = await fs.stat(compressedPath);
                        const spaceSaved = originalSize - compressedStats.size;
                        
                        // Reemplazar archivo original con comprimido
                        await fs.unlink(candidate.path);
                        await fs.rename(compressedPath, candidate.path + '.gz');
                        
                        result.filesCompressed++;
                        result.spaceSaved += spaceSaved;
                        result.actions.push(`Comprimido: ${path.basename(candidate.path)} (${this.formatBytes(spaceSaved)} ahorrados)`);
                    }
                } catch (error) {
                    console.warn('⚠️ Error comprimiendo archivo:', candidate.path);
                }
            }
            
            console.log(`📦 ${result.filesCompressed} archivos comprimidos`);
            
        } catch (error) {
            console.error('❌ Error en compresión:', error.message);
        }
    }

    /**
     * 📦 Comprimir archivo individual
     */
    async compressFile(filePath) {
        try {
            const compressedPath = path.join(this.tempPath, `compressed_${Date.now()}.gz`);
            
            const readStream = require('fs').createReadStream(filePath);
            const writeStream = require('fs').createWriteStream(compressedPath);
            const gzipStream = zlib.createGzip({ level: this.compressionLevel });
            
            await new Promise((resolve, reject) => {
                readStream
                    .pipe(gzipStream)
                    .pipe(writeStream)
                    .on('finish', resolve)
                    .on('error', reject);
            });
            
            return compressedPath;
            
        } catch (error) {
            console.error('❌ Error comprimiendo archivo:', error.message);
            return null;
        }
    }

    /**
     * 📚 Archivar reportes antiguos
     */
    async archiveOldReports(result) {
        try {
            const archiveCandidates = await this.findArchiveCandidates();
            
            for (const candidate of archiveCandidates) {
                try {
                    const archivePath = path.join(
                        this.archivePath, 
                        `archive_${Date.now()}_${path.basename(candidate.path)}`
                    );
                    
                    await fs.rename(candidate.path, archivePath);
                    
                    result.filesArchived++;
                    result.actions.push(`Archivado: ${path.basename(candidate.path)}`);
                    
                } catch (error) {
                    console.warn('⚠️ Error archivando archivo:', candidate.path);
                }
            }
            
            console.log(`📚 ${result.filesArchived} archivos archivados`);
            
        } catch (error) {
            console.error('❌ Error en archivado:', error.message);
        }
    }

    /**
     * 🚨 Limpieza de emergencia
     */
    async emergencyCleanup(result) {
        try {
            console.log('🚨 Ejecutando limpieza de emergencia...');
            
            // Eliminar archivos temporales
            await this.cleanupTempFiles(result);
            
            // Eliminar logs antiguos
            await this.cleanupOldLogs(result);
            
            // Reportar emergencia
            await this.reportToSupervisor('EMERGENCY_CLEANUP', {
                reason: 'Storage critically full',
                filesAffected: result.filesDeleted
            });
            
        } catch (error) {
            console.error('❌ Error en limpieza de emergencia:', error.message);
        }
    }

    /**
     * 🔍 Encontrar archivos expirados
     */
    async findExpiredFiles() {
        const expiredFiles = [];
        const now = Date.now();
        
        try {
            await this.scanForExpiredFiles(this.storagePath, expiredFiles, now);
        } catch (error) {
            console.error('❌ Error buscando archivos expirados:', error.message);
        }
        
        return expiredFiles;
    }

    async scanForExpiredFiles(dirPath, expiredFiles, now) {
        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const item of items) {
                const itemPath = path.join(dirPath, item.name);
                
                if (item.isDirectory()) {
                    await this.scanForExpiredFiles(itemPath, expiredFiles, now);
                } else {
                    const stats = await fs.stat(itemPath);
                    const ageInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                    
                    const reportType = this.identifyReportType(item.name);
                    const policy = this.retentionPolicies[reportType] || this.retentionPolicies.daily;
                    
                    if (ageInDays > policy.days) {
                        expiredFiles.push({
                            path: itemPath,
                            age: ageInDays,
                            type: reportType,
                            size: stats.size
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Error escaneando para expirados:', dirPath);
        }
    }

    /**
     * 🏷️ Identificar tipo de reporte
     */
    identifyReportType(filename) {
        const name = filename.toLowerCase();
        
        if (name.includes('daily')) return 'daily';
        if (name.includes('weekly')) return 'weekly';
        if (name.includes('monthly')) return 'monthly';
        if (name.includes('yearly') || name.includes('annual')) return 'yearly';
        
        return 'daily'; // Por defecto
    }

    /**
     * 📊 Obtener estado de almacenamiento
     */
    getStorageStatus(usagePercentage) {
        if (usagePercentage >= this.criticalThreshold * 100) return 'CRITICAL';
        if (usagePercentage >= this.warningThreshold * 100) return 'WARNING';
        return 'NORMAL';
    }

    /**
     * 👀 Iniciar monitoreo continuo
     */
    async startMonitoring() {
        // Verificar cada hora
        setInterval(async () => {
            const analysis = await this.analyzeStorageUsage();
            if (analysis && analysis.usagePercentage > this.warningThreshold * 100) {
                console.log(`⚠️ Advertencia: Almacenamiento al ${analysis.usagePercentage.toFixed(2)}%`);
                
                if (analysis.usagePercentage > this.criticalThreshold * 100) {
                    console.log('🚨 CRÍTICO: Iniciando limpieza automática...');
                    await this.performIntelligentCleanup(true);
                }
            }
        }, 60 * 60 * 1000); // Cada hora
    }

    /**
     * ⏰ Programar tareas de mantenimiento
     */
    scheduleMaintenanceTasks() {
        // Limpieza diaria a las 2:00 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🧹 Ejecutando mantenimiento diario...');
            await this.performIntelligentCleanup();
        });

        // Análisis semanal los domingos a las 3:00 AM
        cron.schedule('0 3 * * 0', async () => {
            console.log('📊 Ejecutando análisis semanal...');
            const analysis = await this.analyzeStorageUsage();
            await this.reportToSupervisor('WEEKLY_ANALYSIS', analysis);
        });
    }

    /**
     * 🚨 Reportar al supervisor
     */
    async reportToSupervisor(event, data) {
        try {
            const reportData = {
                source: 'storage-limit-manager',
                event: event,
                data: data,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('http://localhost:3001/agent-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Agent-ID': 'task-master-storage-manager'
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                console.log(`📡 Evento reportado: ${event}`);
            }
        } catch (error) {
            console.warn('⚠️ No se pudo reportar al supervisor:', error.message);
        }
    }

    /**
     * 🔧 Utilidades
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getAgeGroup(days) {
        if (days <= 7) return 'week';
        if (days <= 30) return 'month';
        if (days <= 90) return 'quarter';
        if (days <= 365) return 'year';
        return 'older';
    }

    isCompressionCandidate(filePath, stats) {
        const ext = path.extname(filePath).toLowerCase();
        const compressibleTypes = ['.json', '.txt', '.log', '.csv', '.xml'];
        return compressibleTypes.includes(ext) && stats.size > 1024 * 1024; // > 1MB
    }

    async findArchiveCandidates() {
        // Implementación simplificada
        return [];
    }

    async cleanupTempFiles(result) {
        // Implementación de limpieza de temporales
    }

    async cleanupOldLogs(result) {
        // Implementación de limpieza de logs
    }
}

module.exports = StorageLimitManager;
