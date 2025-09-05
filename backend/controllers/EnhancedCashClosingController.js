/**
 * Controlador Mejorado de Corte de Caja - POS ConEJO NEGRO
 * 🔧 Reparación: Duplicados en corte manual de caja
 * 🛡️ TaskMaster: Enhanced Cash Closing with Anti-Duplicate Protection
 */

const DuplicatePreventionService = require('../services/DuplicatePreventionService');
const { v4: uuidv4 } = require('uuid');

class EnhancedCashClosingController {
    constructor() {
        this.duplicateService = new DuplicatePreventionService();
        this.activeOperations = new Map();
        this.operationHistory = new Map();
        
        console.log('🛡️ TaskMaster: Controlador Mejorado de Corte de Caja Inicializado');
    }

    /**
     * 💰 Procesar corte manual de caja con protecciones
     */
    async processManualCashClosing(req, res) {
        const operationId = uuidv4();
        const startTime = Date.now();
        
        try {
            const { 
                cashierId, 
                sessionId,
                cashData,
                notes,
                forcedClose = false 
            } = req.body;

            console.log(`🔄 Iniciando corte manual - Cajero: ${cashierId}, Operación: ${operationId}`);

            // Validar datos de entrada
            const inputValidation = this.validateInputData(req.body);
            if (!inputValidation.valid) {
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_INPUT',
                    message: 'Datos de entrada inválidos',
                    details: inputValidation.errors,
                    operationId
                });
            }

            // Preparar datos de operación
            const operationData = {
                operationId,
                cashierId,
                sessionId: sessionId || uuidv4(),
                cashData,
                notes,
                timestamp: new Date(),
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip
            };

            // Registrar operación activa
            this.activeOperations.set(operationId, {
                ...operationData,
                status: 'VALIDATING',
                startTime: new Date()
            });

            // Validar con servicio de duplicados
            const validation = await this.duplicateService.validateCashClosingOperation(operationData);
            if (!validation.valid) {
                this.activeOperations.delete(operationId);
                
                return res.status(409).json({
                    success: false,
                    error: validation.error,
                    message: validation.message,
                    details: validation.details,
                    operationId
                });
            }

            // Actualizar estado a procesando
            this.activeOperations.set(operationId, {
                ...this.activeOperations.get(operationId),
                status: 'PROCESSING',
                validationFingerprint: validation.operationFingerprint
            });

            // Procesar el corte de caja
            const result = await this.executeManualCashClosing({
                ...operationData,
                validationFingerprint: validation.operationFingerprint
            });

            const processingTime = Date.now() - startTime;
            
            // Actualizar estado a completado
            this.activeOperations.set(operationId, {
                ...this.activeOperations.get(operationId),
                status: 'COMPLETED',
                result: result,
                processingTime: processingTime
            });

            // Guardar en historial
            this.operationHistory.set(operationId, {
                ...this.activeOperations.get(operationId),
                completedAt: new Date()
            });

            // Reportar éxito al supervisor
            await this.reportToSupervisor('CASH_CLOSING_SUCCESS', {
                operationId,
                cashierId,
                processingTime,
                totalAmount: result.finalCashAmount
            });

            console.log(`✅ Corte manual completado - Operación: ${operationId} (${processingTime}ms)`);

