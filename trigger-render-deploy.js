/**
 * 🔧 TaskMaster: Script para activar deploy manual en Render
 */

const https = require('https');

class RenderDeployTrigger {
    constructor() {
        this.serviceId = 'srv-d2sf0q7diees738qcq3g';
        this.apiToken = process.env.RENDER_API_TOKEN;
    }

    async triggerDeploy() {
        console.log('🔧 TaskMaster: Intentando activar deploy en Render...');
        console.log(`📋 Service ID: ${this.serviceId}`);
        
        if (!this.apiToken) {
            console.log('⚠️ RENDER_API_TOKEN no encontrado en variables de entorno');
            console.log('');
            console.log('🎯 INSTRUCCIONES MANUALES:');
            console.log('1. Ve a: https://dashboard.render.com/');
            console.log('2. Busca el servicio: pos-conejo-negro');
            console.log(`3. Service ID: ${this.serviceId}`);
            console.log('4. Haz clic en "Manual Deploy"');
            console.log('5. Confirma el deploy del commit: 2c263a1');
            console.log('');
            console.log('📝 Commit a desplegar:');
            console.log('   Hash: 2c263a1');
            console.log('   Mensaje: 🔧 TaskMaster: Fix duplicate cash cuts with zero amounts');
            console.log('   Cambios: ImprovedCashCutService + validaciones');
            console.log('');
            console.log('⏰ El deploy debería tardar 2-5 minutos');
            return false;
        }

        // TODO: Implementar llamada API cuando se tenga el token
        console.log('🔄 Activando deploy vía API de Render...');
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.render.com',
                port: 443,
                path: `/v1/services/${this.serviceId}/deploys`,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 201) {
                        console.log('✅ Deploy activado exitosamente');
                        console.log('⏰ El deploy tardará aproximadamente 2-5 minutos');
                        resolve(true);
                    } else {
                        console.error(`❌ Error activando deploy: ${res.statusCode}`);
                        console.error(data);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Error de conexión:', error.message);
                reject(error);
            });

            req.write(JSON.stringify({
                clearCache: false
            }));
            
            req.end();
        });
    }
}

// Función para monitorear el deploy
async function monitorDeploy() {
    console.log('\\n🔍 Monitoreando el deploy...');
    
    const RenderDeployValidator = require('./validate-render-deploy');
    const validator = new RenderDeployValidator();
    
    let attempts = 0;
    const maxAttempts = 12; // 12 intentos = 6 minutos
    
    const checkInterval = setInterval(async () => {
        attempts++;
        console.log(`\\n🔄 Verificación ${attempts}/${maxAttempts}...`);
        
        try {
            const result = await validator.runValidation();
            
            if (result) {
                console.log('\\n🎉 ¡DEPLOY COMPLETADO EXITOSAMENTE!');
                console.log('✅ TaskMaster fix ya está disponible en producción');
                clearInterval(checkInterval);
                process.exit(0);
            } else if (attempts >= maxAttempts) {
                console.log('\\n⏰ Tiempo de espera agotado');
                console.log('⚠️ Verificar manualmente el estado del deploy en Render Dashboard');
                clearInterval(checkInterval);
                process.exit(1);
            }
        } catch (error) {
            console.error('❌ Error en monitoreo:', error.message);
        }
    }, 30000); // Verificar cada 30 segundos
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const trigger = new RenderDeployTrigger();
    
    trigger.triggerDeploy()
        .then(success => {
            if (success) {
                console.log('\\n🔄 Deploy activado, iniciando monitoreo...');
                monitorDeploy();
            } else {
                console.log('\\n⚠️ Deploy no se pudo activar automáticamente');
                console.log('Por favor, activa el deploy manualmente en Render Dashboard');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Error activando deploy:', error);
            process.exit(1);
        });
}

module.exports = RenderDeployTrigger;
