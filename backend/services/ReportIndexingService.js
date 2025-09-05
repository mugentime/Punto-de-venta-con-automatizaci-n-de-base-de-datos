/**
 * Sistema de Indexación de Reportes - POS ConEJO NEGRO
 * 🔧 Reparación: Lentitud en reportes e indexación
 * 📊 TaskMaster: Advanced Report Processing & Indexing System
 */

const { Client } = require('@elastic/elasticsearch');
const fs = require('fs').promises;
const path = require('path');

class ReportIndexingService {
    constructor() {
        this.client = new Client({ 
            node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
            requestTimeout: 30000,
            pingTimeout: 3000
        });
        
        this.indexName = 'pos-reports';
        this.initializeIndex();
        
        console.log('🔍 TaskMaster: Sistema de Indexación de Reportes Inicializado');
    }

    /**
     * 🏗️ Inicializar índice de ElasticSearch
     */
    async initializeIndex() {
        try {
            const indexExists = await this.client.indices.exists({
                index: this.indexName
            });

            if (!indexExists.body) {
                await this.createIndex();
                console.log('✅ Índice de reportes creado exitosamente');
            } else {
                console.log('📋 Índice de reportes ya existe - verificando mapping...');
                await this.updateMappingIfNeeded();
            }

        } catch (error) {
            console.error('❌ Error inicializando índice:', error.message);
            // Fallback a sistema de archivos si ElasticSearch no está disponible
            await this.initializeFileSystemFallback();
        }
    }

    /**
     * 🗂️ Crear índice con mapping optimizado
     */
    async createIndex() {
        const mapping = {
            mappings: {
                properties: {
                    reportId: { type: 'keyword' },
                    reportType: { type: 'keyword' },
                    dateGenerated: { type: 'date' },
                    dateRange: {
                        properties: {
                            start: { type: 'date' },
                            end: { type: 'date' }
                        }
                    },
                    totalSales: { type: 'float' },
                    transactionCount: { type: 'integer' },
                    averageTicket: { type: 'float' },
                    topProducts: {
                        type: 'nested',
                        properties: {
                            productId: { type: 'keyword' },
                            productName: { type: 'text' },
                            quantity: { type: 'integer' },
                            revenue: { type: 'float' }
                        }
                    },
                    cashierStats: {
                        type: 'nested',
                        properties: {
                            cashierId: { type: 'keyword' },
                            cashierName: { type: 'text' },
                            sales: { type: 'float' },
                            transactions: { type: 'integer' }
                        }
                    },
                    paymentMethods: {
                        properties: {
                            cash: { type: 'float' },
                            card: { type: 'float' },
                            transfer: { type: 'float' }
                        }
                    },
                    content: { type: 'text', analyzer: 'spanish' },
                    tags: { type: 'keyword' },
                    status: { type: 'keyword' },
                    filePath: { type: 'keyword' },
                    fileSize: { type: 'integer' }
                }
            },
            settings: {
                number_of_shards: 1,
                number_of_replicas: 0,
                analysis: {
                    analyzer: {
                        spanish: {
                            tokenizer: 'standard',
                            filter: ['lowercase', 'stop']
                        }
                    }
                }
            }
        };

        await this.client.indices.create({
            index: this.indexName,
            body: mapping
        });
    }

    /**
     * 📊 Indexar reporte completo
     */
    async indexReport(reportData) {
        try {
            const document = {
                ...reportData,
                dateGenerated: new Date(),
                averageTicket: reportData.totalSales / (reportData.transactionCount || 1),
                tags: this.generateTags(reportData),
                status: 'indexed'
            };

            const response = await this.client.index({
                index: this.indexName,
                id: reportData.reportId,
                body: document
            });

            console.log(`✅ Reporte indexado: ${reportData.reportId}`);
            
            // Reportar al supervisor
            await this.reportToSupervisor('REPORT_INDEXED', reportData.reportId);
            
            return response.body;

        } catch (error) {
            console.error('❌ Error indexando reporte:', error.message);
            
            // Fallback a sistema de archivos
            await this.indexToFileSystem(reportData);
            
            // Reportar error al supervisor
            await this.reportToSupervisor('INDEXING_ERROR', error.message);
            throw error;
        }
    }

    /**
     * 🔍 Búsqueda optimizada de reportes
     */
    async searchReports(query, filters = {}) {
        try {
            const searchBody = {
                query: {
                    bool: {
                        must: [],
                        filter: []
                    }
                },
                sort: [
                    { dateGenerated: { order: 'desc' } }
                ],
                size: filters.limit || 50,
                from: filters.offset || 0
            };

            // Búsqueda por texto
            if (query) {
                searchBody.query.bool.must.push({
                    multi_match: {
                        query: query,
                        fields: ['content', 'reportType', 'topProducts.productName'],
                        analyzer: 'spanish'
                    }
                });
            }

            // Filtros por fecha
            if (filters.dateFrom || filters.dateTo) {
                const dateRange = {};
                if (filters.dateFrom) dateRange.gte = filters.dateFrom;
                if (filters.dateTo) dateRange.lte = filters.dateTo;
                
                searchBody.query.bool.filter.push({
                    range: { dateGenerated: dateRange }
                });
            }

            // Filtros por tipo de reporte
            if (filters.reportType) {
                searchBody.query.bool.filter.push({
                    term: { reportType: filters.reportType }
                });
            }

            const response = await this.client.search({
                index: this.indexName,
                body: searchBody
            });

            console.log(`🔍 Búsqueda ejecutada: ${response.body.hits.total.value} resultados`);
            
            return {
                total: response.body.hits.total.value,
                reports: response.body.hits.hits.map(hit => ({
                    id: hit._id,
                    score: hit._score,
                    ...hit._source
                }))
            };

        } catch (error) {
            console.error('❌ Error en búsqueda:', error.message);
            
            // Fallback a búsqueda por archivos
            return await this.searchFileSystem(query, filters);
        }
    }

