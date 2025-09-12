/**
 * 🔧 TaskMaster: Validar transferencia de datos en cortes de caja
 * Script para probar que los datos del día se transfieren correctamente
 */

const improvedCashCutService = require('./utils/improvedCashCutService');
const databaseManager = require('./utils/databaseManager');
const fs = require('fs').promises;
const path = require('path');

class CashCutDataTransferValidator {
    constructor() {
        this.testResults = [];
        this.correlationId = `DATA-TRANSFER-TEST-${Date.now()}`;
        this.testRecords = [];
    }

    async createTestData() {
        console.log('🔧 TaskMaster: Creando datos de prueba para el día...');
        
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 0); // 8 AM
        
        // Crear registros solo dentro del día actual para prueba realista
        this.testRecords = [
            {
                id: `test-${this.correlationId}-1`,
                date: new Date(startOfDay.getTime() + 1 * 60 * 60 * 1000).toISOString(), // 9 AM
                total: 150.00,
                cost: 50.00,
                drink: 'Café Americano',
                payment: 'efectivo',
                service: 'cafeteria',
                customer: 'Cliente Test 1',
                isDeleted: false
            },
            {
                id: `test-${this.correlationId}-2`,
                date: new Date(startOfDay.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 11 AM
                total: 85.50,
                cost: 25.00,
                drink: 'Cappuccino',
                payment: 'tarjeta',
                service: 'cafeteria',
                customer: 'Cliente Test 2',
                isDeleted: false
            },
            {
                id: `test-${this.correlationId}-3`,
                date: new Date(startOfDay.getTime() + 5 * 60 * 60 * 1000).toISOString(), // 1 PM
                total: 250.00,
                cost: 100.00,
                drink: 'Almuerzo',
                payment: 'transferencia',
                service: 'cafeteria',
                customer: 'Cliente Test 3',
                isDeleted: false
            }
        ];
        
        // Solo 3 registros que estarán dentro del día actual

        console.log(`📊 Datos de prueba creados:`);
        console.log(`   - ${this.testRecords.length} registros`);
        console.log(`   - Total ingresos: $${this.testRecords.reduce((sum, r) => sum + r.total, 0)}`);
        console.log(`   - Total costos: $${this.testRecords.reduce((sum, r) => sum + r.cost, 0)}`);
        console.log(`   - Período: ${startOfDay.toLocaleString()} - ${today.toLocaleString()}`);

        // Temporalmente agregar los datos de prueba al database manager
        await this.addTestRecordsToSystem();
    }

    async addTestRecordsToSystem() {
        try {
            // Agregar registros al sistema de archivos
            const recordsPath = path.join(__dirname, 'data', 'records.json');
            let existingRecords = [];
            
            try {
                const data = await fs.readFile(recordsPath, 'utf8');
                existingRecords = JSON.parse(data);
            } catch (error) {
                existingRecords = [];
            }

            // Agregar nuestros registros de prueba
            existingRecords.push(...this.testRecords);

            await fs.writeFile(recordsPath, JSON.stringify(existingRecords, null, 2));
            console.log('✅ Registros de prueba agregados al sistema');

            return true;
        } catch (error) {
            console.error('❌ Error agregando registros de prueba:', error.message);
            return false;
        }
    }

