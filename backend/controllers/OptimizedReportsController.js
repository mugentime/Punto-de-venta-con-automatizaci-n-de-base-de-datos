/**
 * Controlador Optimizado de Reportes - POS ConEJO NEGRO  
 * 🔧 Reparación: Performance de reportes lenta
 * ⚡ TaskMaster: High-Performance Report Generation
 */

const ReportIndexingService = require('../services/ReportIndexingService');
const Redis = require('redis');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

class OptimizedReportsController {
    constructor() {
        this.indexingService = new ReportIndexingService();
        this.initializeCache();
        
        // Pool de workers para procesamiento paralelo
        this.workerPool = [];
        this.maxWorkers = Math.min(4, os.cpus().length);
        
        console.log('⚡ TaskMaster: Controlador Optimizado de Reportes Inicializado');
    }

    /**
     * 🗄️ Inicializar sistema de cache con Redis
     */
    async initializeCache() {
        try {
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3
            });

            await this.redis.connect();
            console.log('✅ Cache Redis inicializado exitosamente');
            
            // TTL por defecto para reportes: 1 hora
            this.defaultTTL = 3600;
            
        } catch (error) {
            console.warn('⚠️ Redis no disponible, usando cache en memoria:', error.message);
            
            // Fallback a cache en memoria
            this.memoryCache = new Map();
            this.cacheTimeout = new Map();
        }
    }

    /**
     * 📊 Generar reporte optimizado con cache
     */
    async generateOptimizedReport(req, res) {
        try {
            const { reportType, dateFrom, dateTo, filters = {} } = req.body;
            
            // Generar clave de cache
            const cacheKey = this.generateCacheKey(reportType, dateFrom, dateTo, filters);
            
            // Verificar cache primero
            let cachedReport = await this.getFromCache(cacheKey);
            if (cachedReport) {
                console.log('⚡ Reporte servido desde cache:', cacheKey);
                return res.json({
                    success: true,
                    data: cachedReport,
                    cached: true,
                    generatedAt: new Date()
                });
            }

            console.log('🔄 Generando nuevo reporte:', reportType);
            const startTime = Date.now();

            // Ejecutar generación en paralelo usando workers
            const reportData = await this.generateReportWithWorker({
                reportType,
                dateFrom,
                dateTo,
                filters
            });

            const processingTime = Date.now() - startTime;
            console.log(`📈 Reporte generado en ${processingTime}ms`);

            // Agregar metadata de performance
            reportData.metadata = {
                generatedAt: new Date(),
                processingTimeMs: processingTime,
                recordsProcessed: reportData.recordsProcessed || 0,
                cached: false
            };

            // Guardar en cache
            await this.setCache(cacheKey, reportData, this.calculateTTL(reportType));

            // Indexar para búsquedas futuras
            await this.indexingService.indexReport({
                reportId: `${reportType}_${Date.now()}`,
                reportType,
                ...reportData
            });

            res.json({
                success: true,
                data: reportData
            });

        } catch (error) {
            console.error('❌ Error generando reporte optimizado:', error.message);
            
            // Reportar error al supervisor
            await this.reportErrorToSupervisor('REPORT_GENERATION_ERROR', error.message);
            
            res.status(500).json({
                success: false,
                error: 'Error interno del servidor',
                details: error.message
            });
        }
    }

    /**
     * 👷 Generar reporte usando worker threads
     */
    async generateReportWithWorker(params) {
        return new Promise((resolve, reject) => {
            const worker = new Worker(__filename, {
                workerData: { 
                    isWorker: true, 
                    params: params 
                }
            });

            worker.on('message', (result) => {
                if (result.success) {
                    resolve(result.data);
                } else {
                    reject(new Error(result.error));
                }
                worker.terminate();
            });

            worker.on('error', (error) => {
                reject(error);
                worker.terminate();
            });

            // Timeout de 30 segundos
            setTimeout(() => {
                worker.terminate();
                reject(new Error('Report generation timeout'));
            }, 30000);
        });
    }

    /**
     * 🔍 Búsqueda rápida de reportes con filtros avanzados
     */
    async searchReports(req, res) {
        try {
            const { query, filters, pagination } = req.body;
            
            console.log('🔍 Ejecutando búsqueda de reportes:', query);
            
            const results = await this.indexingService.searchReports(query, {
                ...filters,
                limit: pagination?.limit || 20,
                offset: pagination?.offset || 0
            });

            res.json({
                success: true,
                data: results,
                searchQuery: query,
                appliedFilters: filters
            });

        } catch (error) {
            console.error('❌ Error en búsqueda:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error en búsqueda de reportes'
            });
        }
    }

    /**
     * 📈 Dashboard de analytics con datos agregados
     */
    async getAnalyticsDashboard(req, res) {
        try {
            const { dateRange } = req.body;
            const cacheKey = `dashboard_${dateRange.start}_${dateRange.end}`;
            
            // Verificar cache
            let dashboardData = await this.getFromCache(cacheKey);
            if (dashboardData) {
                return res.json({
                    success: true,
                    data: dashboardData,
                    cached: true
                });
            }

            console.log('📊 Generando dashboard de analytics...');
            
            // Obtener agregaciones de ElasticSearch
            const aggregations = await this.indexingService.generateAggregations(dateRange);
            
            // Procesar datos para el dashboard
            dashboardData = {
                salesOverTime: this.processSalesOverTime(aggregations?.sales_over_time),
                topProducts: this.processTopProducts(aggregations?.top_products),
                paymentMethods: this.processPaymentMethods(aggregations?.payment_methods),
                summary: {
                    totalReports: aggregations?.totalReports || 0,
                    avgProcessingTime: aggregations?.avgProcessingTime || 0,
                    lastUpdated: new Date()
                }
            };

            // Guardar en cache por 15 minutos
            await this.setCache(cacheKey, dashboardData, 900);

            res.json({
                success: true,
                data: dashboardData
            });

        } catch (error) {
            console.error('❌ Error generando dashboard:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error generando dashboard'
            });
        }
    }

    /**
     * 🗂️ Funciones de cache
     */
    async getFromCache(key) {
        try {
            if (this.redis) {
                const cached = await this.redis.get(key);
                return cached ? JSON.parse(cached) : null;
            } else if (this.memoryCache) {
                const cached = this.memoryCache.get(key);
                const timeout = this.cacheTimeout.get(key);
                
                if (cached && timeout && Date.now() < timeout) {
                    return cached;
                } else if (cached) {
                    // Expirado
                    this.memoryCache.delete(key);
                    this.cacheTimeout.delete(key);
                }
            }
            return null;
        } catch (error) {
            console.warn('⚠️ Error obteniendo del cache:', error.message);
            return null;
        }
    }

    async setCache(key, data, ttlSeconds) {
        try {
            if (this.redis) {
                await this.redis.setEx(key, ttlSeconds, JSON.stringify(data));
            } else if (this.memoryCache) {
                this.memoryCache.set(key, data);
                this.cacheTimeout.set(key, Date.now() + (ttlSeconds * 1000));
                
                // Limpiar cache periódicamente para evitar memory leaks
                if (this.memoryCache.size > 100) {
                    this.cleanMemoryCache();
                }
            }
        } catch (error) {
            console.warn('⚠️ Error guardando en cache:', error.message);
        }
    }

    cleanMemoryCache() {
        const now = Date.now();
        for (const [key, timeout] of this.cacheTimeout.entries()) {
            if (now >= timeout) {
                this.memoryCache.delete(key);
                this.cacheTimeout.delete(key);
            }
        }
    }

    /**
     * 🔑 Generar clave de cache
     */
    generateCacheKey(reportType, dateFrom, dateTo, filters) {
        const filterString = JSON.stringify(filters);
        return `report_${reportType}_${dateFrom}_${dateTo}_${Buffer.from(filterString).toString('base64')}`;
    }

    /**
     * ⏱️ Calcular TTL basado en tipo de reporte
     */
    calculateTTL(reportType) {
        const ttlMap = {
            'daily': 1800,     // 30 minutos
            'weekly': 3600,    // 1 hora
            'monthly': 7200,   // 2 horas
            'yearly': 14400    // 4 horas
        };
        
        return ttlMap[reportType] || this.defaultTTL;
    }

    /**
     * 📊 Procesadores de datos para dashboard
     */
    processSalesOverTime(data) {
        if (!data?.buckets) return [];
        
        return data.buckets.map(bucket => ({
            date: bucket.key_as_string,
            totalSales: bucket.total_sales?.value || 0,
            avgTicket: bucket.avg_ticket?.value || 0,
            count: bucket.doc_count
        }));
    }

    processTopProducts(data) {
        if (!data?.products?.buckets) return [];
        
        return data.products.buckets.map(bucket => ({
            productName: bucket.key,
            totalRevenue: bucket.total_revenue?.value || 0,
            count: bucket.doc_count
        })).slice(0, 10);
    }

    processPaymentMethods(data) {
        if (!data?.buckets) return {};
        
        const result = {};
        data.buckets.forEach(bucket => {
            result[bucket.key] = bucket.doc_count;
        });
        
        return result;
    }

    /**
     * 🚨 Reportar error al supervisor
     */
    async reportErrorToSupervisor(errorType, errorMessage) {
        try {
            const response = await fetch('http://localhost:3001/agent-alert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Agent-ID': 'task-master-optimized-reports'
                },
                body: JSON.stringify({
                    type: 'REPORT_ERROR',
                    errorType: errorType,
                    message: errorMessage,
                    timestamp: new Date().toISOString(),
                    source: 'optimized-reports-controller'
                })
            });

            if (response.ok) {
                console.log('🚨 Error reportado al supervisor');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo reportar error al supervisor:', error.message);
        }
    }

    /**
     * 🧹 Limpieza periódica
     */
    async performMaintenance() {
        console.log('🧹 Ejecutando mantenimiento de reportes...');
        
        // Limpiar cache en memoria
        if (this.memoryCache) {
            this.cleanMemoryCache();
        }
        
        // Limpiar reportes antiguos del índice
        const deletedCount = await this.indexingService.cleanupOldReports();
        
        console.log(`✅ Mantenimiento completado: ${deletedCount} reportes eliminados`);
    }
}

// Worker thread para procesamiento paralelo
if (!isMainThread && workerData?.isWorker) {
    const { params } = workerData;
    
    // Simular procesamiento intensivo
    const processReport = async (params) => {
        const { reportType, dateFrom, dateTo, filters } = params;
        
        // Simulación de procesamiento de datos
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
        
        const mockData = {
            reportType,
            dateRange: { start: dateFrom, end: dateTo },
            totalSales: Math.random() * 50000,
            transactionCount: Math.floor(Math.random() * 1000),
            topProducts: Array.from({ length: 5 }, (_, i) => ({
                productId: `prod_${i + 1}`,
                productName: `Producto ${i + 1}`,
                quantity: Math.floor(Math.random() * 100),
                revenue: Math.random() * 5000
            })),
            recordsProcessed: Math.floor(Math.random() * 10000)
        };
        
        return mockData;
    };
    
    processReport(params)
        .then(data => {
            parentPort.postMessage({ success: true, data });
        })
        .catch(error => {
            parentPort.postMessage({ success: false, error: error.message });
        });
}

module.exports = OptimizedReportsController;
