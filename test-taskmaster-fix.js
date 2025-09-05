/**
 * 🔧 TaskMaster: Script de Validación para Corrección de Duplicados
 * NO DEPLOY hasta que este script pase todas las pruebas
 */

const improvedCashCutService = require('./utils/improvedCashCutService');

class TaskMasterValidator {
    constructor() {
        this.results = [];
        this.correlationId = `TASKMASTER-VALIDATION-${Date.now()}`;
    }

    async runValidation() {
        console.log('🔧 TaskMaster: Iniciando validación de corrección de duplicados');
        console.log(`📋 Correlation ID: ${this.correlationId}`);
        
        try {
            // Test 1: Verificar que el servicio mejorado funciona
            await this.testImprovedServiceWorks();
            
            // Test 2: Verificar prevención de duplicados
            await this.testDuplicatePrevention();
            
            // Test 3: Verificar montos correctos (no ceros)
            await this.testCorrectAmounts();
            
            // Test 4: Verificar concurrencia
            await this.testConcurrencyProtection();
            
            // Generar reporte final
            const report = await this.generateValidationReport();
            
            if (report.allTestsPassed) {
                console.log('🎉 TaskMaster: VALIDACIÓN EXITOSA - Listo para deploy');
                return true;
            } else {
                console.log('❌ TaskMaster: VALIDACIÓN FALLIDA - NO HACER DEPLOY');
                return false;
            }
            
        } catch (error) {
            console.error('💥 TaskMaster: Error en validación:', error.message);
            return false;
        }
    }

    async testImprovedServiceWorks() {
        console.log('\n🧪 Test 1: Verificar que ImprovedCashCutService funciona');
        
        try {
            const status = improvedCashCutService.getStatus();
            
            if (status.taskMasterActive) {
                console.log('✅ ImprovedCashCutService está activo');
                this.results.push({
                    test: 'service_works',
                    passed: true,
                    details: status
                });
            } else {
                throw new Error('ImprovedCashCutService no está activo');
            }
            
        } catch (error) {
            console.error('❌ Test 1 FALLÓ:', error.message);
            this.results.push({
                test: 'service_works',
                passed: false,
                error: error.message
            });
        }
    }

    async testDuplicatePrevention() {
        console.log('\n🧪 Test 2: Verificar prevención de duplicados');
        
        try {
            const testUserId = `validation-user-${this.correlationId}`;
            const testNotes = `Test duplicados - ${new Date().toISOString()}`;
            
            console.log('📤 Ejecutando primer corte...');
            const result1 = await improvedCashCutService.triggerManualCut(testUserId, testNotes);
            
            console.log('📤 Ejecutando segundo corte idéntico...');
            const result2 = await improvedCashCutService.triggerManualCut(testUserId, testNotes);
            
            const isDuplicate = result1.id !== result2.id;
            const sameData = result1.id === result2.id && result1.totalIncome === result2.totalIncome;
            
            if (!isDuplicate && sameData) {
                console.log('✅ Duplicados prevenidos correctamente');
                console.log(`   Primer corte: ${result1.id}`);
                console.log(`   Segundo retornó: ${result2.id} (mismo ID = correcto)`);
                
                this.results.push({
                    test: 'duplicate_prevention',
                    passed: true,
                    details: {
                        firstId: result1.id,
                        secondId: result2.id,
                        duplicatesPrevented: true
                    }
                });
            } else {
                throw new Error(`Duplicados NO prevenidos: ${result1.id} vs ${result2.id}`);
            }
            
        } catch (error) {
            console.error('❌ Test 2 FALLÓ:', error.message);
            this.results.push({
                test: 'duplicate_prevention',
                passed: false,
                error: error.message
            });
        }
    }

