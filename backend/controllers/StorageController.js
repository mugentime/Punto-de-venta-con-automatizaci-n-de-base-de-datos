/**
 * Controlador de Gestión de Almacenamiento - POS ConEJO NEGRO
 * 🔧 Reparación: API para límites de almacenamiento
 * 💾 TaskMaster: Storage Management REST API
 */

const StorageLimitManager = require('../services/StorageLimitManager');

class StorageController {
    constructor() {
        this.storageManager = new StorageLimitManager();
        console.log('🚀 TaskMaster: Storage Controller Inicializado');
    }

    /**
     * 📊 Obtener análisis de almacenamiento
     */
    async getStorageAnalysis(req, res) {
        try {
            console.log('📊 Obteniendo análisis de almacenamiento...');
            
            const analysis = await this.storageManager.analyzeStorageUsage();
            
            if (!analysis) {
                return res.status(500).json({
                    success: false,
                    error: 'No se pudo obtener el análisis de almacenamiento'
                });
            }

            // Enriquecer el análisis con recomendaciones
            const recommendations = this.generateRecommendations(analysis);
            
            res.json({
                success: true,
                data: {
                    ...analysis,
                    recommendations,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo análisis:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor'
            });
        }
    }

    /**
     * 🧹 Ejecutar limpieza manual
     */
    async performCleanup(req, res) {
        try {
            const { force = false, options = {} } = req.body;
            
            console.log(`🧹 Ejecutando limpieza manual${force ? ' (forzada)' : ''}...`);
            
            const result = await this.storageManager.performIntelligentCleanup(force);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Limpieza completada exitosamente',
                    data: {
                        filesDeleted: result.filesDeleted,
                        filesCompressed: result.filesCompressed,
                        filesArchived: result.filesArchived,
                        spaceSaved: this.storageManager.formatBytes(result.spaceSaved),
                        spaceSavedBytes: result.spaceSaved,
                        actions: result.actions,
                        initialUsage: result.initialUsage
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: result.error || 'Error ejecutando limpieza'
                });
            }

        } catch (error) {
            console.error('❌ Error ejecutando limpieza:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error interno ejecutando limpieza'
            });
        }
    }

    /**
     * ⚙️ Obtener configuración de almacenamiento
     */
    async getStorageConfig(req, res) {
        try {
            const config = {
                maxStorageSize: this.storageManager.maxStorageSize,
                maxStorageSizeFormatted: this.storageManager.formatBytes(this.storageManager.maxStorageSize * 1024 * 1024),
                warningThreshold: this.storageManager.warningThreshold,
                criticalThreshold: this.storageManager.criticalThreshold,
                retentionPolicies: this.storageManager.retentionPolicies,
                compressionLevel: this.storageManager.compressionLevel,
                paths: {
                    storage: this.storageManager.storagePath,
                    archive: this.storageManager.archivePath,
                    temp: this.storageManager.tempPath
                }
            };

            res.json({
                success: true,
                data: config
            });

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo configuración'
            });
        }
    }

    /**
     * ⚙️ Actualizar configuración de almacenamiento
     */
    async updateStorageConfig(req, res) {
        try {
            const {
                maxStorageSize,
                warningThreshold,
                criticalThreshold,
                retentionPolicies,
                compressionLevel
            } = req.body;

            // Validar y actualizar configuración
            if (maxStorageSize && maxStorageSize > 0) {
                this.storageManager.maxStorageSize = maxStorageSize;
            }

            if (warningThreshold && warningThreshold > 0 && warningThreshold < 1) {
                this.storageManager.warningThreshold = warningThreshold;
            }

            if (criticalThreshold && criticalThreshold > 0 && criticalThreshold < 1) {
                this.storageManager.criticalThreshold = criticalThreshold;
            }

            if (retentionPolicies) {
                // Validar políticas de retención
                for (const [type, policy] of Object.entries(retentionPolicies)) {
                    if (policy.days && policy.days > 0) {
                        this.storageManager.retentionPolicies[type] = policy;
                    }
                }
            }

            if (compressionLevel && compressionLevel >= 1 && compressionLevel <= 9) {
                this.storageManager.compressionLevel = compressionLevel;
            }

            // Reportar cambios al supervisor
            await this.storageManager.reportToSupervisor('CONFIG_UPDATED', {
                maxStorageSize: this.storageManager.maxStorageSize,
                warningThreshold: this.storageManager.warningThreshold,
                criticalThreshold: this.storageManager.criticalThreshold
            });

            res.json({
                success: true,
                message: 'Configuración actualizada exitosamente',
                data: {
                    maxStorageSize: this.storageManager.maxStorageSize,
                    warningThreshold: this.storageManager.warningThreshold,
                    criticalThreshold: this.storageManager.criticalThreshold
                }
            });

        } catch (error) {
            console.error('❌ Error actualizando configuración:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error actualizando configuración'
            });
        }
    }

    /**
     * 📈 Obtener métricas de rendimiento
     */
    async getStorageMetrics(req, res) {
        try {
            const { period = '24h' } = req.query;
            
            // Generar métricas simuladas basadas en el análisis actual
            const analysis = await this.storageManager.analyzeStorageUsage();
            
            if (!analysis) {
                return res.status(500).json({
                    success: false,
                    error: 'No se pudieron obtener métricas'
                });
            }

            const metrics = {
                currentUsage: {
                    percentage: analysis.usagePercentage,
                    totalSize: analysis.totalSize,
                    totalSizeFormatted: this.storageManager.formatBytes(analysis.totalSize),
                    fileCount: analysis.fileCount,
                    status: analysis.status
                },
                trends: {
                    period: period,
                    growthRate: this.calculateGrowthRate(analysis),
                    avgDailyGrowth: this.storageManager.formatBytes(Math.random() * 10 * 1024 * 1024), // Simulado
                    cleanupFrequency: this.getCleanupFrequency()
                },
                breakdown: {
                    byType: analysis.filesByType,
                    byAge: analysis.filesByAge,
                    largestFiles: analysis.largestFiles.slice(0, 5).map(file => ({
                        name: require('path').basename(file.path),
                        size: this.storageManager.formatBytes(file.size),
                        age: Math.floor((Date.now() - file.mtime.getTime()) / (1000 * 60 * 60 * 24))
                    }))
                },
                thresholds: {
                    warning: this.storageManager.warningThreshold * 100,
                    critical: this.storageManager.criticalThreshold * 100,
                    maxSize: this.storageManager.formatBytes(this.storageManager.maxStorageSize * 1024 * 1024)
                }
            };

            res.json({
                success: true,
                data: metrics,
                generatedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error('❌ Error obteniendo métricas:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo métricas'
            });
        }
    }

    /**
     * 🗂️ Obtener lista de archivos para gestión
     */
    async getFilesList(req, res) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                sortBy = 'size', 
                order = 'desc',
                filter = 'all'
            } = req.query;

            const analysis = await this.storageManager.analyzeStorageUsage();
            if (!analysis) {
                return res.status(500).json({
                    success: false,
                    error: 'No se pudo obtener lista de archivos'
                });
            }

            // Combinar todos los archivos
            let allFiles = [
                ...analysis.largestFiles.map(f => ({ ...f, category: 'large' })),
                ...analysis.oldestFiles.map(f => ({ ...f, category: 'old' })),
                ...analysis.compressionCandidates.map(f => ({ ...f, category: 'compressible' }))
            ];

            // Eliminar duplicados
            const uniqueFiles = allFiles.reduce((acc, current) => {
                const exists = acc.find(f => f.path === current.path);
                if (!exists) acc.push(current);
                return acc;
            }, []);

            // Filtrar
            if (filter !== 'all') {
                uniqueFiles = uniqueFiles.filter(f => f.category === filter);
            }

            // Ordenar
            uniqueFiles.sort((a, b) => {
                if (sortBy === 'size') {
                    return order === 'desc' ? b.size - a.size : a.size - b.size;
                } else if (sortBy === 'age') {
                    const ageA = a.age || Math.floor((Date.now() - a.mtime?.getTime() || Date.now()) / (1000 * 60 * 60 * 24));
                    const ageB = b.age || Math.floor((Date.now() - b.mtime?.getTime() || Date.now()) / (1000 * 60 * 60 * 24));
                    return order === 'desc' ? ageB - ageA : ageA - ageB;
                }
                return 0;
            });

            // Paginación
            const startIndex = (page - 1) * limit;
            const paginatedFiles = uniqueFiles.slice(startIndex, startIndex + parseInt(limit));

            const fileList = paginatedFiles.map(file => ({
                name: require('path').basename(file.path),
                path: file.path,
                size: this.storageManager.formatBytes(file.size),
                sizeBytes: file.size,
                age: file.age || Math.floor((Date.now() - (file.mtime?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)),
                category: file.category,
                canCompress: file.category === 'compressible',
                estimatedSavings: file.estimatedSavings ? this.storageManager.formatBytes(file.estimatedSavings) : null
            }));

            res.json({
                success: true,
                data: {
                    files: fileList,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: uniqueFiles.length,
                        totalPages: Math.ceil(uniqueFiles.length / limit)
                    },
                    filters: {
                        sortBy,
                        order,
                        filter
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo lista de archivos:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo lista de archivos'
            });
        }
    }

    /**
     * 🗑️ Eliminar archivos específicos
     */
    async deleteFiles(req, res) {
        try {
            const { filePaths } = req.body;
            
            if (!Array.isArray(filePaths) || filePaths.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Se requiere una lista de rutas de archivos'
                });
            }

            const results = {
                deleted: [],
                failed: [],
                totalSpaceSaved: 0
            };

            for (const filePath of filePaths) {
                try {
                    const fs = require('fs').promises;
                    const stats = await fs.stat(filePath);
                    await fs.unlink(filePath);
                    
                    results.deleted.push({
                        path: filePath,
                        size: this.storageManager.formatBytes(stats.size)
                    });
                    results.totalSpaceSaved += stats.size;
                } catch (error) {
                    results.failed.push({
                        path: filePath,
                        error: error.message
                    });
                }
            }

            // Reportar al supervisor
            await this.storageManager.reportToSupervisor('MANUAL_FILE_DELETION', {
                filesDeleted: results.deleted.length,
                filesFailed: results.failed.length,
                spaceSaved: results.totalSpaceSaved
            });

            res.json({
                success: true,
                message: `${results.deleted.length} archivos eliminados exitosamente`,
                data: {
                    ...results,
                    totalSpaceSavedFormatted: this.storageManager.formatBytes(results.totalSpaceSaved)
                }
            });

        } catch (error) {
            console.error('❌ Error eliminando archivos:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error eliminando archivos'
            });
        }
    }

    /**
     * 💡 Generar recomendaciones
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.usagePercentage > 95) {
            recommendations.push({
                priority: 'HIGH',
                type: 'CLEANUP_URGENT',
                message: 'Almacenamiento crítico - Se requiere limpieza inmediata',
                action: 'Ejecutar limpieza forzada'
            });
        } else if (analysis.usagePercentage > 80) {
            recommendations.push({
                priority: 'MEDIUM',
                type: 'CLEANUP_NEEDED',
                message: 'Almacenamiento en nivel de advertencia',
                action: 'Programar limpieza en las próximas horas'
            });
        }

        if (analysis.compressionCandidates.length > 0) {
            const totalSavings = analysis.compressionCandidates.reduce((sum, f) => sum + f.estimatedSavings, 0);
            recommendations.push({
                priority: 'MEDIUM',
                type: 'COMPRESSION',
                message: `${analysis.compressionCandidates.length} archivos pueden comprimirse`,
                action: `Posible ahorro: ${this.storageManager.formatBytes(totalSavings)}`
            });
        }

        if (analysis.oldestFiles.length > 0) {
            const oldFiles = analysis.oldestFiles.filter(f => f.age > 90);
            if (oldFiles.length > 0) {
                recommendations.push({
                    priority: 'LOW',
                    type: 'ARCHIVING',
                    message: `${oldFiles.length} archivos antiguos pueden archivarse`,
                    action: 'Considerar mover a archivo'
                });
            }
        }

        return recommendations;
    }

    /**
     * 📈 Calcular tasa de crecimiento
     */
    calculateGrowthRate(analysis) {
        // Simulación basada en el uso actual
        const baseRate = analysis.usagePercentage * 0.1;
        return Math.max(0.1, Math.min(5, baseRate)).toFixed(2) + '% diario';
    }

    /**
     * 🧹 Obtener frecuencia de limpieza
     */
    getCleanupFrequency() {
        return {
            automatic: 'Diario a las 2:00 AM',
            lastCleanup: 'Hace 6 horas', // Simulado
            nextCleanup: 'En 18 horas'   // Simulado
        };
    }
}

module.exports = StorageController;
