/**
 * Sistema de Prevención de Duplicados - POS ConEJO NEGRO
 * 🔧 Reparación: Corte manual genera duplicados
 * 🛡️ TaskMaster: Anti-Duplicate Cash Closing System
 */

const Redis = require('redis');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class DuplicatePreventionService extends EventEmitter {
    constructor() {
        super();
        this.initializeService();
        this.activeLocks = new Map();
        this.processingQueue = new Map();
        this.duplicateAttempts = new Map();
        
        console.log('🛡️ TaskMaster: Sistema de Prevención de Duplicados Inicializado');
    }

    /**
     * 🔗 Inicializar conexiones y servicios
     */
    async initializeService() {
        try {
            // Conectar a Redis para locks distribuidos
            this.redis = Redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                retryDelayOnFailover: 100
            });

            await this.redis.connect();
            console.log('✅ Redis conectado para locks distribuidos');
            
            // Configurar TTL por defecto para locks
            this.lockTTL = 300; // 5 minutos

        } catch (error) {
            console.warn('⚠️ Redis no disponible, usando locks en memoria:', error.message);
            this.initializeMemoryFallback();
        }

        // Inicializar limpieza periódica
        this.startPeriodicCleanup();
    }

    /**
     * 📝 Inicializar sistema de memoria como fallback
     */
    initializeMemoryFallback() {
        this.memoryLocks = new Map();
        this.lockTimeouts = new Map();
    }

    /**
     * 🔐 Adquirir lock para prevenir duplicados
     */
    async acquireLock(cashierId, sessionId, operationType = 'manual_cash_closing') {
        const lockKey = this.generateLockKey(cashierId, operationType);
        const lockValue = this.generateLockValue(sessionId);
        
        try {
            let acquired = false;

            if (this.redis) {
                // Usar SET con NX (Not eXists) y EX (EXpire)
                const result = await this.redis.setNX(lockKey, lockValue);
                if (result) {
                    await this.redis.expire(lockKey, this.lockTTL);
                    acquired = true;
                }
            } else {
                // Fallback a memoria
                if (!this.memoryLocks.has(lockKey)) {
                    this.memoryLocks.set(lockKey, lockValue);
                    
                    // Set timeout para auto-expirar
                    const timeout = setTimeout(() => {
                        this.memoryLocks.delete(lockKey);
                        this.lockTimeouts.delete(lockKey);
                    }, this.lockTTL * 1000);
                    
                    this.lockTimeouts.set(lockKey, timeout);
                    acquired = true;
                }
            }

            if (acquired) {
                this.activeLocks.set(lockKey, {
                    cashierId,
                    sessionId,
                    lockValue,
                    acquiredAt: new Date(),
                    operationType
                });

                console.log(`🔒 Lock adquirido: ${lockKey} por ${cashierId}`);
                
                // Reportar al supervisor
                await this.reportToSupervisor('LOCK_ACQUIRED', {
                    cashierId,
                    operationType,
                    lockKey
                });

                return { success: true, lockKey, lockValue };
            } else {
                console.warn(`🚫 Lock ya existe: ${lockKey}`);
                
                // Registrar intento duplicado
                await this.logDuplicateAttempt(cashierId, operationType);
                
                return { 
                    success: false, 
                    error: 'OPERATION_IN_PROGRESS',
                    message: 'Ya hay un corte de caja en progreso para este cajero'
                };
            }

        } catch (error) {
            console.error('❌ Error adquiriendo lock:', error.message);
            return {
                success: false,
                error: 'LOCK_ERROR',
                message: 'Error interno del sistema de locks'
            };
        }
    }

    /**
     * 🔓 Liberar lock
     */
    async releaseLock(lockKey, lockValue) {
        try {
            let released = false;

            if (this.redis) {
                // Verificar que el lock nos pertenece antes de liberarlo
                const currentValue = await this.redis.get(lockKey);
                if (currentValue === lockValue) {
                    await this.redis.del(lockKey);
                    released = true;
                }
            } else {
                // Fallback a memoria
                const currentValue = this.memoryLocks.get(lockKey);
                if (currentValue === lockValue) {
                    this.memoryLocks.delete(lockKey);
                    
                    // Limpiar timeout
                    const timeout = this.lockTimeouts.get(lockKey);
                    if (timeout) {
                        clearTimeout(timeout);
                        this.lockTimeouts.delete(lockKey);
                    }
                    released = true;
                }
            }

            if (released) {
                this.activeLocks.delete(lockKey);
                console.log(`🔓 Lock liberado: ${lockKey}`);
                
                // Reportar liberación
                await this.reportToSupervisor('LOCK_RELEASED', { lockKey });
                
                return { success: true };
            } else {
                console.warn(`⚠️ No se pudo liberar lock: ${lockKey} (valor no coincide)`);
                return { success: false, error: 'INVALID_LOCK_VALUE' };
            }

        } catch (error) {
            console.error('❌ Error liberando lock:', error.message);
            return { success: false, error: 'RELEASE_ERROR' };
        }
    }

    /**
     * 🆔 Validar operación de corte manual
     */
    async validateCashClosingOperation(operationData) {
        const { cashierId, sessionId, cashData, timestamp } = operationData;
        
        // Generar fingerprint de la operación
        const operationFingerprint = this.generateOperationFingerprint(operationData);
        
        // Verificar duplicados recientes (últimos 30 minutos)
        const isDuplicate = await this.checkForDuplicate(operationFingerprint);
        if (isDuplicate) {
            console.warn('🚫 Operación duplicada detectada:', operationFingerprint);
            
            await this.reportToSupervisor('DUPLICATE_DETECTED', {
                cashierId,
                operationFingerprint,
                timestamp: new Date()
            });

            return {
                valid: false,
                error: 'DUPLICATE_OPERATION',
                message: 'Esta operación de corte ya fue procesada recientemente'
            };
        }

        // Validar integridad de los datos
        const dataValidation = this.validateCashData(cashData);
        if (!dataValidation.valid) {
            console.error('❌ Datos de corte inválidos:', dataValidation.errors);
            return {
                valid: false,
                error: 'INVALID_DATA',
                message: 'Los datos del corte de caja son inválidos',
                details: dataValidation.errors
            };
        }

        // Registrar operación para detección futura
        await this.recordOperation(operationFingerprint, operationData);

        return {
            valid: true,
            operationFingerprint,
            validatedAt: new Date()
        };
    }

    /**
     * 📊 Validar datos de caja
     */
    validateCashData(cashData) {
        const errors = [];
        
        // Verificar campos requeridos
        if (!cashData.totalCash || typeof cashData.totalCash !== 'number') {
            errors.push('totalCash debe ser un número válido');
        }
        
        if (!cashData.salesTotal || typeof cashData.salesTotal !== 'number') {
            errors.push('salesTotal debe ser un número válido');
        }

        if (!cashData.initialCash || typeof cashData.initialCash !== 'number') {
            errors.push('initialCash debe ser un número válido');
        }

        // Validar lógica de negocio
        const expectedCash = cashData.initialCash + cashData.salesTotal;
        const tolerance = 0.01; // Tolerancia de 1 centavo
        
        if (Math.abs(cashData.totalCash - expectedCash) > tolerance) {
            errors.push(`Inconsistencia en caja: esperado ${expectedCash}, reportado ${cashData.totalCash}`);
        }

        // Verificar totales no negativos
        if (cashData.totalCash < 0 || cashData.salesTotal < 0 || cashData.initialCash < 0) {
            errors.push('Los valores no pueden ser negativos');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * 🆔 Generar fingerprint único de operación
     */
    generateOperationFingerprint(operationData) {
        const { cashierId, cashData, timestamp } = operationData;
        
        // Normalizar timestamp a minutos (para detectar operaciones muy cercanas)
        const normalizedTime = Math.floor(new Date(timestamp).getTime() / (1000 * 60));
        
        const fingerprint = `${cashierId}_${cashData.totalCash}_${cashData.salesTotal}_${normalizedTime}`;
        
        return crypto.createHash('sha256').update(fingerprint).digest('hex').substring(0, 16);
    }

    /**
     * 🔍 Verificar duplicados
     */
    async checkForDuplicate(fingerprint) {
        const duplicateKey = `dup_${fingerprint}`;
        
        try {
            if (this.redis) {
                const exists = await this.redis.exists(duplicateKey);
                return exists === 1;
            } else {
                return this.duplicateAttempts.has(duplicateKey);
            }
        } catch (error) {
            console.error('❌ Error verificando duplicados:', error.message);
            return false; // En caso de error, permitir la operación
        }
    }

    /**
     * 📝 Registrar operación
     */
    async recordOperation(fingerprint, operationData) {
        const duplicateKey = `dup_${fingerprint}`;
        const expireTime = 1800; // 30 minutos
        
        try {
            if (this.redis) {
                await this.redis.setEx(duplicateKey, expireTime, JSON.stringify({
                    ...operationData,
                    recordedAt: new Date()
                }));
            } else {
                this.duplicateAttempts.set(duplicateKey, {
                    ...operationData,
                    recordedAt: new Date()
                });
                
                // Auto-limpiar después de 30 minutos
                setTimeout(() => {
                    this.duplicateAttempts.delete(duplicateKey);
                }, expireTime * 1000);
            }
        } catch (error) {
            console.error('❌ Error registrando operación:', error.message);
        }
    }

    /**
     * 📊 Registrar intento duplicado
     */
    async logDuplicateAttempt(cashierId, operationType) {
        const attemptKey = `attempts_${cashierId}_${operationType}`;
        const attemptData = {
            cashierId,
            operationType,
            attemptedAt: new Date(),
            count: 1
        };

        try {
            if (this.redis) {
                const existing = await this.redis.get(attemptKey);
                if (existing) {
                    const data = JSON.parse(existing);
                    attemptData.count = data.count + 1;
                }
                await this.redis.setEx(attemptKey, 3600, JSON.stringify(attemptData)); // 1 hora
            }

            // Alerta si hay muchos intentos duplicados
            if (attemptData.count >= 3) {
                await this.reportToSupervisor('HIGH_DUPLICATE_ATTEMPTS', {
                    cashierId,
                    operationType,
                    attempts: attemptData.count
                });
            }

        } catch (error) {
            console.error('❌ Error registrando intento duplicado:', error.message);
        }
    }

    /**
     * 🔧 Funciones de utilidad
     */
    generateLockKey(cashierId, operationType) {
        return `lock_${operationType}_${cashierId}`;
    }

    generateLockValue(sessionId) {
        return `${sessionId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * 🧹 Limpieza periódica
     */
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupExpiredLocks();
        }, 60000); // Cada minuto
    }

    async cleanupExpiredLocks() {
        const now = Date.now();
        
        for (const [lockKey, lockData] of this.activeLocks.entries()) {
            const expiredTime = lockData.acquiredAt.getTime() + (this.lockTTL * 1000);
            
            if (now > expiredTime) {
                console.log(`🧹 Limpiando lock expirado: ${lockKey}`);
                this.activeLocks.delete(lockKey);
                
                // También limpiar de Redis/memoria si es necesario
                if (this.redis) {
                    await this.redis.del(lockKey).catch(() => {});
                } else if (this.memoryLocks) {
                    this.memoryLocks.delete(lockKey);
                }
            }
        }
    }

    /**
     * 🚨 Reportar al supervisor
     */
    async reportToSupervisor(event, data) {
        try {
            const reportData = {
                source: 'duplicate-prevention-service',
                event: event,
                data: data,
                timestamp: new Date().toISOString()
            };

            const response = await fetch('http://localhost:3001/agent-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Agent-ID': 'task-master-duplicate-preventer'
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
     * 📈 Obtener estadísticas del servicio
     */
    getServiceStats() {
        return {
            activeLocks: this.activeLocks.size,
            duplicateAttempts: this.duplicateAttempts.size,
            processingQueue: this.processingQueue.size,
            redisConnected: !!this.redis,
            uptime: process.uptime()
        };
    }

    /**
     * 🔄 Middleware para Express
     */
    createMiddleware() {
        return async (req, res, next) => {
            if (req.path === '/api/cash-closing/manual' && req.method === 'POST') {
                const { cashierId, sessionId } = req.body;
                
                // Adquirir lock
                const lockResult = await this.acquireLock(cashierId, sessionId);
                if (!lockResult.success) {
                    return res.status(409).json({
                        success: false,
                        error: lockResult.error,
                        message: lockResult.message
                    });
                }

                // Agregar datos del lock al request
                req.lockData = lockResult;
                
                // Middleware para liberar lock automáticamente
                const originalSend = res.send;
                res.send = async function(data) {
                    await this.releaseLock(req.lockData.lockKey, req.lockData.lockValue);
                    originalSend.call(this, data);
                }.bind(this);
            }
            
            next();
        };
    }
}

module.exports = DuplicatePreventionService;
