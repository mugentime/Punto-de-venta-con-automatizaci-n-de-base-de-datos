// Prevención de Transacciones Duplicadas
class TransactionManager {
    constructor() {
        this.processingTransactions = new Set();
    }

    async ejecutarCorteManual(datos) {
        const transactionId = this.generarTransactionId(datos);
        
        // Verificar si ya se está procesando
        if (this.processingTransactions.has(transactionId)) {
            throw new Error('Transacción ya en proceso');
        }
        
        this.processingTransactions.add(transactionId);
        
        try {
            // Verificar duplicados en base de datos
            const existe = await this.verificarCorteExistente(datos);
            if (existe) {
                throw new Error('Corte ya existe para esta fecha/hora');
            }
            
            const resultado = await this.crearCorte(datos);
            return resultado;
        } finally {
            this.processingTransactions.delete(transactionId);
        }
    }

    generarTransactionId(datos) {
        return `${datos.fecha}_${datos.usuario}_${Date.now()}`;
    }
}

module.exports = TransactionManager;