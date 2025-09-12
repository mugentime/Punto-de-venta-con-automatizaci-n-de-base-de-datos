#!/usr/bin/env node

/**
 * 🎯 RENDER DEPLOY AGENT - STARTER SCRIPT
 * 
 * Script principal que integra todos los componentes del sistema de monitoreo
 * de deploys automáticos de Render.
 * 
 * Componentes:
 * - Monitor de deploys automáticos
 * - Sistema de notificaciones
 * - Validador pre-deploy
 * 
 * Creado por Task Master como arquitecto principal
 */

const RenderDeployMonitor = require('./agents/render-deploy-monitor');
const DeployNotifier = require('./agents/deploy-notifier');
const DeployValidator = require('./agents/deploy-validator');

class IntegratedDeployAgent {
    constructor() {
        this.monitor = new RenderDeployMonitor();
        this.notifier = new DeployNotifier();
        this.validator = new DeployValidator();
        
        this.isRunning = false;
        this.config = {
            enableValidations: true,
            enableNotifications: true,
            validationScoreThreshold: 80,
            monitorInterval: 30000 // 30 segundos
        };

        this.log('🎯 Integrated Deploy Agent inicializado');
        this.setupEventHandlers();
    }

    /**
     * Configurar event handlers entre componentes
     */
    setupEventHandlers() {
        // Sobrescribir el método de verificación de commits del monitor
        const originalCheckForNewCommits = this.monitor.checkForNewCommits.bind(this.monitor);
        
        this.monitor.checkForNewCommits = () => {
            const result = originalCheckForNewCommits();
            
            if (result.hasChanges && !result.needsPush) {
                this.handleNewCommit(result);
            }
            
            return result;
        };
    }

    /**
     * Manejar nuevo commit detectado
     */
    async handleNewCommit(commitInfo) {
        this.log(`🔄 Procesando nuevo commit: ${commitInfo.commitHash?.substring(0, 8)}`);

        try {
            // 1. Notificar que el deploy ha iniciado
            if (this.config.enableNotifications) {
                await this.notifier.notifyDeployStarted({
                    commitHash: commitInfo.commitHash,
                    commitMessage: commitInfo.message,
                    author: commitInfo.author,
                    repository: this.monitor.config.repository,
                    serviceName: this.monitor.config.serviceName,
                    branch: this.monitor.config.branch
                });
            }

            // 2. Ejecutar validaciones pre-deploy si están habilitadas
            let validationResults = null;
            if (this.config.enableValidations) {
                this.log('🔍 Ejecutando validaciones pre-deploy...');
                validationResults = await this.validator.runAllValidations();
                
                // Si las validaciones fallan, notificar
                if (!validationResults.passed) {
                    this.log(`❌ Validaciones fallaron (Score: ${validationResults.score}%)`);
                    
                    if (this.config.enableNotifications) {
                        await this.notifier.notifyValidationFailure(validationResults.validations);
                    }
                    
                    return; // No continuar con el deploy si las validaciones fallan
                }
                
                this.log(`✅ Validaciones pasaron (Score: ${validationResults.score}%)`);
            }

            // 3. El deploy automático se ejecutará por Render
            // Aquí monitoreamos y esperamos el resultado
            this.log('⏳ Esperando resultado del deploy automático...');
            
            // 4. Verificar estado del deploy (implementación básica)
            const deployResult = await this.monitor.checkRenderDeployStatus(commitInfo.commitHash);
            
            // 5. Notificar resultado final
            if (this.config.enableNotifications) {
                const deployInfo = {
                    commitHash: commitInfo.commitHash,
                    repository: this.monitor.config.repository,
                    serviceName: this.monitor.config.serviceName,
                    branch: this.monitor.config.branch,
                    status: deployResult.status,
                    validationScore: validationResults?.score
                };

                if (deployResult.status.includes('successful') || deployResult.status.includes('assumed')) {
                    await this.notifier.notifyDeploySuccess(deployInfo);
                    this.log('🎉 Deploy completado y notificado exitosamente');
                } else {
                    await this.notifier.notifyDeployFailure(deployInfo, new Error('Deploy may have failed'));
                    this.log('⚠️ Deploy puede haber fallado - notificación enviada');
                }
            }

        } catch (error) {
            this.log('❌ Error procesando nuevo commit:', error.message);
            
            if (this.config.enableNotifications) {
                await this.notifier.notifyDeployFailure({
                    commitHash: commitInfo.commitHash,
                    repository: this.monitor.config.repository,
                    serviceName: this.monitor.config.serviceName,
                    branch: this.monitor.config.branch
                }, error);
            }
        }
    }

    /**
     * Iniciar el agente integrado
     */
    async start() {
        if (this.isRunning) {
            this.log('⚠️ El agente ya está ejecutándose');
            return;
        }

        this.isRunning = true;
        this.log('🚀 Iniciando Integrated Deploy Agent...');
        
        // Mostrar configuración inicial
        this.showConfiguration();
        
        // Test inicial de notificaciones (opcional)
        if (process.argv.includes('--test-notifications')) {
            this.log('🧪 Ejecutando test de notificaciones...');
            await this.notifier.testNotifications();
        }

        // Validación inicial (opcional)
        if (process.argv.includes('--validate-on-start')) {
            this.log('🔍 Ejecutando validación inicial...');
            const initialValidation = await this.validator.runAllValidations();
            if (!initialValidation.passed) {
                this.log('⚠️ Validación inicial falló - continuando monitoreo pero con alertas');
            }
        }

        // Iniciar el monitor principal
        this.monitor.startMonitoring();
        
        this.log('✅ Integrated Deploy Agent ejecutándose correctamente');
    }

