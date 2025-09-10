/**
 * Sistema de Tareas Programadas - POS ConEJO NEGRO
 * 🔧 Reparación: Corte automático de caja - TaskMaster Enhanced
 * 📅 Implementado: Automatic Daily Cash Closing con Supervisor Integration
 */
const cron = require('node-cron');
const fetch = require('node-fetch');

// NOTA TaskMaster: Programación desactivada - manejada por CashCutService.init() en server.js
// El servicio principal ahora maneja la programación automáticamente desde el arranque
// Corte automático cada 12 horas (00:00 y 12:00) con mejoras - DESACTIVADO
/*
cron.schedule('0 0,12 * * *', async () => {
    console.log('🤖 TaskMaster: Ejecutando corte automático...');
    try {
        const result = await ejecutarCorteAutomatico();
        console.log('✅ Corte automático completado exitosamente');
        console.log(`💰 Total procesado: $${result.total}`);
        
        // Reportar éxito al supervisor
        await reportarEstadoAlSupervisor('SUCCESS', 'Corte automático completado', result);
        
    } catch (error) {
        console.error('❌ Error en corte automático:', error);
        
        // Enviar alerta al supervisor de agentes
        await notificarErrorCorte(error);
        await reportarEstadoAlSupervisor('ERROR', 'Error en corte automático', { error: error.message });
    }
}, {
    scheduled: true,
    timezone: "America/Mexico_City"
});
*/

/**
 * 📊 Ejecutar corte automático mejorado
 */
async function ejecutarCorteAutomatico() {
    // Implementación mejorada del corte automático
    console.log('📝 Obteniendo datos para el corte automático...');
    const ventasDelDia = await obtenerVentasDelDia();
    const gastos = await obtenerGastosDelDia();
    console.log(`📈 Procesando ${ventasDelDia.length} ventas y ${gastos.length} gastos`);
    
    const corte = await crearCorteAutomatico(ventasDelDia, gastos);
    await guardarCorte(corte);
    await generarReporte(corte);
    
    return corte;
}

/**
 * 🚨 Reportar estado al supervisor central
 */
async function reportarEstadoAlSupervisor(status, message, data) {
    try {
        const reportData = {
            source: 'auto-cash-closing',
            status: status,
            message: message,
            timestamp: new Date().toISOString(),
            data: data
        };

        // Enviar al supervisor en el puerto 3001
        const response = await fetch('http://localhost:3001/agent-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Agent-ID': 'task-master-cash-closer'
            },
            body: JSON.stringify(reportData)
        });

        if (response.ok) {
            console.log('📡 Reporte enviado al supervisor exitosamente');
        } else {
            console.warn('⚠️ El supervisor recibió el reporte pero respondió con error:', response.status);
        }
    } catch (error) {
        console.error('⚠️ No se pudo contactar al supervisor:', error.message);
        // Continuar a pesar del error de comunicación
    }
}

/**
 * 📅 Programar verificación periódica del sistema
 */
cron.schedule('0 */2 * * *', async () => {
    console.log('🔄 Verificando estado del sistema de corte automático...');
    await reportarEstadoAlSupervisor('HEALTH_CHECK', 'Verificación periódica', {
        status: 'ONLINE',
        nextScheduledRun: getNextScheduledTime()
    });
});

/**
 * ⏰ Obtener próxima hora programada
 */
function getNextScheduledTime() {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(23, 59, 0, 0);
    if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    return nextRun.toISOString();
}

module.exports = { 
    ejecutarCorteAutomatico,
    reportarEstadoAlSupervisor
};
