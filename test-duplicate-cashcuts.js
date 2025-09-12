/**
 * Script para reproducir el problema de duplicación de cortes de caja
 * 🔧 Task Master: Diagnostic Script for Duplicate Cash Cuts
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class DuplicateCashCutTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.testResults = [];
        this.correlationId = Date.now().toString();
    }

    async initialize() {
        console.log('🔧 Task Master: Iniciando pruebas de duplicación de cortes de caja');
        console.log(`📋 Correlation ID: ${this.correlationId}`);
        
        // Verificar que el servidor esté corriendo
        try {
            const response = await axios.get(`${this.baseUrl}/health`);
            console.log('✅ Servidor POS disponible');
        } catch (error) {
            console.log('⚠️ Servidor no responde, intentando conexión directa...');
        }
    }

    async testSequentialDuplicates() {
        console.log('\n🔄 Prueba 1: Envío secuencial de cortes idénticos');
        
        const testPayload = {
            cashierId: 'test-cashier-123',
            sessionId: `test-session-${this.correlationId}`,
            cashData: {
                totalCash: 1500.00,
                salesTotal: 800.00,
                initialCash: 700.00
            },
            notes: `Prueba duplicados - ${new Date().toISOString()}`,
            timestamp: new Date().toISOString()
        };

        // Simular autenticación (agregar token si es necesario)
        const headers = {
            'Content-Type': 'application/json',
            'X-Correlation-ID': this.correlationId
        };

        try {
            console.log('📤 Enviando primera solicitud...');
            const response1 = await axios.post(
                `${this.baseUrl}/api/cashcuts/manual`, 
                testPayload, 
                { headers }
            );
            
            console.log('📤 Enviando segunda solicitud idéntica...');
            const response2 = await axios.post(
                `${this.baseUrl}/api/cashcuts/manual`, 
                testPayload, 
                { headers: { ...headers, 'X-Correlation-ID': this.correlationId + '-dup' } }
            );

            this.testResults.push({
                test: 'sequential_duplicates',
                response1: {
                    status: response1.status,
                    cashCutId: response1.data?.cashCut?.id,
                    totalIncome: response1.data?.cashCut?.totalIncome
                },
                response2: {
                    status: response2.status,
                    cashCutId: response2.data?.cashCut?.id,
                    totalIncome: response2.data?.cashCut?.totalIncome
                },
                isDuplicate: response1.data?.cashCut?.id !== response2.data?.cashCut?.id,
                hasZeroAmounts: response2.data?.cashCut?.totalIncome === 0
            });

            console.log(`✅ Primera respuesta: ID=${response1.data?.cashCut?.id}, Income=$${response1.data?.cashCut?.totalIncome}`);
            console.log(`✅ Segunda respuesta: ID=${response2.data?.cashCut?.id}, Income=$${response2.data?.cashCut?.totalIncome}`);
            
        } catch (error) {
            console.error('❌ Error en prueba secuencial:', error.message);
            this.testResults.push({
                test: 'sequential_duplicates',
                error: error.message,
                response: error.response?.data
            });
        }
    }

    async testConcurrentDuplicates() {
        console.log('\n🔄 Prueba 2: Envío concurrente de cortes idénticos (10 solicitudes)');
        
        const testPayload = {
            cashierId: 'test-cashier-concurrent',
            sessionId: `concurrent-session-${this.correlationId}`,
            cashData: {
                totalCash: 2000.00,
                salesTotal: 1200.00,
                initialCash: 800.00
            },
            notes: `Prueba concurrente - ${new Date().toISOString()}`,
            timestamp: new Date().toISOString()
        };

        const headers = {
            'Content-Type': 'application/json',
            'X-Correlation-ID': `concurrent-${this.correlationId}`
        };

        try {
            // Crear 10 solicitudes concurrentes
            const promises = Array.from({ length: 10 }, (_, index) => 
                axios.post(
                    `${this.baseUrl}/api/cashcuts/manual`, 
                    testPayload, 
                    { headers: { ...headers, 'X-Request-Index': index.toString() } }
                ).catch(error => ({ error: true, message: error.message, index }))
            );

            console.log('📤 Enviando 10 solicitudes concurrentes...');
            const responses = await Promise.all(promises);
            
            const successful = responses.filter(r => !r.error);
            const failed = responses.filter(r => r.error);
            
            const uniqueIds = new Set();
            const zeroAmountResponses = [];
            
            successful.forEach((response, index) => {
                const cashCutId = response.data?.cashCut?.id;
                const totalIncome = response.data?.cashCut?.totalIncome;
                
                if (cashCutId) uniqueIds.add(cashCutId);
                if (totalIncome === 0) zeroAmountResponses.push({ index, id: cashCutId });
            });

            this.testResults.push({
                test: 'concurrent_duplicates',
                totalRequests: 10,
                successful: successful.length,
                failed: failed.length,
                uniqueCashCuts: uniqueIds.size,
                zeroAmountResponses: zeroAmountResponses.length,
                duplicatesCreated: successful.length - uniqueIds.size,
                details: {
                    uniqueIds: Array.from(uniqueIds),
                    zeroAmountResponses,
                    failedRequests: failed.map(f => f.message)
                }
            });

            console.log(`✅ Solicitudes exitosas: ${successful.length}/10`);
            console.log(`📊 Cortes únicos creados: ${uniqueIds.size}`);
            console.log(`⚠️ Duplicados creados: ${successful.length - uniqueIds.size}`);
            console.log(`❌ Respuestas con montos en cero: ${zeroAmountResponses.length}`);

        } catch (error) {
            console.error('❌ Error en prueba concurrente:', error.message);
            this.testResults.push({
                test: 'concurrent_duplicates',
                error: error.message
            });
        }
    }

    async checkDatabaseState() {
        console.log('\n🔍 Verificando estado de la base de datos...');
        
        try {
            // Leer archivos de datos directamente
            const cashCutsPath = path.join(__dirname, 'data', 'cashcuts.json');
            const cashCutsData = await fs.readFile(cashCutsPath, 'utf8');
            const cashCuts = JSON.parse(cashCutsData);
            
            // Buscar duplicados recientes (últimos 5 minutos)
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            const recentCuts = cashCuts.filter(cut => 
                new Date(cut.createdAt) >= fiveMinutesAgo
            );
            
            // Agrupar por características similares
            const groups = {};
            recentCuts.forEach(cut => {
                const key = `${cut.createdBy}_${cut.cutType}_${Math.floor(new Date(cut.createdAt).getTime() / 60000)}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(cut);
            });
            
            const duplicateGroups = Object.values(groups).filter(group => group.length > 1);
            
            this.testResults.push({
                test: 'database_state',
                totalRecentCuts: recentCuts.length,
                duplicateGroups: duplicateGroups.length,
                details: duplicateGroups.map(group => ({
                    count: group.length,
                    ids: group.map(c => c.id),
                    totalIncomes: group.map(c => c.totalIncome),
                    hasZeroAmounts: group.some(c => c.totalIncome === 0)
                }))
            });

            console.log(`📊 Cortes recientes encontrados: ${recentCuts.length}`);
            console.log(`⚠️ Grupos con duplicados: ${duplicateGroups.length}`);
            
            if (duplicateGroups.length > 0) {
                console.log('🚨 DUPLICADOS DETECTADOS:');
                duplicateGroups.forEach((group, index) => {
                    console.log(`   Grupo ${index + 1}: ${group.length} registros`);
                    console.log(`   IDs: ${group.map(c => c.id).join(', ')}`);
                    console.log(`   Montos: ${group.map(c => `$${c.totalIncome}`).join(', ')}`);
                });
            }
            
        } catch (error) {
            console.error('❌ Error verificando base de datos:', error.message);
            this.testResults.push({
                test: 'database_state',
                error: error.message
            });
        }
    }

    async generateReport() {
        console.log('\n📋 Generando reporte de resultados...');
        
        const report = {
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            summary: {
                testsRun: this.testResults.length,
                duplicatesDetected: this.testResults.some(r => 
                    r.isDuplicate || r.duplicatesCreated > 0 || (r.duplicateGroups && r.duplicateGroups > 0)
                ),
                zeroAmountsDetected: this.testResults.some(r => 
                    r.hasZeroAmounts || r.zeroAmountResponses > 0 || 
                    (r.details && r.details.some && r.details.some(g => g.hasZeroAmounts))
                )
            },
            testResults: this.testResults
        };

        const reportPath = path.join(__dirname, `duplicate-test-report-${this.correlationId}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ Reporte guardado en: ${reportPath}`);
        
        // Mostrar resumen
        console.log('\n🎯 RESUMEN DE RESULTADOS:');
        console.log(`   Duplicados detectados: ${report.summary.duplicatesDetected ? '✅ SÍ' : '❌ NO'}`);
        console.log(`   Montos en cero detectados: ${report.summary.zeroAmountsDetected ? '✅ SÍ' : '❌ NO'}`);
        
        return report;
    }

    async runAllTests() {
        try {
            await this.initialize();
            await this.testSequentialDuplicates();
            await this.testConcurrentDuplicates();
            await this.checkDatabaseState();
            
            const report = await this.generateReport();
            return report;
            
        } catch (error) {
            console.error('❌ Error ejecutando pruebas:', error.message);
            throw error;
        }
    }
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
    const tester = new DuplicateCashCutTester();
    tester.runAllTests()
        .then(report => {
            console.log('\n🎉 Pruebas completadas exitosamente');
            process.exit(report.summary.duplicatesDetected || report.summary.zeroAmountsDetected ? 1 : 0);
        })
        .catch(error => {
            console.error('💥 Fallo en las pruebas:', error.message);
            process.exit(1);
        });
}

module.exports = DuplicateCashCutTester;