    /**
     * Detener el agente integrado
     */
    stop() {
        if (!this.isRunning) {
            this.log('⚠️ El agente no está ejecutándose');
            return;
        }

        this.log('⏹️ Deteniendo Integrated Deploy Agent...');
        this.monitor.stopMonitoring();
        this.isRunning = false;
        this.log('✅ Agente detenido correctamente');
    }

    /**
     * Mostrar configuración actual
     */
    showConfiguration() {
        const config = {
            service: this.monitor.config.serviceName,
            repository: this.monitor.config.repository,
            branch: this.monitor.config.branch,
            validations: this.config.enableValidations ? '✅ Enabled' : '❌ Disabled',
            notifications: this.config.enableNotifications ? '✅ Enabled' : '❌ Disabled',
            validationThreshold: `${this.config.validationScoreThreshold}%`,
            monitorInterval: `${this.config.monitorInterval/1000}s`,
            discordWebhook: this.notifier.config.discordWebhookUrl ? '✅ Configured' : '❌ Not configured',
            slackWebhook: this.notifier.config.slackWebhookUrl ? '✅ Configured' : '❌ Not configured'
        };

        this.log('📋 Configuración del Integrated Deploy Agent:');
        Object.entries(config).forEach(([key, value]) => {
            this.log(`   ${key}: ${value}`);
        });
    }

    /**
     * Generar reporte de estado completo
     */
    generateStatusReport() {
        const monitorReport = this.monitor.generateStatusReport();
        const validationReport = this.validator.generateValidationReport();
        const alertReport = this.notifier.generateAlertReport();

        const integratedReport = {
            timestamp: new Date().toISOString(),
            agent: {
                running: this.isRunning,
                uptime: this.isRunning ? 'Active' : 'Stopped'
            },
            monitor: monitorReport,
            validator: validationReport,
            notifications: alertReport
        };

        this.log('📊 Reporte de estado integrado generado');
        console.log(JSON.stringify(integratedReport, null, 2));
        
        return integratedReport;
    }

    /**
     * Ejecutar validación manual
     */
    async runValidation() {
        this.log('🔍 Ejecutando validación manual...');
        const result = await this.validator.runAllValidations();
        
        if (result.passed) {
            this.log(`✅ Validación manual exitosa (Score: ${result.score}%)`);
        } else {
            this.log(`❌ Validación manual falló (Score: ${result.score}%)`);
            result.errors.forEach(error => {
                this.log(`   - ${error.message}`);
            });
        }

        return result;
    }

    /**
     * Logging integrado
     */
    log(message, ...args) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [INTEGRATED-AGENT] ${message}`;
        
        console.log(logMessage, ...args);
    }
}

// CLI Interface
function main() {
    const agent = new IntegratedDeployAgent();
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            agent.start();
            
            // Manejar señales para parar el agente limpiamente
            process.on('SIGINT', () => {
                console.log('\n🛑 Deteniendo agente integrado...');
                agent.stop();
                process.exit(0);
            });

            process.on('SIGTERM', () => {
                console.log('\n🛑 Deteniendo agente integrado...');
                agent.stop();
                process.exit(0);
            });
            break;

        case 'status':
            agent.generateStatusReport();
            break;

        case 'validate':
            agent.runValidation().then(result => {
                process.exit(result.passed ? 0 : 1);
            });
            break;

        case 'test-notifications':
            agent.notifier.testNotifications();
            break;

        case 'help':
        default:
            console.log(`
🎯 Integrated Render Deploy Agent

Uso: node start-deploy-agent.js [comando] [opciones]

Comandos:
  start                - Iniciar monitoreo integrado
  status               - Mostrar estado completo del sistema
  validate             - Ejecutar validación manual
  test-notifications   - Probar sistema de notificaciones
  help                 - Mostrar esta ayuda

Opciones (solo con 'start'):
  --test-notifications - Ejecutar test de notificaciones al inicio
  --validate-on-start  - Ejecutar validación inicial

El agente integra:
  🔍 Monitor de deploys automáticos
  ✅ Validador pre-deploy 
  📢 Sistema de notificaciones
  📊 Reportes y métricas

Ejemplos:
  node start-deploy-agent.js start
  node start-deploy-agent.js start --test-notifications
  node start-deploy-agent.js status
  node start-deploy-agent.js validate

Variables de entorno opcionales:
  DISCORD_WEBHOOK_URL    - Para notificaciones Discord
  SLACK_WEBHOOK_URL      - Para notificaciones Slack
  RENDER_API_TOKEN       - Para verificaciones avanzadas
            `);
            break;
    }
}

// Solo ejecutar si es el archivo principal
if (require.main === module) {
    main();
}

module.exports = IntegratedDeployAgent;
