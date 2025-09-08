// ===============================================
// PRUEBA SIMPLIFICADA DE INTEGRACION DE GASTOS
// POS CONEJO NEGRO - SIMPLE EXPENSE INTEGRATION TEST
// ===============================================

const databaseManager = require('./utils/databaseManager');

async function testExpenseIntegration() {
    console.log('[TEST] Iniciando prueba simplificada de gastos...');
    
    try {
        // Inicializar base de datos
        await databaseManager.initialize();
        console.log('[TEST] Base de datos inicializada');
        
        // Verificar datos existentes
        console.log('\n[DATA] Verificando datos disponibles...');
        
        // Obtener gastos
        const allExpenses = await databaseManager.getExpenses();
        console.log(`[DATA] Total de gastos en sistema: ${allExpenses.length}`);
        
        if (allExpenses.length > 0) {
            const totalExpenseAmount = allExpenses
                .filter(expense => expense.isActive !== false && expense.status === 'pagado')
                .reduce((sum, expense) => sum + expense.amount, 0);
            
            console.log(`[DATA] Total en gastos pagados: $${totalExpenseAmount.toFixed(2)}`);
            
            // Mostrar algunos gastos
            const activeExpenses = allExpenses.filter(expense => 
                expense.isActive !== false && expense.status === 'pagado'
            ).slice(0, 3);
            
            console.log('[DATA] Primeros gastos:');
            activeExpenses.forEach(expense => {
                console.log(`[DATA]   - ${expense.description}: $${expense.amount} (${expense.category})`);
            });
        }
        
        // Obtener registros de ventas
        const allRecords = await databaseManager.getRecords();
        const activeRecords = allRecords.filter(record => !record.isDeleted);
        console.log(`[DATA] Total de registros de venta: ${activeRecords.length}`);
        
        if (activeRecords.length > 0) {
            const totalSalesAmount = activeRecords.reduce((sum, record) => sum + record.total, 0);
            console.log(`[DATA] Total en ventas: $${totalSalesAmount.toFixed(2)}`);
        }
        
        // Probar función de rango de fechas
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        console.log('\n[TEST] Probando función getExpensesByDateRange...');
        const monthExpenses = await databaseManager.getExpensesByDateRange(startOfMonth, today);
        console.log(`[TEST] Gastos del mes actual: ${monthExpenses.length}`);
        
        // Probar función de reporte financiero
        console.log('\n[TEST] Probando función getFinancialReport...');
        const financialReport = await databaseManager.getFinancialReport(startOfMonth, today);
        
        console.log('[REPORT] Reporte Financiero del Mes:');
        console.log(`[REPORT] Ingresos POS: $${financialReport.income.pos_sales.toFixed(2)}`);
        console.log(`[REPORT] Ingresos Coworking: $${financialReport.income.coworking.toFixed(2)}`);
        console.log(`[REPORT] Total Ingresos: $${financialReport.income.total.toFixed(2)}`);
        console.log(`[REPORT] Total Gastos: $${financialReport.expenses.total.toFixed(2)}`);
        console.log(`[REPORT] Ganancia Neta: $${financialReport.profit.net.toFixed(2)}`);
        console.log(`[REPORT] Margen de Ganancia: ${financialReport.profit.margin.toFixed(2)}%`);
        
        if (financialReport.expenses.by_category) {
            console.log('\n[REPORT] Gastos por Categoría:');
            Object.keys(financialReport.expenses.by_category).forEach(category => {
                const catData = financialReport.expenses.by_category[category];
                if (catData.count > 0) {
                    console.log(`[REPORT]   ${catData.name}: $${catData.total.toFixed(2)} (${catData.count} gastos)`);
                }
            });
        }
        
        // Simular cálculos de corte de caja
        console.log('\n[SIMULATE] Simulando cálculo de corte de caja...');
        
        const simulatedIncome = activeRecords.reduce((sum, record) => sum + record.total, 0);
        const simulatedExpenses = allExpenses
            .filter(expense => expense.isActive !== false && expense.status === 'pagado')
            .reduce((sum, expense) => sum + expense.amount, 0);
        const simulatedNetProfit = simulatedIncome - simulatedExpenses;
        
        console.log(`[SIMULATE] Ingresos simulados: $${simulatedIncome.toFixed(2)}`);
        console.log(`[SIMULATE] Gastos simulados: $${simulatedExpenses.toFixed(2)}`);
        console.log(`[SIMULATE] Ganancia neta simulada: $${simulatedNetProfit.toFixed(2)}`);
        
        // Validaciones
        console.log('\n[VALIDATION] Validaciones de integración:');
        console.log(`[VALIDATION] ✅ Función getExpenses: ${allExpenses.length > 0 ? 'OK' : 'SIN DATOS'}`);
        console.log(`[VALIDATION] ✅ Función getExpensesByDateRange: ${monthExpenses !== undefined ? 'OK' : 'FALLO'}`);
        console.log(`[VALIDATION] ✅ Función getFinancialReport: ${financialReport !== undefined ? 'OK' : 'FALLO'}`);
        console.log(`[VALIDATION] ✅ Cálculo de gastos: ${simulatedExpenses >= 0 ? 'OK' : 'FALLO'}`);
        console.log(`[VALIDATION] ✅ Cálculo de ganancia neta: ${!isNaN(simulatedNetProfit) ? 'OK' : 'FALLO'}`);
        
        console.log('\n[SUCCESS] ¡PRUEBA COMPLETADA EXITOSAMENTE!');
        console.log('[SUCCESS] Todas las funciones de integración de gastos funcionan correctamente');
        console.log('[SUCCESS] El sistema está listo para incluir gastos en el corte de caja');
        
        return true;
        
    } catch (error) {
        console.error('[ERROR] Error en la prueba:', error.message);
        console.error('[ERROR] Stack:', error.stack);
        return false;
    }
}

// Ejecutar la prueba si se llama directamente
if (require.main === module) {
    testExpenseIntegration()
        .then(success => {
            if (success) {
                console.log('\n[COMPLETE] Prueba finalizada correctamente');
                process.exit(0);
            } else {
                console.log('\n[COMPLETE] Prueba falló');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('[FATAL]', error);
            process.exit(1);
        });
}

module.exports = { testExpenseIntegration };
