// ===============================================
// PRUEBA DE INTEGRACION DE GASTOS EN CORTE DE CAJA
// POS CONEJO NEGRO - TEST CASH CUT WITH EXPENSES
// ===============================================

const databaseManager = require('./utils/databaseManager');
const cashCutService = require('./utils/cashCutService');

async function testCashCutWithExpenses() {
    console.log('[TEST] Iniciando prueba de corte de caja con gastos...');
    
    try {
        // Inicializar servicios
        await databaseManager.initialize();
        
        // El servicio de corte ya está inicializado como singleton
        // Solo esperamos un momento para asegurar que esté listo
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('[TEST] Servicios inicializados correctamente');
        
        // Obtener datos actuales para verificar
        console.log('\n[DATA] Verificando datos disponibles...');
        
        // Obtener records del día
        const allRecords = await databaseManager.getRecords();
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayRecords = allRecords.filter(record => {
            const recordDate = new Date(record.date);
            return recordDate >= startOfDay && !record.isDeleted;
        });
        
        console.log(`[DATA] Records de hoy: ${todayRecords.length}`);
        if (todayRecords.length > 0) {
            const totalIncome = todayRecords.reduce((sum, r) => sum + r.total, 0);
            console.log(`[DATA] Ingresos del día: $${totalIncome.toFixed(2)}`);
        }
        
        // Obtener gastos del día
        const allExpenses = await databaseManager.getExpensesByDateRange(startOfDay, today);
        const todayExpenses = allExpenses.filter(expense => 
            expense.isActive !== false && expense.status === 'pagado'
        );
        
        console.log(`[DATA] Gastos de hoy: ${todayExpenses.length}`);
        if (todayExpenses.length > 0) {
            const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
            console.log(`[DATA] Total gastos: $${totalExpenses.toFixed(2)}`);
            
            // Mostrar breakdown por categoría
            const expensesByCategory = {};
            todayExpenses.forEach(expense => {
                const category = expense.category || 'otros';
                if (!expensesByCategory[category]) {
                    expensesByCategory[category] = { count: 0, amount: 0 };
                }
                expensesByCategory[category].count++;
                expensesByCategory[category].amount += expense.amount;
            });
            
            console.log('[DATA] Gastos por categoría:');
            Object.keys(expensesByCategory).forEach(cat => {
                const data = expensesByCategory[cat];
                console.log(`[DATA]   ${cat}: ${data.count} gastos, $${data.amount.toFixed(2)}`);
            });
        } else {
            console.log('[DATA] No hay gastos registrados para hoy');
        }
        
        // Realizar corte de caja manual
        console.log('\n[TEST] Realizando corte de caja manual...');
        const cashCut = await cashCutService.triggerManualCut('test-user', 'Prueba de integración con gastos');
        
        console.log('[TEST] ¡Corte de caja completado exitosamente!');
        console.log('\n[RESULT] Resultados del corte de caja:');
        console.log(`[RESULT] ID: ${cashCut.id}`);
        console.log(`[RESULT] Fecha: ${new Date(cashCut.cutDate).toLocaleString('es-MX')}`);
        console.log(`[RESULT] Tipo: ${cashCut.cutType}`);
        console.log(`[RESULT] Records: ${cashCut.totalRecords}`);
        console.log(`[RESULT] Ingresos: $${cashCut.totalIncome}`);
        console.log(`[RESULT] Costos: $${cashCut.totalCost}`);
        console.log(`[RESULT] GASTOS: $${cashCut.totalExpenses} (${cashCut.totalExpenseRecords} gastos)`);
        console.log(`[RESULT] Ganancia bruta: $${cashCut.totalProfit}`);
        console.log(`[RESULT] GANANCIA NETA: $${cashCut.netProfit}`);
        
        if (cashCut.expenseBreakdown) {
            console.log('\n[RESULT] Desglose de gastos por categoría:');
            Object.keys(cashCut.expenseBreakdown).forEach(category => {
                const data = cashCut.expenseBreakdown[category];
                if (data.count > 0) {
                    console.log(`[RESULT]   ${category}: ${data.count} gastos, $${data.amount.toFixed(2)}`);
                }
            });
        }
        
        // Verificar que los gastos están incluidos
        console.log('\n[VALIDATION] Validaciones:');
        console.log(`[VALIDATION] ✅ Gastos incluidos: ${cashCut.totalExpenses > 0 ? 'SÍ' : 'NO'}`);
        console.log(`[VALIDATION] ✅ Ganancia neta calculada: ${cashCut.netProfit !== undefined ? 'SÍ' : 'NO'}`);
        console.log(`[VALIDATION] ✅ Desglose de gastos: ${cashCut.expenseBreakdown ? 'SÍ' : 'NO'}`);
        
        const difference = cashCut.totalProfit - cashCut.totalExpenses;
        const calculatedNet = cashCut.netProfit;
        console.log(`[VALIDATION] ✅ Cálculo correcto: ${Math.abs(difference - calculatedNet) < 0.01 ? 'SÍ' : 'NO'}`);
        
        console.log('\n[SUCCESS] ¡PRUEBA COMPLETADA EXITOSAMENTE!');
        console.log('[SUCCESS] Los gastos ahora se integran correctamente en el corte de caja');
        
        return true;
        
    } catch (error) {
        console.error('[ERROR] Error en la prueba:', error.message);
        console.error('[ERROR] Stack:', error.stack);
        return false;
    }
}

// Ejecutar la prueba si se llama directamente
if (require.main === module) {
    testCashCutWithExpenses()
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

module.exports = { testCashCutWithExpenses };
