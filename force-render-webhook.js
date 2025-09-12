/**
 * 🔧 TaskMaster: Forzar webhook de Render para deploy
 */

const https = require('https');
const { execSync } = require('child_process');

class ForceRenderWebhook {
    constructor() {
        this.serviceId = 'srv-d2sf0q7diees738qcq3g';
        this.repoUrl = 'https://github.com/mugentime/POS-CONEJONEGRO.git';
        this.webhookUrl = process.env.RENDER_WEBHOOK_URL;
        this.attempts = 0;
        this.maxAttempts = 3;
    }

    async triggerWebhook() {
        console.log('🔧 TaskMaster: Intentando forzar webhook de Render...');
        
        if (this.webhookUrl) {
            console.log(`🎯 Webhook URL encontrado: ${this.webhookUrl.substring(0, 50)}...`);
            return await this.callWebhook();
        }
        
        // Intentar con URLs posibles de webhook
        const possibleWebhooks = [
            `https://api.render.com/deploy/${this.serviceId}`,
            `https://api.render.com/v1/services/${this.serviceId}/deploys`,
            // Render a veces usa URLs con query parameters específicos
        ];
        
        for (const url of possibleWebhooks) {
            try {
                console.log(`🔄 Probando webhook: ${url}`);
                const result = await this.callWebhook(url);
                if (result) return true;
            } catch (error) {
                console.log(`❌ Falló: ${error.message}`);
            }
        }
        
        return await this.triggerViaGitEvent();
    }

    async callWebhook(url = this.webhookUrl) {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'TaskMaster-Deploy-Trigger/1.0'
                }
            };

            const req = https.request(url, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        console.log('✅ Webhook activado exitosamente');
                        resolve(true);
                    } else {
                        console.log(`⚠️ Webhook respuesta: ${res.statusCode}`);
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            // Payload típico para webhook de deploy
            req.write(JSON.stringify({
                ref: 'refs/heads/main',
                repository: {
                    clone_url: this.repoUrl
                },
                head_commit: {
                    id: '2c263a1',
                    message: '🔧 TaskMaster: Fix duplicate cash cuts with zero amounts'
                }
            }));

            req.end();
        });
    }

    async triggerViaGitEvent() {
        console.log('\\n🔄 Intentando trigger via evento Git...');
        
        try {
            // Crear un commit vacío para forzar webhook
            console.log('📝 Creando commit vacío para trigger...');
            execSync('git commit --allow-empty -m "🔧 TaskMaster: Trigger Render deploy"', { stdio: 'inherit' });
            
            console.log('📤 Pushing commit trigger...');
            execSync('git push origin main', { stdio: 'inherit' });
            
            console.log('✅ Commit trigger enviado - Render debería detectar el cambio');
            return true;
            
        } catch (error) {
            console.error('❌ Error con git trigger:', error.message);
            return false;
        }
    }

    async waitAndVerify() {
        console.log('\\n⏳ Esperando 2 minutos para que Render procese...');
        
        // Esperar 2 minutos
        await new Promise(resolve => setTimeout(resolve, 120000));
        
        console.log('🔍 Verificando si el deploy se activó...');
        
        const RenderDeployValidator = require('./validate-render-deploy');
        const validator = new RenderDeployValidator();
        
        try {
            const result = await validator.runValidation();
            return result;
        } catch (error) {
            console.error('❌ Error verificando deploy:', error.message);
            return false;
        }
    }

    async execute() {
        console.log('🔧 TaskMaster: Forzando deploy de Render');
        console.log(`📋 Service ID: ${this.serviceId}`);
        console.log(`📂 Repo: ${this.repoUrl}`);
        
        const triggered = await this.triggerWebhook();
        
        if (triggered) {
            console.log('\\n🎯 Deploy trigger enviado - Monitoreando resultado...');
            
            const success = await this.waitAndVerify();
            
            if (success) {
                console.log('\\n🎉 ¡DEPLOY DE RENDER COMPLETADO!');
                console.log('✅ TaskMaster fix disponible en producción');
                return true;
            } else {
                console.log('\\n⚠️ Deploy aún no detectado');
                return false;
            }
        } else {
            console.log('\\n❌ No se pudo activar el deploy automáticamente');
            console.log('\\n🎯 INSTRUCCIONES FINALES:');
            console.log('1. Ve a: https://dashboard.render.com/');
            console.log('2. Busca: pos-conejo-negro');
            console.log('3. Manual Deploy del commit: 2c263a1');
            console.log('4. Confirma el deploy (2-5 minutos)');
            return false;
        }
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const forcer = new ForceRenderWebhook();
    forcer.execute()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Error forzando deploy:', error);
            process.exit(1);
        });
}

module.exports = ForceRenderWebhook;
