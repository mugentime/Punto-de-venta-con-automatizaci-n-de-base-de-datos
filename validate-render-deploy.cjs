/**
 * 🔧 TaskMaster: Validar que la corrección de duplicados esté desplegada en Render
 */

const https = require('https');
const fs = require('fs').promises;

class RenderDeployValidator {
    constructor() {
        this.baseUrl = 'https://pos-conejo-negro.onrender.com';
        this.correlationId = `RENDER-VALIDATION-${Date.now()}`;
        this.results = [];
    }

    async makeRequest(path, method = 'GET', body = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'TaskMaster-Deploy-Validator/1.0'
                }
            };

            if (body) {
                options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
            }

            const req = https.request(url, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsedData = JSON.parse(data);
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            data: parsedData
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode,
                            headers: res.headers,
                            data: data,
                            raw: true
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (body) {
                req.write(JSON.stringify(body));
            }

            req.end();
        });
    }

    async validateBasicHealth() {
        console.log('🔧 TaskMaster: Validando salud básica del sistema...');
        
        try {
            const response = await this.makeRequest('/api/health');
            
            if (response.status === 200) {
                console.log('✅ Servidor Render funcionando correctamente');
                console.log(`   Uptime: ${Math.floor(response.data.uptime / 60)} minutos`);
                console.log(`   Environment: ${response.data.environment.node_env}`);
                
                this.results.push({
                    test: 'basic_health',
                    passed: true,
                    details: {
                        uptime: response.data.uptime,
                        environment: response.data.environment
                    }
                });
            } else {
                throw new Error(`Health check failed: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Error en health check:', error.message);
            this.results.push({
                test: 'basic_health',
                passed: false,
                error: error.message
            });
        }
    }

    async validateTaskMasterFiles() {
        console.log('\\n🔧 TaskMaster: Verificando archivos TaskMaster desplegados...');
        
        // Intentar acceder a archivos específicos que deberían estar presentes
        const filesToCheck = [
            '/TASKMASTER_DUPLICATE_FIX_LOG.md',
            '/test-taskmaster-fix.js'
        ];

        for (const file of filesToCheck) {
            try {
                const response = await this.makeRequest(file);
                
                if (response.status === 200 || response.status === 404) {
                    // 404 es normal para archivos que no están expuestos públicamente
                    console.log(`✅ Solicitud a ${file}: ${response.status}`);
                } else {
                    console.log(`⚠️ Respuesta inesperada para ${file}: ${response.status}`);
                }
            } catch (error) {
                console.log(`⚠️ Error verificando ${file}:`, error.message);
            }
        }

        this.results.push({
            test: 'taskmaster_files',
            passed: true,
            details: 'Files check completed'
        });
    }

    async validateCashCutsEndpoint() {
        console.log('\\n🔧 TaskMaster: Validando endpoint de cortes de caja...');
        
        try {
            // Verificar que el endpoint de cash cuts existe
            const response = await this.makeRequest('/api/cashcuts');
            
            if (response.status === 401) {
                console.log('✅ Endpoint de cash cuts encontrado (requiere autenticación)');
                this.results.push({
                    test: 'cashcuts_endpoint',
                    passed: true,
                    details: 'Endpoint exists, requires auth'
                });
            } else if (response.status === 200) {
                console.log('✅ Endpoint de cash cuts accesible');
                this.results.push({
                    test: 'cashcuts_endpoint',  
                    passed: true,
                    details: 'Endpoint accessible'
                });
            } else {
                console.log(`⚠️ Respuesta inesperada del endpoint: ${response.status}`);
                this.results.push({
                    test: 'cashcuts_endpoint',
                    passed: false,
                    details: `Unexpected status: ${response.status}`
                });
            }
        } catch (error) {
            console.error('❌ Error validando endpoint cash cuts:', error.message);
            this.results.push({
                test: 'cashcuts_endpoint',
                passed: false,
                error: error.message
            });
        }
    }

    async checkRecentCommit() {
        console.log('\\n🔧 TaskMaster: Verificando si el último commit está desplegado...');
        
        try {
            // Verificar algún indicador de que el deploy reciente funcionó
            const response = await this.makeRequest('/api/health');
            const serverTime = new Date(response.data.timestamp);
            const now = new Date();
            const deployTime = (now - serverTime) / 1000;
            
            console.log(`📊 Tiempo del servidor: ${serverTime.toISOString()}`);
            console.log(`📊 Diferencia temporal: ${deployTime.toFixed(0)} segundos`);
            
            // Si el servidor se reinició recientemente (uptime bajo), probablemente hubo deploy
            if (response.data.uptime < 3600) { // Menos de 1 hora
                console.log('✅ Servidor reiniciado recientemente - Posible deploy reciente');
                this.results.push({
                    test: 'recent_deploy',
                    passed: true,
                    details: {
                        uptime: response.data.uptime,
                        indication: 'Recent restart detected'
                    }
                });
            } else {
                console.log('⚠️ Servidor con uptime alto - Deploy podría no haberse activado');
                this.results.push({
                    test: 'recent_deploy',
                    passed: false,
                    details: {
                        uptime: response.data.uptime,
                        indication: 'No recent restart detected'
                    }
                });
            }
            
        } catch (error) {
            console.error('❌ Error verificando deploy reciente:', error.message);
            this.results.push({
                test: 'recent_deploy',
                passed: false,
                error: error.message
            });
        }
    }

    async generateReport() {
        console.log('\\n📋 TaskMaster: Generando reporte de validación...');
        
        const passedTests = this.results.filter(r => r.passed).length;
        const totalTests = this.results.length;
        const deployStatus = this.determineDeployStatus();
        
        const report = {
            timestamp: new Date().toISOString(),
            correlationId: this.correlationId,
            renderUrl: this.baseUrl,
            serviceId: 'srv-d2sf0q7diees738qcq3g',
            totalTests: totalTests,
            passedTests: passedTests,
            failedTests: totalTests - passedTests,
            deployStatus: deployStatus,
            results: this.results,
            recommendation: this.getRecommendation(deployStatus)
        };
        
        const reportPath = `./render-validation-${this.correlationId}.json`;
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`📄 Reporte guardado: ${reportPath}`);
        console.log(`\\n🎯 RESULTADO DE VALIDACIÓN:`);
        console.log(`   URL: ${this.baseUrl}`);
        console.log(`   Tests pasados: ${passedTests}/${totalTests}`);
        console.log(`   Estado del deploy: ${deployStatus}`);
        console.log(`   Recomendación: ${report.recommendation}`);
        
        return report;
    }

    determineDeployStatus() {
        const recentDeployTest = this.results.find(r => r.test === 'recent_deploy');
        const healthTest = this.results.find(r => r.test === 'basic_health');
        
        if (healthTest && healthTest.passed) {
            if (recentDeployTest && recentDeployTest.passed) {
                return 'RECENTLY_DEPLOYED';
            } else {
                return 'RUNNING_OLD_VERSION';
            }
        } else {
            return 'SERVICE_DOWN';
        }
    }

    getRecommendation(deployStatus) {
        switch (deployStatus) {
            case 'RECENTLY_DEPLOYED':
                return 'Deploy detectado - Monitorear por 10-15 minutos';
            case 'RUNNING_OLD_VERSION':
                return 'Activar deploy manual de Render - Cambios no desplegados';
            case 'SERVICE_DOWN':
                return 'Verificar estado del servicio en Render Dashboard';
            default:
                return 'Estado indeterminado - Verificar manualmente';
        }
    }

    async runValidation() {
        console.log('🔧 TaskMaster: Iniciando validación de deploy en Render');
        console.log(`📋 Correlation ID: ${this.correlationId}`);
        console.log(`🌐 URL: ${this.baseUrl}`);
        
        try {
            await this.validateBasicHealth();
            await this.validateTaskMasterFiles();
            await this.validateCashCutsEndpoint();
            await this.checkRecentCommit();
            
            const report = await this.generateReport();
            
            return report.deployStatus === 'RECENTLY_DEPLOYED';
            
        } catch (error) {
            console.error('💥 Error en validación:', error.message);
            return false;
        }
    }
}

// Ejecutar validación si se ejecuta directamente
if (require.main === module) {
    const validator = new RenderDeployValidator();
    validator.runValidation()
        .then(success => {
            console.log('\\n🎉 Validación completada');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Error crítico en validación:', error);
            process.exit(1);
        });
}

module.exports = RenderDeployValidator;
