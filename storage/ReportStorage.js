// Storage Sin Límites Artificiales
class ReportStorage {
    constructor() {
        this.reportes = [];
        this.maxSize = Infinity; // Sin límite artificial
        this.archiveThreshold = 1000; // Archivar después de 1000
    }

    async agregarReporte(reporte) {
        this.reportes.push(reporte);
        
        // En lugar de eliminar, archivar reportes antiguos
        if (this.reportes.length > this.archiveThreshold) {
            await this.archivarReportesAntiguos();
        }
        
        return reporte;
    }

    async archivarReportesAntiguos() {
        const reportesAArchivar = this.reportes.splice(0, 500);
        await this.guardarEnArchivo(reportesAArchivar);
        console.log(`📦 Archivados ${reportesAArchivar.length} reportes`);
    }
}

module.exports = ReportStorage;