    async testCashCutDataTransfer() {
        console.log('\\n🔧 TaskMaster: Probando transferencia de datos en corte de caja...');

        try {
            const userId = `test-user-${this.correlationId}`;
            const notes = `Test data transfer - ${new Date().toISOString()}`;

            console.log('📤 Ejecutando corte de caja de fin de día...');
            const cashCut = await improvedCashCutService.triggerEndOfDayCut(userId, notes);

            console.log('📊 Resultado del corte de caja:');
            console.log(`   ID: ${cashCut.id}`);
            console.log(`   Registros totales: ${cashCut.totalRecords}`);
            console.log(`   Ingresos totales: $${cashCut.totalIncome}`);
            console.log(`   Costos totales: $${cashCut.totalCost}`);
            console.log(`   Ganancia: $${cashCut.totalProfit}`);
            console.log(`   Período: ${cashCut.startDate} - ${cashCut.endDate}`);

            // Validar que los datos se transfirieron correctamente
            const expectedTotalIncome = this.testRecords.reduce((sum, r) => sum + r.total, 0);
            const expectedTotalCost = this.testRecords.reduce((sum, r) => sum + r.cost, 0);
            const expectedTotalRecords = this.testRecords.length;

            console.log('\\n🔍 Comparando con datos esperados...');
            console.log(`   Registros esperados: ${expectedTotalRecords}, Obtenidos: ${cashCut.totalRecords}`);
            console.log(`   Ingresos esperados: $${expectedTotalIncome}, Obtenidos: $${cashCut.totalIncome}`);
            console.log(`   Costos esperados: $${expectedTotalCost}, Obtenidos: $${cashCut.totalCost}`);

            // Validaciones actualizadas - el servicio funciona correctamente
            const validations = {
                recordsMatch: cashCut.totalRecords === expectedTotalRecords, // Exactamente los registros esperados
                incomeCorrect: cashCut.totalIncome === expectedTotalIncome,  // Exactamente los ingresos esperados
                costsCorrect: cashCut.totalCost === expectedTotalCost,       // Exactamente los costos esperados
                hasPaymentBreakdown: cashCut.paymentBreakdown && Object.keys(cashCut.paymentBreakdown).length > 0,
                hasServiceBreakdown: cashCut.serviceBreakdown && Object.keys(cashCut.serviceBreakdown).length > 0,
                hasTaskMasterProtection: cashCut.taskMasterProtected === true
            };

            const allValid = Object.values(validations).every(v => v);

            console.log('\\n✅ Validaciones:');
            Object.entries(validations).forEach(([key, value]) => {
                console.log(`   ${key}: ${value ? '✅' : '❌'}`);
            });

            this.testResults.push({
                test: 'data_transfer',
                passed: allValid,
                details: {
                    expected: {
                        records: expectedTotalRecords,
                        income: expectedTotalIncome,
                        cost: expectedTotalCost
                    },
                    actual: {
                        records: cashCut.totalRecords,
                        income: cashCut.totalIncome,
                        cost: cashCut.totalCost
                    },
                    validations,
                    cashCutId: cashCut.id
                }
            });

            return allValid;

        } catch (error) {
            console.error('❌ Error en prueba de transferencia de datos:', error.message);
            this.testResults.push({
                test: 'data_transfer',
                passed: false,
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    async testDuplicatePrevention() {
        console.log('\\n🔧 TaskMaster: Verificando que prevención de duplicados siga funcionando...');

        try {
            const userId = `test-duplicate-${this.correlationId}`;
            const notes = `Test duplicates after fix - ${new Date().toISOString()}`;

            console.log('📤 Ejecutando primer corte...');
            const cut1 = await improvedCashCutService.triggerManualCut(userId, notes);

            console.log('📤 Ejecutando segundo corte idéntico...');
            const cut2 = await improvedCashCutService.triggerManualCut(userId, notes);

            const duplicatesPrevented = cut1.id === cut2.id;
            const dataConsistent = cut1.totalIncome === cut2.totalIncome;

            console.log(`   Primer corte: ${cut1.id} - $${cut1.totalIncome}`);
            console.log(`   Segundo corte: ${cut2.id} - $${cut2.totalIncome}`);
            console.log(`   ¿Duplicados prevenidos?: ${duplicatesPrevented ? '✅' : '❌'}`);
            console.log(`   ¿Datos consistentes?: ${dataConsistent ? '✅' : '❌'}`);

            const success = duplicatesPrevented && dataConsistent;

            this.testResults.push({
                test: 'duplicate_prevention',
                passed: success,
                details: {
                    cut1Id: cut1.id,
                    cut2Id: cut2.id,
                    duplicatesPrevented,
                    dataConsistent
                }
            });

            return success;

        } catch (error) {
            console.error('❌ Error verificando prevención de duplicados:', error.message);
            this.testResults.push({
                test: 'duplicate_prevention',
                passed: false,
                error: error.message
            });
            return false;
        }
    }

    async cleanupTestData() {
        console.log('\\n🧹 TaskMaster: Limpiando datos de prueba...');

        try {
            // Remover registros de prueba del sistema
            const recordsPath = path.join(__dirname, 'data', 'records.json');
            const data = await fs.readFile(recordsPath, 'utf8');
            let records = JSON.parse(data);

            const originalCount = records.length;
            records = records.filter(record => !record.id || !record.id.includes(this.correlationId));
            const finalCount = records.length;

            await fs.writeFile(recordsPath, JSON.stringify(records, null, 2));
            
            console.log(`✅ Limpieza completada: ${originalCount - finalCount} registros de prueba removidos`);
            return true;

        } catch (error) {
            console.error('❌ Error limpiando datos de prueba:', error.message);
            return false;
        }
    }

    async generateReport() {
        console.log('\\n📋 TaskMaster: Generando reporte de validación...');

        const passedTests = this.testResults.filter(r => r.passed).length;
        const totalTests = this.testResults.length;
        const allTestsPassed = passedTests === totalTests;

        const report = {
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            testType: 'cash_cut_data_transfer_validation',
            summary: {
                totalTests,
                passedTests,
                failedTests: totalTests - passedTests,
                allTestsPassed,
                dataTransferFixed: this.testResults.find(r => r.test === 'data_transfer')?.passed || false,
                duplicatePreventionIntact: this.testResults.find(r => r.test === 'duplicate_prevention')?.passed || false
            },
            testResults: this.testResults
        };

        const reportPath = path.join(__dirname, `data-transfer-validation-${this.correlationId}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log(`📄 Reporte guardado: ${reportPath}`);
        console.log(`\\n🎯 RESULTADO FINAL:`);
        console.log(`   Tests pasados: ${passedTests}/${totalTests}`);
        console.log(`   Transferencia de datos: ${report.summary.dataTransferFixed ? '✅ CORREGIDA' : '❌ FALLA'}`);
        console.log(`   Prevención duplicados: ${report.summary.duplicatePreventionIntact ? '✅ INTACTA' : '❌ ROTA'}`);

        if (allTestsPassed) {
            console.log(`\\n🎉 TaskMaster: CORRECCIÓN VALIDADA - Transferencia de datos funcionando`);
        } else {
            console.log(`\\n🛑 TaskMaster: CORRECCIÓN FALLIDA - Revisar problemas`);
        }

        return report;
    }

    async runCompleteValidation() {
        console.log('🔧 TaskMaster: Iniciando validación completa de transferencia de datos');
        console.log(`📋 Correlation ID: ${this.correlationId}`);

        try {
            // Crear datos de prueba
            await this.createTestData();

            // Probar transferencia de datos
            await this.testCashCutDataTransfer();

            // Verificar que prevención de duplicados siga funcionando
            await this.testDuplicatePrevention();

            // Generar reporte
            const report = await this.generateReport();

            // No limpiar datos inmediatamente para poder verificar
            // await this.cleanupTestData();

            return report.summary.allTestsPassed;

        } catch (error) {
            console.error('💥 Error en validación completa:', error.message);
            await this.cleanupTestData(); // Limpiar incluso si hay error
            return false;
        }
    }
}

// Ejecutar validación si se ejecuta directamente
if (require.main === module) {
    const validator = new CashCutDataTransferValidator();
    validator.runCompleteValidation()
        .then(success => {
            console.log('\\n🎉 Validación de transferencia de datos completada');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Error crítico en validación:', error);
            process.exit(1);
        });
}

module.exports = CashCutDataTransferValidator;
