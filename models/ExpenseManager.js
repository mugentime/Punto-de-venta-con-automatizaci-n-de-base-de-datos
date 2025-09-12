// Sistema de Gestión de Gastos
class ExpenseManager {
    constructor() {
        this.categorias = [
            'luz', 'agua', 'telefono', 'internet',
            'insumos', 'sueldos', 'mantenimiento',
            'servicios', 'otros'
        ];
    }

    async registrarGasto(gasto) {
        const gastoCompleto = {
            id: this.generarId(),
            ...gasto,
            timestamp: new Date().toISOString(),
            usuario: gasto.usuario || 'sistema'
        };
        
        await this.guardarGasto(gastoCompleto);
        await this.actualizarReportesFinancieros(gastoCompleto);
        
        return gastoCompleto;
    }

    async obtenerGastosPorPeriodo(desde, hasta) {
        return await this.buscarGastos({ desde, hasta });
    }

    async generarReporteGastos(periodo) {
        const gastos = await this.obtenerGastosPorPeriodo(periodo.desde, periodo.hasta);
        return this.calcularEstadisticas(gastos);
    }
}

module.exports = ExpenseManager;