#!/usr/bin/env node

/**
 * 📢 DEPLOY NOTIFIER SYSTEM
 * 
 * Sistema de notificaciones para el agente de monitoreo de deploys de Render.
 * Maneja alertas, confirmaciones y logs históricos.
 * 
 * Creado por Task Master como arquitecto principal
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

class DeployNotifier {
    constructor() {
        this.config = {
            // Configuración de notificaciones
            enableNotifications: process.env.ENABLE_DEPLOY_NOTIFICATIONS !== 'false',
            discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
            slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
            emailConfig: {
                enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
                smtp: process.env.SMTP_HOST,
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
                to: process.env.NOTIFICATION_EMAIL
            },
            
            // Archivos
            logFile: path.join(__dirname, '../logs/notifications.log'),
            alertHistoryFile: path.join(__dirname, '../logs/alert-history.json'),
            
            // Configuración de alertas
            retryAttempts: 3,
            retryDelay: 5000,
            
            // Plantillas de mensajes
            templates: {
                deploySuccess: {
                    title: '🎉 Deploy Exitoso',
                    color: 0x00FF00, // Verde
                    emoji: '✅'
                },
                deployFailure: {
                    title: '❌ Deploy Fallido',
                    color: 0xFF0000, // Rojo
                    emoji: '🚨'
                },
                deployStarted: {
                    title: '🚀 Deploy Iniciado',
                    color: 0xFFFF00, // Amarillo
                    emoji: '⏳'
                },
                validation_failed: {
                    title: '⚠️ Validación Fallida',
                    color: 0xFFA500, // Naranja
                    emoji: '⚠️'
                }
            }
        };

        this.alertHistory = this.loadAlertHistory();
        this.ensureLogDirectory();
    }

    /**
     * Enviar notificación de deploy exitoso
     */
    async notifyDeploySuccess(deployInfo) {
        const template = this.config.templates.deploySuccess;
        const message = this.buildMessage(template, {
            title: `${template.emoji} Deploy completado exitosamente`,
            description: `El deploy del commit ${deployInfo.commitHash?.substring(0, 8)} se completó correctamente.`,
            fields: [
                {
                    name: 'Repositorio',
                    value: deployInfo.repository || 'POS-CONEJONEGRO',
                    inline: true
                },
                {
                    name: 'Branch',
                    value: deployInfo.branch || 'main',
                    inline: true
                },
                {
                    name: 'Servicio',
                    value: deployInfo.serviceName || 'pos-conejo-negro',
                    inline: true
                },
                {
                    name: 'Commit',
                    value: deployInfo.commitHash?.substring(0, 8) || 'Unknown',
                    inline: true
                },
                {
                    name: 'Tiempo',
                    value: new Date().toLocaleString('es-ES'),
                    inline: true
                },
                {
                    name: 'Estado',
                    value: deployInfo.status || 'Completed',
                    inline: true
                }
            ],
            url: deployInfo.deployUrl
        });

        await this.sendNotifications(message, 'deploy_success');
        this.recordAlert('deploy_success', message);
    }

    /**
     * Enviar notificación de deploy fallido
     */
    async notifyDeployFailure(deployInfo, error) {
        const template = this.config.templates.deployFailure;
        const message = this.buildMessage(template, {
            title: `${template.emoji} Deploy fallido - Revisión necesaria`,
            description: `El deploy del commit ${deployInfo.commitHash?.substring(0, 8)} falló. Se requiere intervención manual.`,
            fields: [
                {
                    name: 'Error',
                    value: error?.message || 'Error desconocido',
                    inline: false
                },
                {
                    name: 'Repositorio',
                    value: deployInfo.repository || 'POS-CONEJONEGRO',
                    inline: true
                },
                {
                    name: 'Branch',
                    value: deployInfo.branch || 'main',
                    inline: true
                },
                {
                    name: 'Commit',
                    value: deployInfo.commitHash?.substring(0, 8) || 'Unknown',
                    inline: true
                },
                {
                    name: 'Tiempo',
                    value: new Date().toLocaleString('es-ES'),
                    inline: true
                },
                {
                    name: 'Acción Requerida',
                    value: '⚠️ Revisar logs y reintentar deploy manualmente',
                    inline: false
                }
            ]
        });

        await this.sendNotifications(message, 'deploy_failure');
        this.recordAlert('deploy_failure', message, error);
    }

    /**
     * Enviar notificación de deploy iniciado
     */
    async notifyDeployStarted(deployInfo) {
        const template = this.config.templates.deployStarted;
        const message = this.buildMessage(template, {
            title: `${template.emoji} Deploy iniciado`,
            description: `Iniciando deploy automático del commit ${deployInfo.commitHash?.substring(0, 8)}.`,
            fields: [
                {
                    name: 'Commit Message',
                    value: deployInfo.commitMessage || 'No disponible',
                    inline: false
                },
                {
                    name: 'Autor',
                    value: deployInfo.author || 'Unknown',
                    inline: true
                },
                {
                    name: 'Tiempo Estimado',
                    value: '2-3 minutos',
                    inline: true
                }
            ]
        });

        await this.sendNotifications(message, 'deploy_started');
        this.recordAlert('deploy_started', message);
    }

    /**
     * Enviar notificación de validación fallida
     */
    async notifyValidationFailure(validationResults) {
        const template = this.config.templates.validation_failed;
        const failedValidations = validationResults.filter(v => v.includes('❌'));
        
        const message = this.buildMessage(template, {
            title: `${template.emoji} Validaciones pre-deploy fallidas`,
            description: `Se detectaron ${failedValidations.length} validaciones fallidas que impiden el deploy.`,
            fields: [
                {
                    name: 'Validaciones Fallidas',
                    value: failedValidations.join('\\n') || 'No especificadas',
                    inline: false
                },
                {
                    name: 'Acción Requerida',
                    value: '🔧 Corregir errores y hacer nuevo commit',
                    inline: false
                }
            ]
        });

        await this.sendNotifications(message, 'validation_failure');
        this.recordAlert('validation_failure', message);
    }

    /**
     * Construir mensaje usando template
     */
    buildMessage(template, data) {
        return {
            embeds: [{
                title: data.title,
                description: data.description,
                color: template.color,
                fields: data.fields || [],
                timestamp: new Date().toISOString(),
                url: data.url,
                footer: {
                    text: 'Render Deploy Monitor Agent'
                }
            }]
        };
    }

    /**
     * Enviar notificaciones a todos los canales configurados
     */
    async sendNotifications(message, type) {
        if (!this.config.enableNotifications) {
            this.log('📴 Notificaciones deshabilitadas');
            return;
        }

        const promises = [];

        // Discord
        if (this.config.discordWebhookUrl) {
            promises.push(this.sendDiscordNotification(message));
        }

        // Slack
        if (this.config.slackWebhookUrl) {
            promises.push(this.sendSlackNotification(message));
        }

        // Email (simplificado)
        if (this.config.emailConfig.enabled) {
            promises.push(this.sendEmailNotification(message, type));
        }

        // Ejecutar todas las notificaciones en paralelo
        const results = await Promise.allSettled(promises);
        
        // Log resultados
        results.forEach((result, index) => {
            const channel = ['Discord', 'Slack', 'Email'][index];
            if (result.status === 'fulfilled') {
                this.log(`✅ Notificación ${channel} enviada correctamente`);
            } else {
                this.log(`❌ Error enviando notificación ${channel}:`, result.reason?.message);
            }
        });
    }

    /**
     * Enviar notificación a Discord
     */
    async sendDiscordNotification(message) {
        return this.sendWebhookNotification(this.config.discordWebhookUrl, message);
    }

    /**
     * Enviar notificación a Slack
     */
    async sendSlackNotification(message) {
        // Adaptar formato para Slack
        const slackMessage = {
            text: message.embeds[0].title,
            attachments: [{
                color: message.embeds[0].color === 0x00FF00 ? 'good' : 
                       message.embeds[0].color === 0xFF0000 ? 'danger' : 'warning',
                fields: message.embeds[0].fields.map(field => ({
                    title: field.name,
                    value: field.value,
                    short: field.inline
                })),
                footer: 'Render Deploy Monitor Agent',
                ts: Math.floor(Date.now() / 1000)
            }]
        };

        return this.sendWebhookNotification(this.config.slackWebhookUrl, slackMessage);
    }

    /**
     * Enviar notificación por email (simplificado)
     */
    async sendEmailNotification(message, type) {
        // Implementación simplificada - en producción usar nodemailer o similar
        this.log(`📧 Email notification would be sent: ${message.embeds[0].title}`);
        return Promise.resolve();
    }

    /**
     * Enviar webhook notification genérico
     */
    async sendWebhookNotification(webhookUrl, message) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify(message);
            const url = new URL(webhookUrl);
            
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data),
                    'User-Agent': 'RenderDeployMonitor/1.0'
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(responseData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Registrar alerta en historial
     */
    recordAlert(type, message, error = null) {
        const alertRecord = {
            id: Date.now().toString(),
            type,
            timestamp: new Date().toISOString(),
            message: message.embeds[0].title,
            description: message.embeds[0].description,
            error: error ? {
                message: error.message,
                stack: error.stack
            } : null
        };

        this.alertHistory.alerts.unshift(alertRecord);
        
        // Mantener solo las últimas 200 alertas
        if (this.alertHistory.alerts.length > 200) {
            this.alertHistory.alerts = this.alertHistory.alerts.slice(0, 200);
        }

        this.alertHistory.lastUpdate = new Date().toISOString();
        this.alertHistory.totalAlerts = this.alertHistory.alerts.length;
        
        this.saveAlertHistory();
        this.log(`📋 Alerta registrada: ${type} - ${alertRecord.id}`);
    }

    /**
     * Cargar historial de alertas
     */
    loadAlertHistory() {
        try {
            if (fs.existsSync(this.config.alertHistoryFile)) {
                return JSON.parse(fs.readFileSync(this.config.alertHistoryFile, 'utf8'));
            }
        } catch (error) {
            this.log('⚠️ Error al cargar historial de alertas:', error.message);
        }

        return {
            alerts: [],
            lastUpdate: new Date().toISOString(),
            totalAlerts: 0
        };
    }

    /**
     * Guardar historial de alertas
     */
    saveAlertHistory() {
        try {
            fs.writeFileSync(this.config.alertHistoryFile, JSON.stringify(this.alertHistory, null, 2));
        } catch (error) {
            this.log('❌ Error al guardar historial de alertas:', error.message);
        }
    }

    /**
     * Generar reporte de alertas
     */
    generateAlertReport() {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const recentAlerts = this.alertHistory.alerts.filter(alert => 
            new Date(alert.timestamp) > last24h
        );

        const alertTypes = recentAlerts.reduce((acc, alert) => {
            acc[alert.type] = (acc[alert.type] || 0) + 1;
            return acc;
        }, {});

        const report = {
            timestamp: now.toISOString(),
            totalAlerts: this.alertHistory.totalAlerts,
            alertsLast24h: recentAlerts.length,
            alertTypeBreakdown: alertTypes,
            recentAlerts: recentAlerts.slice(0, 10).map(alert => ({
                type: alert.type,
                message: alert.message,
                timestamp: alert.timestamp
            }))
        };

        this.log('📊 Reporte de alertas generado:', JSON.stringify(report, null, 2));
        return report;
    }

    /**
     * Test de notificaciones
     */
    async testNotifications() {
        this.log('🧪 Iniciando test de notificaciones...');
        
        const testMessage = {
            embeds: [{
                title: '🧪 Test de Notificaciones',
                description: 'Este es un mensaje de prueba del sistema de notificaciones.',
                color: 0x0099FF,
                fields: [
                    {
                        name: 'Estado',
                        value: 'Test en progreso',
                        inline: true
                    },
                    {
                        name: 'Timestamp',
                        value: new Date().toLocaleString('es-ES'),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'Render Deploy Monitor Agent - Test'
                }
            }]
        };

        await this.sendNotifications(testMessage, 'test');
        this.log('✅ Test de notificaciones completado');
    }

    /**
     * Utilidades
     */
    ensureLogDirectory() {
        const logDir = path.dirname(this.config.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(message, ...args) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [NOTIFIER] ${message}`;
        
        console.log(logMessage, ...args);
        
        try {
            fs.appendFileSync(this.config.logFile, logMessage + '\\n');
        } catch (error) {
            console.error('Error escribiendo al log file:', error.message);
        }
    }
}

// CLI Interface
if (require.main === module) {
    const command = process.argv[2];
    const notifier = new DeployNotifier();
    
    switch (command) {
        case 'test':
            notifier.testNotifications();
            break;
        case 'report':
            notifier.generateAlertReport();
            break;
        case 'history':
            console.log(JSON.stringify(notifier.alertHistory, null, 2));
            break;
        case 'help':
        default:
            console.log(`
📢 Deploy Notifier System

Uso: node deploy-notifier.js [comando]

Comandos:
  test      - Enviar notificación de prueba
  report    - Generar reporte de alertas
  history   - Mostrar historial de alertas
  help      - Mostrar esta ayuda

Variables de entorno:
  ENABLE_DEPLOY_NOTIFICATIONS  - Habilitar/deshabilitar notificaciones (default: true)
  DISCORD_WEBHOOK_URL          - URL del webhook de Discord
  SLACK_WEBHOOK_URL            - URL del webhook de Slack
  EMAIL_NOTIFICATIONS          - Habilitar notificaciones por email (default: false)
  NOTIFICATION_EMAIL           - Email de destino para notificaciones

Ejemplo:
  node deploy-notifier.js test
            `);
            break;
    }
}

module.exports = DeployNotifier;
