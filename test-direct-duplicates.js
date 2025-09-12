/**
 * Test directo para reproducir duplicados de cortes de caja
 * 🔧 Task Master: Direct Service Test for Cash Cut Duplicates
 */

const cashCutService = require('./utils/cashCutService');
const fs = require('fs').promises;
const path = require('path');

class DirectCashCutTester {
    constructor() {
        this.testResults = [];
        this.correlationId = Date.now().toString();
    }

    async initialize() {
        console.log('🔧 Task Master: Iniciando pruebas directas de duplicación');
        console.log(`📋 Correlation ID: ${this.correlationId}`);
        
        // Esperar a que el servicio se inicialice
        if (!cashCutService.initialized) {
            console.log('⏳ Esperando inicialización del servicio...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async testSequentialDuplicates() {
        console.log('\\n🔄 Prueba 1: Cortes manuales secuenciales idénticos');
        
        const testUserId = `test-user-${this.correlationId}`;
        const testNotes = `Prueba duplicados directa - ${new Date().toISOString()}`;

        try {
            console.log('📤 Ejecutando primer corte manual...');
            const result1 = await cashCutService.triggerManualCut(testUserId, testNotes);
            
            console.log('📤 Ejecutando segundo corte manual idéntico...');
            const result2 = await cashCutService.triggerManualCut(testUserId, testNotes);

            this.testResults.push({
                test: 'sequential_manual_cuts',
                result1: {
                    id: result1.id,
                    totalIncome: result1.totalIncome,
                    totalRecords: result1.totalRecords,
                    createdAt: result1.createdAt
                },
                result2: {
                    id: result2.id,
                    totalIncome: result2.totalIncome,
                    totalRecords: result2.totalRecords,
                    createdAt: result2.createdAt
                },
                isDuplicate: result1.id !== result2.id,
                hasZeroAmounts: result2.totalIncome === 0
            });

            console.log(`✅ Primer corte: ID=${result1.id}, Income=$${result1.totalIncome}, Records=${result1.totalRecords}`);
            console.log(`✅ Segundo corte: ID=${result2.id}, Income=$${result2.totalIncome}, Records=${result2.totalRecords}`);
            
            if (result1.id !== result2.id) {
                console.log('🚨 DUPLICADO DETECTADO!');
            }
            
            if (result2.totalIncome === 0) {
                console.log('🚨 SEGUNDO CORTE CON MONTOS EN CERO!');
            }

        } catch (error) {
            console.error('❌ Error en prueba secuencial:', error.message);
            this.testResults.push({
                test: 'sequential_manual_cuts',
                error: error.message,
                stack: error.stack
            });
        }
    }

    async testConcurrentDuplicates() {
        console.log('\\n🔄 Prueba 2: Cortes manuales concurrentes');
        
        const testUserId = `test-concurrent-${this.correlationId}`;
        const testNotes = `Prueba concurrente - ${new Date().toISOString()}`;

        try {
            // Crear 5 solicitudes concurrentes (reducido para evitar sobrecarga)
            console.log('📤 Ejecutando 5 cortes manuales concurrentes...');
            const promises = Array.from({ length: 5 }, (_, index) => 
                cashCutService.triggerManualCut(testUserId, `${testNotes} - ${index}`)
                    .catch(error => ({ error: true, message: error.message, index }))
            );

            const results = await Promise.all(promises);
            
            const successful = results.filter(r => !r.error);
            const failed = results.filter(r => r.error);
            
            const uniqueIds = new Set();
            const zeroAmountResults = [];
            
            successful.forEach((result, index) => {
                if (result.id) uniqueIds.add(result.id);
                if (result.totalIncome === 0) {
                    zeroAmountResults.push({ 
                        index, 
                        id: result.id, 
                        totalIncome: result.totalIncome 
                    });
                }
            });

            this.testResults.push({
                test: 'concurrent_manual_cuts',
                totalRequests: 5,
                successful: successful.length,
                failed: failed.length,
                uniqueCashCuts: uniqueIds.size,
                zeroAmountResults: zeroAmountResults.length,
                duplicatesCreated: successful.length - uniqueIds.size,
                details: {
                    uniqueIds: Array.from(uniqueIds),
                    zeroAmountResults,
                    failedRequests: failed.map(f => f.message)
                }
            });

            console.log(`✅ Cortes exitosos: ${successful.length}/5`);
            console.log(`📊 Cortes únicos creados: ${uniqueIds.size}`);
            console.log(`⚠️ Duplicados creados: ${successful.length - uniqueIds.size}`);
            console.log(`❌ Cortes con montos en cero: ${zeroAmountResults.length}`);

            if (duplicatesCreated > 0) {
                console.log('🚨 DUPLICADOS DETECTADOS EN CONCURRENCIA!');
            }

        } catch (error) {
            console.error('❌ Error en prueba concurrente:', error.message);
            this.testResults.push({
                test: 'concurrent_manual_cuts',
                error: error.message
            });
        }
    }

    async checkDataFiles() {
        console.log('\\n🔍 Verificando archivos de datos...');
        
        try {
            const cashCutsPath = path.join(__dirname, 'data', 'cashcuts.json');
            const cashCutsData = await fs.readFile(cashCutsPath, 'utf8');
            const cashCuts = JSON.parse(cashCutsData);
            
            // Buscar duplicados recientes (últimos 2 minutos para pruebas)
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            const recentCuts = cashCuts.filter(cut => 
                new Date(cut.createdAt || cut.cutDate) >= twoMinutesAgo
            );
            
            console.log(`📊 Total de cortes en archivo: ${cashCuts.length}`);
            console.log(`📊 Cortes recientes: ${recentCuts.length}`);
            
            // Mostrar detalles de los cortes recientes
            if (recentCuts.length > 0) {
                console.log('\\n📋 Cortes recientes encontrados:');
                recentCuts.forEach((cut, index) => {
                    console.log(`   ${index + 1}. ID: ${cut.id}`);
                    console.log(`      Ingresos: $${cut.totalIncome}`);
                    console.log(`      Registros: ${cut.totalRecords}`);
                    console.log(`      Fecha: ${cut.createdAt || cut.cutDate}`);
                    console.log(`      Notas: ${cut.notes}`);
                    console.log(`      Usuario: ${cut.createdBy}`);
                });
            }
            
            // Buscar duplicados potenciales
            const groups = {};
            recentCuts.forEach(cut => {
                const key = `${cut.createdBy}_${cut.cutType}_${cut.notes}`;
                if (!groups[key]) groups[key] = [];
                groups[key].push(cut);
            });
            
            const duplicateGroups = Object.values(groups).filter(group => group.length > 1);
            
            if (duplicateGroups.length > 0) {
                console.log('\\n🚨 GRUPOS DUPLICADOS DETECTADOS:');
                duplicateGroups.forEach((group, index) => {
                    console.log(`   Grupo ${index + 1}: ${group.length} registros`);
                    console.log(`   IDs: ${group.map(c => c.id).join(', ')}`);
                    console.log(`   Ingresos: ${group.map(c => `$${c.totalIncome}`).join(', ')}`);
                    console.log(`   ¿Tiene ceros?: ${group.some(c => c.totalIncome === 0) ? 'SÍ' : 'NO'}`);
                });
            }

            this.testResults.push({
                test: 'data_file_analysis',
                totalCashCuts: cashCuts.length,
                recentCuts: recentCuts.length,
                duplicateGroups: duplicateGroups.length,
                hasZeroAmounts: recentCuts.some(cut => cut.totalIncome === 0),
                recentCutDetails: recentCuts.map(cut => ({
                    id: cut.id,
                    totalIncome: cut.totalIncome,
                    totalRecords: cut.totalRecords,
                    createdBy: cut.createdBy,
                    notes: cut.notes
                }))
            });
            
        } catch (error) {
            console.error('❌ Error verificando archivos:', error.message);
            this.testResults.push({
                test: 'data_file_analysis',
                error: error.message
            });
        }
    }

    async generateReport() {
        console.log('\\n📋 Generando reporte detallado...');
        
        const report = {
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            testType: 'direct_service_test',
            summary: {
                testsRun: this.testResults.length,
                duplicatesDetected: this.testResults.some(r => 
                    r.isDuplicate || (r.duplicatesCreated && r.duplicatesCreated > 0) || 
                    (r.duplicateGroups && r.duplicateGroups > 0)
                ),
                zeroAmountsDetected: this.testResults.some(r => 
                    r.hasZeroAmounts || (r.zeroAmountResults && r.zeroAmountResults > 0) ||
                    (r.hasZeroAmounts === true)
                )
            },
            testResults: this.testResults
        };

        const reportPath = path.join(__dirname, `direct-duplicate-test-${this.correlationId}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ Reporte guardado en: ${reportPath}`);
        
        // Mostrar resumen final
        console.log('\\n🎯 RESUMEN FINAL:');
        console.log(`   Duplicados detectados: ${report.summary.duplicatesDetected ? '🚨 SÍ' : '✅ NO'}`);
        console.log(`   Montos en cero detectados: ${report.summary.zeroAmountsDetected ? '🚨 SÍ' : '✅ NO'}`);
        
        if (report.summary.duplicatesDetected) {
            console.log('\\n🔧 Task Master: PROBLEMA CONFIRMADO - Duplicados detectados');
        }
        
        if (report.summary.zeroAmountsDetected) {
            console.log('\\n🔧 Task Master: PROBLEMA CONFIRMADO - Montos en cero detectados');
        }
        
        return report;
    }

    async runAllTests() {
        try {
            await this.initialize();
            await this.testSequentialDuplicates();
            await this.testConcurrentDuplicates();
            await this.checkDataFiles();
            
            const report = await this.generateReport();
            return report;
            
        } catch (error) {
            console.error('❌ Error ejecutando pruebas:', error.message);
            throw error;
        }
    }
}

// Ejecutar pruebas
if (require.main === module) {
    const tester = new DirectCashCutTester();
    tester.runAllTests()
        .then(report => {
            console.log('\\n🎉 Pruebas directas completadas');
            const hasIssues = report.summary.duplicatesDetected || report.summary.zeroAmountsDetected;
            process.exit(hasIssues ? 1 : 0);
        })
        .catch(error => {
            console.error('💥 Error en pruebas:', error.message);
            process.exit(1);
        });
}

module.exports = DirectCashCutTester;
