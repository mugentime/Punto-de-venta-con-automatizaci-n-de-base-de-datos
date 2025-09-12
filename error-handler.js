#!/usr/bin/env node

/**
 * ERROR HANDLER INTERFACE
 * Interfaz para enviar listas de errores al Agente Supervisor
 * Cada error iniciará una nueva instancia especializada de TaskMaster
 */

const SupervisorAgent = require('./supervisor-agent.js');

class ErrorHandler {
    constructor() {
        this.supervisor = null;
    }

    async initialize() {
        console.log('🎯 INICIALIZANDO ERROR HANDLER INTERFACE');
        this.supervisor = new SupervisorAgent();
        await this.supervisor.initialize();
        console.log('✅ Error Handler listo para procesar errores');
    }

    /**
     * Procesa una lista de errores y crea instancias especializadas
     * @param {Array} errorList - Lista de objetos de error
     */
    async processErrorList(errorList) {
        if (!Array.isArray(errorList)) {
            throw new Error('La lista de errores debe ser un array');
        }

        console.log(`📋 PROCESANDO ${errorList.length} ERRORES`);
        console.log('🚀 Iniciando creación de instancias especializadas...\n');

        // Validar y normalizar errores
        const validatedErrors = this.validateErrors(errorList);
        
        // Enviar al supervisor para crear instancias
        await this.supervisor.handleErrorList(validatedErrors);

        console.log('\n✅ PROCESAMIENTO COMPLETO');
        console.log(`📊 Total de instancias creadas: ${validatedErrors.length}`);
        
        // Mostrar resumen
        this.displaySummary(validatedErrors);
    }

    validateErrors(errorList) {
        return errorList.map((error, index) => {
            // Estructura básica requerida
            const validatedError = {
                type: this.normalizeErrorType(error.type || error.category || `error_${index}`),
                description: error.description || error.message || 'Error sin descripción',
                priority: this.normalizePriority(error.priority || error.severity || 'medium'),
                details: error.details || error,
                timestamp: error.timestamp || new Date().toISOString(),
                source: error.source || 'manual_input'
            };

            // Validaciones específicas
            if (!validatedError.type) {
                throw new Error(`Error ${index}: Tipo de error requerido`);
            }

            return validatedError;
        });
    }

    normalizeErrorType(type) {
        const typeMap = {
            'db': 'database',
            'database': 'database',
            'bd': 'database',
            'api': 'api',
            'endpoint': 'api',
            'rest': 'api',
            'ui': 'ui',
            'frontend': 'ui',
            'interface': 'ui',
            'auth': 'auth',
            'authentication': 'auth',
            'login': 'auth',
            'performance': 'performance',
            'perf': 'performance',
            'memory': 'performance',
            'cpu': 'performance',
            'network': 'network',
            'connection': 'network',
            'security': 'security',
            'validation': 'validation'
        };

        return typeMap[type.toLowerCase()] || type.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    normalizePriority(priority) {
        const priorityMap = {
            'critical': 'critical',
            'critico': 'critical',
            'p0': 'critical',
            'high': 'high',
            'alto': 'high',
            'p1': 'high',
            'medium': 'medium',
            'medio': 'medium',
            'p2': 'medium',
            'low': 'low',
            'bajo': 'low',
            'p3': 'low'
        };

        return priorityMap[priority.toLowerCase()] || 'medium';
    }

    displaySummary(errors) {
        console.log('\n📊 RESUMEN DE INSTANCIAS CREADAS:');
        console.log('═'.repeat(50));

        const summary = {};
        errors.forEach(error => {
            if (!summary[error.type]) {
                summary[error.type] = { count: 0, priorities: {} };
            }
            summary[error.type].count++;
            if (!summary[error.type].priorities[error.priority]) {
                summary[error.type].priorities[error.priority] = 0;
            }
            summary[error.type].priorities[error.priority]++;
        });

        Object.entries(summary).forEach(([type, info]) => {
            console.log(`🔧 ${type.toUpperCase()}: ${info.count} instancia(s)`);
            Object.entries(info.priorities).forEach(([priority, count]) => {
                const icon = priority === 'critical' ? '🚨' : priority === 'high' ? '⚠️' : priority === 'medium' ? '📋' : '📝';
                console.log(`   ${icon} ${priority}: ${count}`);
            });
        });

        console.log('\n🎮 COMANDOS DE CONTROL:');
        console.log('   📊 Status del Supervisor: curl http://localhost:3001/status');
        console.log('   🔄 Reiniciar Supervisor: node supervisor-agent.js');
        console.log('   📋 Ver instancias activas: ls instances/');
        console.log('   📝 Ver logs: ls supervisor-logs/');
    }

    // Ejemplos de uso
    static getExampleErrors() {
        return [
            {
                type: 'database',
                description: 'Error de conexión a la base de datos',
                priority: 'critical',
                details: {
                    error: 'Connection timeout',
                    table: 'users',
                    query: 'SELECT * FROM users WHERE active = 1'
                }
            },
            {
                type: 'api',
                description: 'Endpoint /api/users devuelve 500',
                priority: 'high',
                details: {
                    endpoint: '/api/users',
                    method: 'GET',
                    statusCode: 500,
                    responseTime: 15000
                }
            },
            {
                type: 'ui',
                description: 'Botón de login no responde en móvil',
                priority: 'medium',
                details: {
                    component: 'login-button',
                    platform: 'mobile',
                    browser: 'Safari iOS'
                }
            },
            {
                type: 'auth',
                description: 'Tokens JWT expiran prematuramente',
                priority: 'high',
                details: {
                    tokenType: 'JWT',
                    expectedExpiry: 3600,
                    actualExpiry: 300
                }
            }
        ];
    }
}

// API para uso desde línea de comandos
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🎯 ERROR HANDLER INTERFACE - TaskMaster Multi-Instance');
        console.log('\nUso:');
        console.log('  node error-handler.js [archivo.json]  # Procesar errores desde archivo');
        console.log('  node error-handler.js --example       # Ejecutar con errores de ejemplo');
        console.log('  node error-handler.js --interactive   # Modo interactivo');
        process.exit(0);
    }

    const handler = new ErrorHandler();
    
    (async () => {
        try {
            await handler.initialize();
            
            if (args[0] === '--example') {
                console.log('📋 Ejecutando con errores de ejemplo...\n');
                await handler.processErrorList(ErrorHandler.getExampleErrors());
            } else if (args[0] === '--interactive') {
                console.log('🎮 Modo interactivo - Ingresa tus errores:');
                console.log('(Formato: tipo|descripción|prioridad)');
                console.log('Ejemplo: database|Error de conexión|critical');
                console.log('Presiona Enter sin texto para finalizar\n');
                
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                const errors = [];
                
                const askError = () => {
                    rl.question('Error > ', (input) => {
                        if (!input.trim()) {
                            rl.close();
                            if (errors.length > 0) {
                                handler.processErrorList(errors);
                            } else {
                                console.log('No se ingresaron errores.');
                            }
                            return;
                        }
                        
                        const [type, description, priority] = input.split('|');
                        errors.push({
                            type: type?.trim(),
                            description: description?.trim() || 'Sin descripción',
                            priority: priority?.trim() || 'medium'
                        });
                        
                        askError();
                    });
                };
                
                askError();
            } else {
                // Cargar desde archivo
                const fs = require('fs');
                const filePath = args[0];
                
                if (!fs.existsSync(filePath)) {
                    console.error(`❌ Archivo no encontrado: ${filePath}`);
                    process.exit(1);
                }
                
                const errorData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                await handler.processErrorList(errorData);
            }
        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = ErrorHandler;
