// Sistema de Reportes Reparado
class ReporteManager {
    constructor() {
        this.reportes = [];
        this.indices = new Map();
    }

    async generarReporte(tipo, datos) {
        const reporte = {
            id: this.generarId(),
            tipo,
            datos,
            timestamp: new Date().toISOString(),
            hash: this.calcularHash(datos)
        };
        
        // Guardar reporte
        await this.guardarReporte(reporte);
        
        // Indexar para búsqueda rápida
        await this.indexarReporte(reporte);
        
        return reporte;
    }

    async indexarReporte(reporte) {
        if (!this.indices.has(reporte.tipo)) {
            this.indices.set(reporte.tipo, []);
        }
        this.indices.get(reporte.tipo).push(reporte.id);
    }

    async obtenerReportesHistoricos(tipo, desde, hasta) {
        return this.reportes.filter(r => 
            r.tipo === tipo &&
            r.timestamp >= desde &&
            r.timestamp <= hasta
        );
    }
}

module.exports = ReporteManager;