    /**
     * 📈 Generar agregaciones de reportes
     */
    async generateAggregations(dateRange) {
        try {
            const response = await this.client.search({
                index: this.indexName,
                body: {
                    query: {
                        range: {
                            dateGenerated: {
                                gte: dateRange.start,
                                lte: dateRange.end
                            }
                        }
                    },
                    size: 0,
                    aggs: {
                        sales_over_time: {
                            date_histogram: {
                                field: 'dateGenerated',
                                calendar_interval: 'day'
                            },
                            aggs: {
                                total_sales: { sum: { field: 'totalSales' } },
                                avg_ticket: { avg: { field: 'averageTicket' } }
                            }
                        },
                        top_products: {
                            nested: { path: 'topProducts' },
                            aggs: {
                                products: {
                                    terms: { 
                                        field: 'topProducts.productName.keyword',
                                        size: 10
                                    },
                                    aggs: {
                                        total_revenue: { sum: { field: 'topProducts.revenue' } }
                                    }
                                }
                            }
                        },
                        payment_methods: {
                            terms: { field: 'paymentMethods' }
                        }
                    }
                }
            });

            return response.body.aggregations;

        } catch (error) {
            console.error('❌ Error generando agregaciones:', error.message);
            return null;
        }
    }

    /**
     * 🏷️ Generar tags para categorización
     */
    generateTags(reportData) {
        const tags = [reportData.reportType];
        
        if (reportData.totalSales > 10000) tags.push('high-sales');
        if (reportData.transactionCount > 100) tags.push('high-volume');
        if (reportData.dateRange) {
            const days = Math.ceil((new Date(reportData.dateRange.end) - new Date(reportData.dateRange.start)) / (1000 * 60 * 60 * 24));
            if (days === 1) tags.push('daily');
            if (days === 7) tags.push('weekly');
            if (days >= 30) tags.push('monthly');
        }
        
        return tags;
    }

    /**
     * 📁 Sistema de archivos como fallback
     */
    async initializeFileSystemFallback() {
        const indexDir = path.join(__dirname, '..', '..', 'data', 'report-index');
        await fs.mkdir(indexDir, { recursive: true });
        this.indexDir = indexDir;
        console.log('📁 Sistema de archivos inicializado como fallback');
    }

    async indexToFileSystem(reportData) {
        if (!this.indexDir) await this.initializeFileSystemFallback();
        
        const filePath = path.join(this.indexDir, `${reportData.reportId}.json`);
        await fs.writeFile(filePath, JSON.stringify({
            ...reportData,
            dateGenerated: new Date(),
            indexed: true
        }, null, 2));
        
        console.log(`📁 Reporte guardado en sistema de archivos: ${reportData.reportId}`);
    }

    async searchFileSystem(query, filters) {
        if (!this.indexDir) return { total: 0, reports: [] };
        
        try {
            const files = await fs.readdir(this.indexDir);
            const reports = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.readFile(path.join(this.indexDir, file), 'utf8');
                    const report = JSON.parse(content);
                    
                    // Aplicar filtros básicos
                    if (this.matchesFilters(report, query, filters)) {
                        reports.push(report);
                    }
                }
            }
            
            return {
                total: reports.length,
                reports: reports.slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50))
            };
            
        } catch (error) {
            console.error('❌ Error buscando en sistema de archivos:', error.message);
            return { total: 0, reports: [] };
        }
    }

    matchesFilters(report, query, filters) {
        // Implementación básica de filtrado
        if (query && !JSON.stringify(report).toLowerCase().includes(query.toLowerCase())) {
            return false;
        }
        
        if (filters.reportType && report.reportType !== filters.reportType) {
            return false;
        }
        
        return true;
    }

    /**
     * 🚨 Reportar al supervisor
     */
    async reportToSupervisor(action, data) {
        try {
            const reportData = {
                source: 'report-indexing-service',
                action: action,
                data: data,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('http://localhost:3001/agent-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Agent-ID': 'task-master-report-indexer'
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                console.log('📡 Reporte enviado al supervisor');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo contactar al supervisor:', error.message);
        }
    }

    /**
     * 🧹 Limpieza de índices antiguos
     */
    async cleanupOldReports(daysToKeep = 365) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const response = await this.client.deleteByQuery({
                index: this.indexName,
                body: {
                    query: {
                        range: {
                            dateGenerated: {
                                lt: cutoffDate.toISOString()
                            }
                        }
                    }
                }
            });

            console.log(`🧹 Limpieza completada: ${response.body.deleted} reportes eliminados`);
            return response.body.deleted;

        } catch (error) {
            console.error('❌ Error en limpieza:', error.message);
            return 0;
        }
    }
}

module.exports = ReportIndexingService;