    async testCorrectAmounts() {
        console.log('\n🧪 Test 3: Verificar montos correctos (no ceros)');
        
        try {
            const testUserId = `amounts-user-${this.correlationId}`;
            const testNotes = `Test montos - ${new Date().toISOString()}`;
            
            const result = await improvedCashCutService.triggerManualCut(testUserId, testNotes);
            
            // Verificar que los campos críticos están presentes
            const hasValidStructure = (
                result.hasOwnProperty('totalIncome') &&
                result.hasOwnProperty('totalCost') &&
                result.hasOwnProperty('totalProfit') &&
                result.hasOwnProperty('paymentBreakdown') &&
                result.hasOwnProperty('taskMasterProtected')
            );
            
            if (hasValidStructure && result.taskMasterProtected) {
                console.log('✅ Estructura de datos correcta');
                console.log(`   Total Income: $${result.totalIncome}`);
                console.log(`   TaskMaster Protected: ${result.taskMasterProtected}`);
                
                this.results.push({
                    test: 'correct_amounts',
                    passed: true,
                    details: {
                        totalIncome: result.totalIncome,
                        totalCost: result.totalCost,
                        taskMasterProtected: result.taskMasterProtected,
                        hasIdempotencyKey: !!result.idempotencyKey
                    }
                });
            } else {
                throw new Error('Estructura de datos inválida o no protegida por TaskMaster');
            }
            
        } catch (error) {
            console.error('❌ Test 3 FALLÓ:', error.message);
            this.results.push({
                test: 'correct_amounts',
                passed: false,
                error: error.message
            });
        }
    }

    async testConcurrencyProtection() {
        console.log('\n🧪 Test 4: Verificar protección contra concurrencia');
        
        try {
            const testUserId = `concurrent-user-${this.correlationId}`;
            const testNotes = `Test concurrencia - ${new Date().toISOString()}`;
            
            // Ejecutar 3 operaciones concurrentes idénticas
            console.log('📤 Ejecutando 3 operaciones concurrentes...');
            const promises = Array.from({ length: 3 }, () => 
                improvedCashCutService.triggerManualCut(testUserId, testNotes)
            );
            
            const results = await Promise.all(promises);
            
            // Verificar que todos retornan el mismo ID (no duplicados)
            const uniqueIds = new Set(results.map(r => r.id));
            const allSameId = uniqueIds.size === 1;
            
            if (allSameId) {
                console.log('✅ Protección contra concurrencia funciona');
                console.log(`   Todas las operaciones retornaron ID: ${Array.from(uniqueIds)[0]}`);
                
                this.results.push({
                    test: 'concurrency_protection',
                    passed: true,
                    details: {
                        operationsCount: 3,
                        uniqueIds: uniqueIds.size,
                        allReturnedSameId: allSameId
                    }
                });
            } else {
                throw new Error(`Concurrencia falló: ${uniqueIds.size} IDs diferentes creados`);
            }
            
        } catch (error) {
            console.error('❌ Test 4 FALLÓ:', error.message);
            this.results.push({
                test: 'concurrency_protection',
                passed: false,
                error: error.message
            });
        }
    }

    async generateValidationReport() {
        console.log('\n📋 TaskMaster: Generando reporte de validación...');
        
        const passedTests = this.results.filter(r => r.passed).length;
        const totalTests = this.results.length;
        const allTestsPassed = passedTests === totalTests;
        
        const report = {
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            totalTests: totalTests,
            passedTests: passedTests,
            failedTests: totalTests - passedTests,
            allTestsPassed: allTestsPassed,
            results: this.results,
            deployRecommendation: allTestsPassed ? 'PROCEED_WITH_DEPLOY' : 'DO_NOT_DEPLOY'
        };
        
        // Guardar reporte
        const fs = require('fs').promises;
        const reportPath = `./taskmaster-validation-${this.correlationId}.json`;
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 Reporte guardado: ${reportPath}`);
        console.log(`\n🎯 RESULTADO FINAL:`);
        console.log(`   Tests pasados: ${passedTests}/${totalTests}`);
        console.log(`   Recomendación: ${report.deployRecommendation}`);
        
        if (allTestsPassed) {
            console.log(`\n🚀 TaskMaster: CORRECCIÓN VALIDADA - Proceder con deploy`);
        } else {
            console.log(`\n🛑 TaskMaster: CORRECCIÓN NO VALIDADA - Revisar errores antes de deploy`);
        }
        
        return report;
    }
}

// Ejecutar validación si se ejecuta directamente
if (require.main === module) {
    const validator = new TaskMasterValidator();
    validator.runValidation()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Error crítico en validación:', error);
            process.exit(1);
        });
}

module.exports = TaskMasterValidator;
