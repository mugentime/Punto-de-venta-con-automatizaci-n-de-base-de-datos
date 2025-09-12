#!/usr/bin/env node

/**
 * AGENTE SUPERVISOR PRINCIPAL - TaskMaster Multi-Instance Controller
 * Capacidades especiales: Desktop Commander MCP para control de múltiples instancias Warp
 * Arquitectura: Un supervisor controla N instancias especializadas
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class SupervisorAgent {
    constructor() {
        this.instanceId = 'SUPERVISOR-MAIN';
        this.instances = new Map(); // Mapa de instancias activas
        this.errorTypes = new Map(); // Tipos de errores registrados
        this.config = {
            project: {
                name: 'POS-CONEJONEGRO',
                repository: 'mugentime/POS-CONEJONEGRO',
                supervisor: true
            },
            desktop_commander: {
                enabled: true,
                warp_path: 'C:\\Users\\je2al\\AppData\\Local\\warp\\warp.exe',
                max_instances: 10,
                communication_port: 3001
            },
            instances: {
                base_config: './taskmaster.config.json',
                logs_dir: './supervisor-logs',
                instances_dir: './instances'
            },
            intervals: {
                health_check: 30 * 1000, // 30 segundos
                instance_sync: 60 * 1000, // 1 minuto
                report_generation: 5 * 60 * 1000 // 5 minutos
            }
        };
        this.isRunning = false;
        this.communicationServer = null;
    }

    async initialize() {
        console.log('🎯 AGENTE SUPERVISOR PRINCIPAL - INICIANDO');
        console.log('📋 Capacidades: Desktop Commander MCP + Multi-Instance Management');
        console.log('🏗️ Proyecto:', this.config.project.name);
        
        await this.setupDirectories();
        await this.initializeDesktopCommander();
        await this.setupCommunicationServer();
        await this.loadErrorTemplates();
        
        this.isRunning = true;
        this.startSupervisorLoop();
        
        console.log('✅ SUPERVISOR AGENT: Operacional y listo para recibir errores');
    }

    async setupDirectories() {
        const dirs = [
            this.config.instances.logs_dir,
            this.config.instances.instances_dir,
            './templates',
            './reports'
        ];
        
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                console.error(`Error creando directorio ${dir}:`, error.message);
            }
        }
    }

    async initializeDesktopCommander() {
        console.log('🖥️ Inicializando Desktop Commander MCP...');
        
        // Verificar que Warp está disponible
        try {
            const warpPath = this.config.desktop_commander.warp_path;
            if (await this.fileExists(warpPath)) {
                console.log('✅ Warp encontrado:', warpPath);
            } else {
                console.log('⚠️ Warp no encontrado en la ruta esperada, buscando...');
                // Buscar Warp en ubicaciones comunes
                const commonPaths = [
                    'C:\\Program Files\\Warp\\warp.exe',
                    'C:\\Program Files (x86)\\Warp\\warp.exe',
                    process.env.LOCALAPPDATA + '\\warp\\warp.exe'
                ];
                
                for (const testPath of commonPaths) {
                    if (await this.fileExists(testPath)) {
                        this.config.desktop_commander.warp_path = testPath;
                        console.log('✅ Warp encontrado:', testPath);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error inicializando Desktop Commander:', error.message);
        }
    }

    async setupCommunicationServer() {
        console.log('📡 Configurando servidor de comunicación inter-instancias...');
        
        const http = require('http');
        const port = this.config.desktop_commander.communication_port;
        
        this.communicationServer = http.createServer(async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            if (req.method === 'POST' && req.url === '/report') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', async () => {
                    try {
                        const report = JSON.parse(body);
                        await this.processInstanceReport(report);
                        res.writeHead(200);
                        res.end(JSON.stringify({ status: 'received', timestamp: new Date().toISOString() }));
                    } catch (error) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: error.message }));
                    }
                });
            } else if (req.method === 'GET' && req.url === '/status') {
                const status = await this.generateSupervisorStatus();
                res.writeHead(200);
                res.end(JSON.stringify(status));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
            }
        });
        
        this.communicationServer.listen(port, () => {
            console.log(`✅ Servidor de comunicación activo en puerto ${port}`);
        });
    }

    async createErrorInstance(errorData) {
        const instanceId = this.generateInstanceId(errorData.type);
        const instanceConfig = await this.generateInstanceConfig(errorData, instanceId);
        
        console.log(`🚀 Creando nueva instancia para error: ${errorData.type}`);
        console.log(`📋 Instance ID: ${instanceId}`);
        
        // Crear directorio de la instancia
        const instanceDir = path.join(this.config.instances.instances_dir, instanceId);
        await fs.mkdir(instanceDir, { recursive: true });
        
        // Guardar configuración de la instancia
        const configPath = path.join(instanceDir, 'taskmaster.config.json');
        await fs.writeFile(configPath, JSON.stringify(instanceConfig, null, 2));
        
        // Crear script de inicialización
        const initScript = this.generateInitScript(instanceId, instanceDir, errorData);
        const scriptPath = path.join(instanceDir, 'init.ps1');
        await fs.writeFile(scriptPath, initScript);
        
        // Lanzar nueva instancia de Warp con Desktop Commander
        const warpProcess = await this.launchWarpInstance(instanceId, instanceDir, scriptPath);
        
        // Registrar la instancia
        const instance = {
            id: instanceId,
            type: errorData.type,
            status: 'starting',
            pid: warpProcess.pid,
            createdAt: new Date().toISOString(),
            directory: instanceDir,
            errorData: errorData,
            process: warpProcess
        };
        
        this.instances.set(instanceId, instance);
        
        console.log(`✅ Instancia ${instanceId} creada y iniciada (PID: ${warpProcess.pid})`);
        
        return instance;
    }

    async launchWarpInstance(instanceId, instanceDir, scriptPath) {
        const warpPath = this.config.desktop_commander.warp_path;
        
        // Comando para lanzar Warp con el script de inicialización
        const args = [
            '--new-window',
            '--title', `TaskMaster-${instanceId}`,
            '--working-directory', instanceDir,
            '--execute', `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`
        ];
        
        console.log(`🖥️ Ejecutando: ${warpPath} ${args.join(' ')}`);
        
        const warpProcess = spawn(warpPath, args, {
            detached: true,
            stdio: 'pipe'
        });
        
        warpProcess.unref(); // Permitir que el proceso padre termine
        
        return warpProcess;
    }

    generateInstanceId(errorType) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        return `TM-${errorType.toUpperCase().replace(/[^A-Z0-9]/g, '')}-${timestamp}-${random}`;
    }

    async generateInstanceConfig(errorData, instanceId) {
        // Cargar configuración base
        const baseConfig = JSON.parse(await fs.readFile(this.config.instances.base_config, 'utf8'));
        
        // Personalizar para este tipo de error
        const instanceConfig = {
            ...baseConfig,
            name: `taskmaster-${instanceId}`,
            instanceId: instanceId,
            supervisorAgent: {
                enabled: true,
                reportTo: `http://localhost:${this.config.desktop_commander.communication_port}/report`,
                supervisorId: this.instanceId
            },
            errorHandling: {
                type: errorData.type,
                description: errorData.description,
                priority: errorData.priority || 'medium',
                autoRestart: true,
                maxRetries: 3
            },
            specializedMonitoring: this.getSpecializedMonitoring(errorData.type),
            logging: {
                ...baseConfig.logging,
                file: `${this.config.instances.logs_dir}/${instanceId}.log`
            }
        };
        
        return instanceConfig;
    }

    getSpecializedMonitoring(errorType) {
        const monitoringProfiles = {
            'database': {
                monitors: ['db_connection', 'query_performance', 'data_integrity'],
                intervals: { check: 10000, alert: 30000 }
            },
            'api': {
                monitors: ['endpoint_health', 'response_times', 'rate_limiting'],
                intervals: { check: 5000, alert: 15000 }
            },
            'ui': {
                monitors: ['page_load', 'javascript_errors', 'user_interactions'],
                intervals: { check: 15000, alert: 60000 }
            },
            'auth': {
                monitors: ['login_failures', 'token_validation', 'session_management'],
                intervals: { check: 5000, alert: 10000 }
            },
            'performance': {
                monitors: ['memory_usage', 'cpu_load', 'network_latency'],
                intervals: { check: 10000, alert: 30000 }
            }
        };
        
        return monitoringProfiles[errorType] || {
            monitors: ['general_health'],
            intervals: { check: 30000, alert: 60000 }
        };
    }

    generateInitScript(instanceId, instanceDir, errorData) {
        return `# TaskMaster Instance Initialization Script
# Instance ID: ${instanceId}
# Error Type: ${errorData.type}
# Generated: ${new Date().toISOString()}

Write-Host "🎯 Iniciando TaskMaster Instance: ${instanceId}" -ForegroundColor Cyan
Write-Host "📋 Tipo de Error: ${errorData.type}" -ForegroundColor Yellow
Write-Host "🏗️ Directorio: ${instanceDir}" -ForegroundColor Gray

# Configurar entorno
. "..\\..\\setup-env-simple.ps1"

# Variables específicas de la instancia
$env:TASKMASTER_INSTANCE_ID = "${instanceId}"
$env:TASKMASTER_ERROR_TYPE = "${errorData.type}"
$env:TASKMASTER_SUPERVISOR_URL = "http://localhost:${this.config.desktop_commander.communication_port}"

# Inicializar TaskMaster con configuración especializada
Write-Host "⚡ Iniciando TaskMaster especializado..." -ForegroundColor Green

# Aquí se iniciaría el TaskMaster específico para este error
node "..\\..\\taskmaster-monitor.js" --config "taskmaster.config.json" --instance-id "${instanceId}"

Write-Host "✅ TaskMaster Instance ${instanceId} iniciado" -ForegroundColor Green
Write-Host "📡 Reportando al Supervisor en puerto ${this.config.desktop_commander.communication_port}" -ForegroundColor Cyan

# Mantener la ventana abierta para monitoreo
Write-Host "🔄 Presiona Ctrl+C para detener esta instancia" -ForegroundColor Yellow
while ($true) {
    Start-Sleep -Seconds 10
    Write-Host "." -NoNewline -ForegroundColor Gray
}`;
    }

    async processInstanceReport(report) {
        const instanceId = report.instanceId;
        const instance = this.instances.get(instanceId);
        
        if (instance) {
            instance.lastReport = report;
            instance.lastReportTime = new Date().toISOString();
            instance.status = report.status;
            
            console.log(`📡 Reporte recibido de ${instanceId}: ${report.status}`);
            
            // Procesar acciones basadas en el reporte
            if (report.status === 'error' || report.status === 'critical') {
                await this.handleCriticalReport(instance, report);
            }
        } else {
            console.log(`⚠️ Reporte de instancia desconocida: ${instanceId}`);
        }
    }

    async handleCriticalReport(instance, report) {
        console.log(`🚨 ALERTA CRÍTICA de ${instance.id}: ${report.message}`);
        
        // Crear issue en GitHub si es crítico
        if (report.status === 'critical') {
            const issueTitle = `[CRÍTICO] ${instance.type}: ${report.message}`;
            const issueBody = `**Instancia**: ${instance.id}
**Tipo de Error**: ${instance.type}
**Status**: ${report.status}
**Mensaje**: ${report.message}
**Timestamp**: ${report.timestamp}

**Detalles del Error**:
\`\`\`json
${JSON.stringify(report.details, null, 2)}
\`\`\`

**Instancia TaskMaster**: Reportando automáticamente desde instancia especializada.`;

            try {
                const { execSync } = require('child_process');
                execSync(`gh issue create --repo mugentime/POS-CONEJONEGRO --title "${issueTitle}" --body "${issueBody}" --label "critical,taskmaster,${instance.type}"`, 
                    { encoding: 'utf8' });
                console.log('✅ Issue crítico creado en GitHub');
            } catch (error) {
                console.error('❌ Error creando issue:', error.message);
            }
        }
    }

    async generateSupervisorStatus() {
        return {
            supervisor: {
                id: this.instanceId,
                status: this.isRunning ? 'running' : 'stopped',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            },
            instances: {
                total: this.instances.size,
                active: Array.from(this.instances.values()).filter(i => i.status === 'running').length,
                list: Array.from(this.instances.values()).map(i => ({
                    id: i.id,
                    type: i.type,
                    status: i.status,
                    createdAt: i.createdAt,
                    lastReportTime: i.lastReportTime
                }))
            },
            errorTypes: Array.from(this.errorTypes.keys()),
            communication: {
                port: this.config.desktop_commander.communication_port,
                server_status: this.communicationServer ? 'active' : 'inactive'
            }
        };
    }

    async startSupervisorLoop() {
        console.log('🔄 Iniciando bucle de supervisión...');
        
        setInterval(async () => {
            await this.performHealthChecks();
        }, this.config.intervals.health_check);
        
        setInterval(async () => {
            await this.syncInstances();
        }, this.config.intervals.instance_sync);
        
        setInterval(async () => {
            await this.generateReport();
        }, this.config.intervals.report_generation);
    }

    async performHealthChecks() {
        // Verificar salud de todas las instancias
        for (const [instanceId, instance] of this.instances) {
            try {
                // Verificar si el proceso sigue activo
                process.kill(instance.pid, 0);
            } catch (error) {
                console.log(`⚠️ Instancia ${instanceId} no responde, marcando como inactiva`);
                instance.status = 'inactive';
            }
        }
    }

    async syncInstances() {
        console.log(`🔄 Sincronizando ${this.instances.size} instancias...`);
    }

    async generateReport() {
        const status = await this.generateSupervisorStatus();
        const reportPath = `./reports/supervisor-report-${new Date().toISOString().split('T')[0]}.json`;
        
        try {
            const existingReports = await fs.readFile(reportPath, 'utf8').then(JSON.parse).catch(() => []);
            existingReports.push({
                timestamp: new Date().toISOString(),
                status: status
            });
            
            await fs.writeFile(reportPath, JSON.stringify(existingReports, null, 2));
        } catch (error) {
            console.error('Error generando reporte:', error.message);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    // API pública para crear instancias desde errores
    async handleErrorList(errorList) {
        console.log(`📋 Procesando lista de ${errorList.length} errores...`);
        
        for (const errorData of errorList) {
            try {
                const instance = await this.createErrorInstance(errorData);
                console.log(`✅ Instancia creada para error: ${errorData.type} -> ${instance.id}`);
            } catch (error) {
                console.error(`❌ Error creando instancia para ${errorData.type}:`, error.message);
            }
        }
    }

    async loadErrorTemplates() {
        // Cargar templates de configuración para diferentes tipos de errores
        const templateDir = './templates';
        try {
            const templates = await fs.readdir(templateDir);
            console.log(`📁 Cargados ${templates.length} templates de error`);
        } catch (error) {
            console.log('📁 Creando directorio de templates...');
        }
    }
}

// Manejar señales de sistema
process.on('SIGINT', async () => {
    console.log('\n🛑 Recibiendo señal de parada, cerrando Supervisor Agent...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Recibiendo SIGTERM, cerrando Supervisor Agent...');
    process.exit(0);
});

// Exportar para uso como módulo
module.exports = SupervisorAgent;

// Si se ejecuta directamente
if (require.main === module) {
    const supervisor = new SupervisorAgent();
    supervisor.initialize().catch(console.error);
}