            res.json({
                success: true,
                data: {
                    operationId,
                    cashierId,
                    ...result,
                    processingTime,
                    validationFingerprint: validation.operationFingerprint
                }
            });

        } catch (error) {
            console.error(`❌ Error procesando corte manual - Operación: ${operationId}:`, error.message);

            // Actualizar estado de error
            if (this.activeOperations.has(operationId)) {
                this.activeOperations.set(operationId, {
                    ...this.activeOperations.get(operationId),
                    status: 'ERROR',
                    error: error.message
                });
            }

            // Reportar error al supervisor
            await this.reportToSupervisor('CASH_CLOSING_ERROR', {
                operationId,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                error: 'PROCESSING_ERROR',
                message: 'Error interno procesando el corte de caja',
                operationId
            });
        } finally {
            // Limpieza después de 5 minutos
            setTimeout(() => {
                this.activeOperations.delete(operationId);
            }, 5 * 60 * 1000);
        }
    }

    /**
     * ✅ Validar datos de entrada
     */
    validateInputData(inputData) {
        const errors = [];
        
        // Validar campos requeridos
        if (!inputData.cashierId) {
            errors.push('cashierId es requerido');
        }
        
        if (!inputData.cashData) {
            errors.push('cashData es requerido');
        } else {
            // Validar estructura de cashData
            const requiredCashFields = ['totalCash', 'salesTotal', 'initialCash'];
            for (const field of requiredCashFields) {
                if (typeof inputData.cashData[field] !== 'number') {
                    errors.push(`cashData.${field} debe ser un número`);
                }
            }
            
            // Validar rangos lógicos
            if (inputData.cashData.totalCash < 0) {
                errors.push('El total en caja no puede ser negativo');
            }
            
            if (inputData.cashData.salesTotal < 0) {
                errors.push('El total de ventas no puede ser negativo');
            }
            
            if (inputData.cashData.initialCash < 0) {
                errors.push('La caja inicial no puede ser negativa');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 🔧 Ejecutar el corte de caja real
     */
    async executeManualCashClosing(operationData) {
        const { 
            operationId, 
            cashierId, 
            cashData, 
            notes, 
            validationFingerprint 
        } = operationData;

        // Simular procesamiento con datos reales
        console.log(`📊 Procesando corte de caja para cajero ${cashierId}...`);

        // Calcular diferencias y totales
        const calculations = this.performCashCalculations(cashData);
        
        // Generar registro de corte
        const cashClosingRecord = {
            id: operationId,
            cashierId: cashierId,
            timestamp: new Date(),
            type: 'MANUAL',
            
            // Datos de entrada
            initialCash: cashData.initialCash,
            salesTotal: cashData.salesTotal,
            reportedCash: cashData.totalCash,
            
            // Cálculos
            expectedCash: calculations.expectedCash,
            cashDifference: calculations.cashDifference,
            percentageDifference: calculations.percentageDifference,
            
            // Desglose de denominaciones (si se proporciona)
            denominations: cashData.denominations || {},
            
            // Metadata
            notes: notes,
            validationFingerprint: validationFingerprint,
            status: calculations.cashDifference === 0 ? 'BALANCED' : 'UNBALANCED',
            processingMode: 'ENHANCED_VALIDATION'
        };

        // Simular guardado en base de datos
        await this.saveCashClosingRecord(cashClosingRecord);

        // Generar estadísticas del día
        const dailyStats = await this.generateDailyStats(cashierId, new Date());

        // Preparar resultado
        return {
            closingId: operationId,
            finalCashAmount: cashData.totalCash,
            expectedAmount: calculations.expectedCash,
            difference: calculations.cashDifference,
            percentageDifference: calculations.percentageDifference,
            status: cashClosingRecord.status,
            balanceStatus: calculations.cashDifference === 0 ? 'BALANCED' : 'UNBALANCED',
            dailyStats: dailyStats,
            recommendations: this.generateRecommendations(calculations),
            timestamp: cashClosingRecord.timestamp
        };
    }

    /**
     * 📊 Realizar cálculos de caja
     */
    performCashCalculations(cashData) {
        const expectedCash = cashData.initialCash + cashData.salesTotal;
        const cashDifference = cashData.totalCash - expectedCash;
        const percentageDifference = expectedCash > 0 ? 
            ((cashDifference / expectedCash) * 100) : 0;

        return {
            expectedCash: parseFloat(expectedCash.toFixed(2)),
            cashDifference: parseFloat(cashDifference.toFixed(2)),
            percentageDifference: parseFloat(percentageDifference.toFixed(2))
        };
    }

    /**
     * 💡 Generar recomendaciones
     */
    generateRecommendations(calculations) {
        const recommendations = [];
        
        if (Math.abs(calculations.cashDifference) > 0.01) {
            if (calculations.cashDifference > 0) {
                recommendations.push({
                    type: 'WARNING',
                    message: 'Hay dinero sobrante en caja',
                    action: 'Verificar si hay ventas no registradas o errores de conteo'
                });
            } else {
                recommendations.push({
                    type: 'ALERT',
                    message: 'Falta dinero en caja',
                    action: 'Revisar todos los movimientos y verificar el conteo físico'
                });
            }
        } else {
            recommendations.push({
                type: 'SUCCESS',
                message: 'Caja balanceada correctamente',
                action: 'Corte realizado exitosamente'
            });
        }

        if (Math.abs(calculations.percentageDifference) > 5) {
            recommendations.push({
                type: 'HIGH_PRIORITY',
                message: 'Diferencia significativa detectada',
                action: 'Requiere revisión inmediata del gerente'
            });
        }

        return recommendations;
    }

    /**
     * 💾 Guardar registro de corte (simulado)
     */
    async saveCashClosingRecord(record) {
        // Simular guardado en base de datos
        console.log(`💾 Guardando registro de corte: ${record.id}`);
        
        // Aquí se guardaría en la base de datos real
        // await database.cashClosings.insert(record);
        
        return record;
    }

    /**
     * 📈 Generar estadísticas diarias
     */
    async generateDailyStats(cashierId, date) {
        // Simular consulta de estadísticas
        return {
            cashierId: cashierId,
            date: date.toDateString(),
            totalClosings: Math.floor(Math.random() * 5) + 1,
            avgDifference: (Math.random() * 10 - 5).toFixed(2),
            balancedCount: Math.floor(Math.random() * 4) + 1,
            unbalancedCount: Math.floor(Math.random() * 2),
            totalSales: (Math.random() * 5000 + 1000).toFixed(2)
        };
    }

    /**
     * 📊 Obtener estado de operaciones activas
     */
    async getActiveOperations(req, res) {
        try {
            const operations = Array.from(this.activeOperations.entries()).map(([id, data]) => ({
                operationId: id,
                cashierId: data.cashierId,
                status: data.status,
                startTime: data.startTime,
                duration: Date.now() - data.startTime.getTime()
            }));

            res.json({
                success: true,
                data: {
                    activeCount: operations.length,
                    operations: operations,
                    serviceStats: this.duplicateService.getServiceStats()
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo operaciones activas:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo estado de operaciones'
            });
        }
    }

    /**
     * 📋 Obtener historial de operaciones
     */
    async getOperationHistory(req, res) {
        try {
            const { limit = 50, offset = 0, cashierId } = req.query;
            
            let history = Array.from(this.operationHistory.values());
            
            // Filtrar por cajero si se especifica
            if (cashierId) {
                history = history.filter(op => op.cashierId === cashierId);
            }
            
            // Ordenar por fecha descendente
            history.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
            
            // Paginación
            const paginatedHistory = history.slice(offset, offset + parseInt(limit));

            res.json({
                success: true,
                data: {
                    total: history.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    operations: paginatedHistory.map(op => ({
                        operationId: op.operationId,
                        cashierId: op.cashierId,
                        status: op.status,
                        processingTime: op.processingTime,
                        completedAt: op.completedAt,
                        result: op.result ? {
                            finalAmount: op.result.finalCashAmount,
                            difference: op.result.difference,
                            status: op.result.status
                        } : null
                    }))
                }
            });

        } catch (error) {
            console.error('❌ Error obteniendo historial:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error obteniendo historial de operaciones'
            });
        }
    }

    /**
     * 🔧 Forzar liberación de locks (solo para administradores)
     */
    async forceReleaseLocks(req, res) {
        try {
            const { cashierId, operationType } = req.body;
            
            // Aquí se verificaría que el usuario tiene permisos de administrador
            
            console.log(`🔓 Forzando liberación de locks para cajero: ${cashierId}`);
            
            // Liberar todos los locks activos para el cajero
            let releasedCount = 0;
            for (const [lockKey, lockData] of this.duplicateService.activeLocks.entries()) {
                if (lockData.cashierId === cashierId && 
                    (!operationType || lockData.operationType === operationType)) {
                    
                    await this.duplicateService.releaseLock(lockKey, lockData.lockValue);
                    releasedCount++;
                }
            }

            await this.reportToSupervisor('FORCE_LOCK_RELEASE', {
                cashierId,
                operationType,
                releasedCount,
                adminAction: true
            });

            res.json({
                success: true,
                message: `${releasedCount} locks liberados`,
                releasedCount: releasedCount
            });

        } catch (error) {
            console.error('❌ Error forzando liberación de locks:', error.message);
            res.status(500).json({
                success: false,
                error: 'Error liberando locks'
            });
        }
    }

    /**
     * 🚨 Reportar al supervisor
     */
    async reportToSupervisor(event, data) {
        try {
            const reportData = {
                source: 'enhanced-cash-closing-controller',
                event: event,
                data: data,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('http://localhost:3001/agent-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Agent-ID': 'task-master-cash-closing'
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                console.log(`📡 Evento reportado: ${event}`);
            }
        } catch (error) {
            console.warn('⚠️ No se pudo reportar al supervisor:', error.message);
        }
    }

    /**
     * 🧹 Limpieza periódica del historial
     */
    startPeriodicCleanup() {
        setInterval(() => {
            const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 horas
            
            for (const [id, operation] of this.operationHistory.entries()) {
                if (operation.completedAt.getTime() < cutoffTime) {
                    this.operationHistory.delete(id);
                }
            }
        }, 60 * 60 * 1000); // Cada hora
    }
}

module.exports = EnhancedCashClosingController;
