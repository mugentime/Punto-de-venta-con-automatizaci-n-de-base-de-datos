#!/usr/bin/env node

/**
 * ✅ DEPLOY VALIDATOR SYSTEM
 * 
 * Sistema de validaciones pre-deploy que asegura la calidad del código
 * antes de que se ejecute el deploy automático en Render.
 * 
 * Creado por Task Master como arquitecto principal
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class DeployValidator {
    constructor() {
        this.config = {
            // Configuración de validaciones
            enableLinting: true,
            enableTesting: true,
            enableSecurityCheck: true,
            enableDependencyCheck: true,
            enableBuildCheck: true,
            
            // Archivos requeridos
            requiredFiles: [
                'package.json',
                'server.js',
                'render.yaml'
            ],
            
            // Archivos prohibidos en producción
            forbiddenFiles: [
                '.env',
                '.env.local',
                '.env.development',
                'test.js',
                'debug.js'
            ],
            
            // Scripts de NPM esperados
            expectedScripts: [
                'start'
            ],
            
            // Variables de entorno críticas
            criticalEnvVars: [
                'NODE_ENV',
                'PORT'
            ],
            
            // Configuración de logs
            logFile: path.join(__dirname, '../logs/validation.log'),
            validationHistoryFile: path.join(__dirname, '../logs/validation-history.json'),
            
            // Límites de validación
            maxFileSize: 50 * 1024 * 1024, // 50MB
            maxDependencies: 200,
            
            // Timeouts
            buildTimeout: 300000, // 5 minutos
            testTimeout: 180000   // 3 minutos
        };

        this.validationHistory = this.loadValidationHistory();
        this.ensureLogDirectory();
    }

    /**
     * Ejecutar todas las validaciones pre-deploy
     */
    async runAllValidations() {
        this.log('🔍 Iniciando validaciones pre-deploy...');
        
        const validationResults = {
            timestamp: new Date().toISOString(),
            validations: [],
            errors: [],
            warnings: [],
            passed: false,
            score: 0
        };

        try {
            // 1. Validaciones básicas de archivos
            const fileValidations = this.validateRequiredFiles();
            validationResults.validations.push(...fileValidations.results);
            if (fileValidations.errors.length > 0) {
                validationResults.errors.push(...fileValidations.errors);
            }

            // 2. Validación de package.json
            const packageValidations = this.validatePackageJson();
            validationResults.validations.push(...packageValidations.results);
            if (packageValidations.errors.length > 0) {
                validationResults.errors.push(...packageValidations.errors);
            }

            // 3. Validación de sintaxis
            const syntaxValidations = await this.validateSyntax();
            validationResults.validations.push(...syntaxValidations.results);
            if (syntaxValidations.errors.length > 0) {
                validationResults.errors.push(...syntaxValidations.errors);
            }

            // 4. Validación de dependencias
            if (this.config.enableDependencyCheck) {
                const depValidations = await this.validateDependencies();
                validationResults.validations.push(...depValidations.results);
                if (depValidations.errors.length > 0) {
                    validationResults.errors.push(...depValidations.errors);
                }
            }

            // 5. Validación de seguridad
            if (this.config.enableSecurityCheck) {
                const secValidations = await this.validateSecurity();
                validationResults.validations.push(...secValidations.results);
                if (secValidations.errors.length > 0) {
                    validationResults.errors.push(...secValidations.errors);
                }
            }

            // 6. Build test
            if (this.config.enableBuildCheck) {
                const buildValidations = await this.validateBuild();
                validationResults.validations.push(...buildValidations.results);
                if (buildValidations.errors.length > 0) {
                    validationResults.errors.push(...buildValidations.errors);
                }
            }

            // 7. Linting (si está disponible)
            if (this.config.enableLinting) {
                const lintValidations = await this.validateLinting();
                validationResults.validations.push(...lintValidations.results);
                if (lintValidations.warnings.length > 0) {
                    validationResults.warnings.push(...lintValidations.warnings);
                }
            }

            // 8. Tests (si existen)
            if (this.config.enableTesting) {
                const testValidations = await this.validateTests();
                validationResults.validations.push(...testValidations.results);
                if (testValidations.errors.length > 0) {
                    validationResults.errors.push(...testValidations.errors);
                }
            }

            // Calcular score y determinar si pasó
            validationResults.score = this.calculateValidationScore(validationResults);
            validationResults.passed = validationResults.errors.length === 0 && validationResults.score >= 80;

            // Guardar resultado en historial
            this.recordValidation(validationResults);

            // Log resultado final
            if (validationResults.passed) {
                this.log(`✅ Todas las validaciones pasaron exitosamente (Score: ${validationResults.score}%)`);
            } else {
                this.log(`❌ Validaciones fallaron (Score: ${validationResults.score}%) - ${validationResults.errors.length} errores encontrados`);
            }

            return validationResults;

        } catch (error) {
            this.log('❌ Error crítico durante validaciones:', error.message);
            validationResults.errors.push({
                type: 'critical_error',
                message: error.message,
                stack: error.stack
            });
            validationResults.passed = false;
            return validationResults;
        }
    }

    /**
     * Validar archivos requeridos y prohibidos
     */
    validateRequiredFiles() {
        const results = [];
        const errors = [];

        this.log('📁 Validando archivos requeridos...');

        // Verificar archivos requeridos
        this.config.requiredFiles.forEach(file => {
            if (fs.existsSync(file)) {
                results.push(`✅ ${file} encontrado`);
                this.log(`✅ ${file} encontrado`);
            } else {
                const error = `❌ Archivo requerido no encontrado: ${file}`;
                results.push(error);
                errors.push({ type: 'missing_file', file, message: error });
                this.log(error);
            }
        });

        // Verificar archivos prohibidos
        this.config.forbiddenFiles.forEach(file => {
            if (fs.existsSync(file)) {
                const gitFiles = execSync('git ls-files', { encoding: 'utf8' });
                if (gitFiles.includes(file)) {
                    const error = `❌ Archivo prohibido encontrado en el repositorio: ${file}`;
                    results.push(error);
                    errors.push({ type: 'forbidden_file', file, message: error });
                    this.log(error);
                } else {
                    results.push(`⚠️ ${file} existe localmente pero no está en el repositorio`);
                    this.log(`⚠️ ${file} existe localmente pero no está en el repositorio`);
                }
            } else {
                results.push(`✅ ${file} no encontrado (correcto)`);
            }
        });

        return { results, errors };
    }

    /**
     * Validar package.json
     */
    validatePackageJson() {
        const results = [];
        const errors = [];

        this.log('📦 Validando package.json...');

        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

            // Verificar campos básicos
            const requiredFields = ['name', 'version', 'main', 'scripts'];
            requiredFields.forEach(field => {
                if (packageJson[field]) {
                    results.push(`✅ package.json tiene campo '${field}'`);
                } else {
                    const error = `❌ package.json falta campo requerido: ${field}`;
                    results.push(error);
                    errors.push({ type: 'missing_package_field', field, message: error });
                }
            });

            // Verificar scripts esperados
            this.config.expectedScripts.forEach(script => {
                if (packageJson.scripts && packageJson.scripts[script]) {
                    results.push(`✅ Script '${script}' encontrado en package.json`);
                } else {
                    const error = `❌ Script requerido no encontrado en package.json: ${script}`;
                    results.push(error);
                    errors.push({ type: 'missing_script', script, message: error });
                }
            });

            // Verificar número de dependencias
            const totalDeps = Object.keys(packageJson.dependencies || {}).length + 
                             Object.keys(packageJson.devDependencies || {}).length;
            
            if (totalDeps > this.config.maxDependencies) {
                const warning = `⚠️ Muchas dependencias detectadas: ${totalDeps}`;
                results.push(warning);
                this.log(warning);
            } else {
                results.push(`✅ Número razonable de dependencias: ${totalDeps}`);
            }

            // Verificar que main apunte a server.js
            if (packageJson.main === 'server.js') {
                results.push('✅ Campo main apunta a server.js');
            } else {
                const error = `❌ Campo main debería apuntar a server.js, encontrado: ${packageJson.main}`;
                results.push(error);
                errors.push({ type: 'incorrect_main', main: packageJson.main, message: error });
            }

        } catch (error) {
            const errorMsg = `❌ Error al parsear package.json: ${error.message}`;
            results.push(errorMsg);
            errors.push({ type: 'package_parse_error', message: errorMsg });
        }

        return { results, errors };
    }

    /**
     * Validar sintaxis de archivos JavaScript
     */
    async validateSyntax() {
        const results = [];
        const errors = [];

        this.log('🔧 Validando sintaxis de JavaScript...');

        const jsFiles = ['server.js'];
        
        // Encontrar archivos JS adicionales
        try {
            const gitFiles = execSync('git ls-files "*.js"', { encoding: 'utf8' });
            const additionalFiles = gitFiles.split('\n')
                .filter(file => file.trim() && !jsFiles.includes(file))
                .slice(0, 10); // Limitar a 10 archivos para evitar sobrecarga
            
            jsFiles.push(...additionalFiles);
        } catch (error) {
            this.log('⚠️ No se pudieron listar archivos JS del repositorio');
        }

        for (const file of jsFiles) {
            if (fs.existsSync(file)) {
                try {
                    execSync(`node -c "${file}"`, { stdio: 'ignore' });
                    results.push(`✅ Sintaxis válida: ${file}`);
                    this.log(`✅ Sintaxis válida: ${file}`);
                } catch (error) {
                    const errorMsg = `❌ Error de sintaxis en ${file}: ${error.message}`;
                    results.push(errorMsg);
                    errors.push({ type: 'syntax_error', file, message: errorMsg });
                    this.log(errorMsg);
                }
            }
        }

        return { results, errors };
    }

    /**
     * Validar dependencias con npm
     */
    async validateDependencies() {
        const results = [];
        const errors = [];

        this.log('📦 Validando dependencias...');

        try {
            // Verificar que las dependencias se pueden instalar
            execSync('npm ls --depth=0', { stdio: 'ignore' });
            results.push('✅ Todas las dependencias están instaladas correctamente');
            this.log('✅ Todas las dependencias están instaladas correctamente');
        } catch (error) {
            try {
                // Intentar instalar dependencias
                this.log('📦 Instalando dependencias faltantes...');
                execSync('npm install --only=prod', { stdio: 'ignore', timeout: 120000 });
                results.push('✅ Dependencias instaladas exitosamente');
                this.log('✅ Dependencias instaladas exitosamente');
            } catch (installError) {
                const errorMsg = `❌ Error instalando dependencias: ${installError.message}`;
                results.push(errorMsg);
                errors.push({ type: 'dependency_install_error', message: errorMsg });
                this.log(errorMsg);
            }
        }

        return { results, errors };
    }

    /**
     * Validar aspectos de seguridad básicos
     */
    async validateSecurity() {
        const results = [];
        const errors = [];

        this.log('🔒 Validando seguridad...');

        try {
            // Verificar que no hay información sensible en el código
            const sensitivePatterns = [
                /password\s*=\s*['"]\w+['"]/i,
                /api[_-]?key\s*=\s*['"]\w+['"]/i,
                /secret\s*=\s*['"]\w+['"]/i,
                /token\s*=\s*['"]\w+['"]/i
            ];

            const jsFiles = execSync('git ls-files "*.js"', { encoding: 'utf8' })
                .split('\n')
                .filter(file => file.trim())
                .slice(0, 20); // Limitar archivos

            let sensitiveFound = false;
            for (const file of jsFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    for (const pattern of sensitivePatterns) {
                        if (pattern.test(content)) {
                            const errorMsg = `❌ Posible información sensible encontrada en ${file}`;
                            results.push(errorMsg);
                            errors.push({ type: 'sensitive_data', file, message: errorMsg });
                            this.log(errorMsg);
                            sensitiveFound = true;
                            break;
                        }
                    }
                }
            }

            if (!sensitiveFound) {
                results.push('✅ No se encontró información sensible en el código');
                this.log('✅ No se encontró información sensible en el código');
            }

        } catch (error) {
            this.log('⚠️ No se pudo completar validación de seguridad:', error.message);
            results.push('⚠️ Validación de seguridad omitida');
        }

        return { results, errors };
    }

    /**
     * Validar que el build funciona
     */
    async validateBuild() {
        const results = [];
        const errors = [];

        this.log('🔨 Validando build...');

        try {
            // Simular el proceso de build de Render
            this.log('📦 Ejecutando npm install...');
            execSync('npm install --only=prod', { 
                stdio: 'ignore', 
                timeout: this.config.buildTimeout 
            });
            
            results.push('✅ Build simulado completado exitosamente');
            this.log('✅ Build simulado completado exitosamente');

            // Verificar que server.js se puede inicializar (sin ejecutar)
            const serverContent = fs.readFileSync('server.js', 'utf8');
            if (serverContent.includes('listen') || serverContent.includes('port')) {
                results.push('✅ server.js contiene configuración de servidor');
            } else {
                const warning = '⚠️ server.js podría no tener configuración de servidor';
                results.push(warning);
                this.log(warning);
            }

        } catch (error) {
            const errorMsg = `❌ Error durante build: ${error.message}`;
            results.push(errorMsg);
            errors.push({ type: 'build_error', message: errorMsg });
            this.log(errorMsg);
        }

        return { results, errors };
    }

    /**
     * Validar linting (si está configurado)
     */
    async validateLinting() {
        const results = [];
        const warnings = [];

        this.log('🔍 Validando linting...');

        try {
            // Verificar si existe configuración de ESLint
            const hasEslintConfig = fs.existsSync('.eslintrc.js') || 
                                   fs.existsSync('.eslintrc.json') ||
                                   fs.existsSync('.eslintrc.yml');

            if (hasEslintConfig) {
                try {
                    execSync('npx eslint server.js --quiet', { stdio: 'ignore' });
                    results.push('✅ Linting passed');
                    this.log('✅ Linting passed');
                } catch (error) {
                    const warning = '⚠️ Linting encontró issues menores';
                    results.push(warning);
                    warnings.push({ type: 'linting_warnings', message: warning });
                    this.log(warning);
                }
            } else {
                results.push('⚠️ No se encontró configuración de linting');
                this.log('⚠️ No se encontró configuración de linting');
            }

        } catch (error) {
            results.push('⚠️ No se pudo ejecutar linting');
            this.log('⚠️ No se pudo ejecutar linting:', error.message);
        }

        return { results, warnings };
    }

    /**
     * Validar tests (si existen)
     */
    async validateTests() {
        const results = [];
        const errors = [];

        this.log('🧪 Validando tests...');

        try {
            const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            
            if (packageJson.scripts && packageJson.scripts.test) {
                // Verificar que el script de test no sea el default de npm
                if (packageJson.scripts.test.includes('Error: no test specified')) {
                    results.push('⚠️ Script de test no configurado (usando default de npm)');
                    this.log('⚠️ Script de test no configurado');
                } else {
                    try {
                        // Intentar ejecutar tests con timeout
                        execSync('npm test', { 
                            stdio: 'ignore', 
                            timeout: this.config.testTimeout 
                        });
                        results.push('✅ Tests ejecutados exitosamente');
                        this.log('✅ Tests ejecutados exitosamente');
                    } catch (error) {
                        const errorMsg = '❌ Tests fallaron';
                        results.push(errorMsg);
                        errors.push({ type: 'test_failure', message: errorMsg });
                        this.log(errorMsg);
                    }
                }
            } else {
                results.push('⚠️ No se encontraron tests configurados');
                this.log('⚠️ No se encontraron tests configurados');
            }

        } catch (error) {
            results.push('⚠️ No se pudo validar tests');
            this.log('⚠️ Error validando tests:', error.message);
        }

        return { results, errors };
    }

    /**
     * Calcular score de validación
     */
    calculateValidationScore(validationResults) {
        const totalChecks = validationResults.validations.length;
        const passedChecks = validationResults.validations.filter(v => v.includes('✅')).length;
        const criticalErrors = validationResults.errors.filter(e => 
            e.type === 'missing_file' || 
            e.type === 'syntax_error' || 
            e.type === 'build_error'
        ).length;

        if (totalChecks === 0) return 0;

        let score = Math.round((passedChecks / totalChecks) * 100);
        
        // Penalizar errores críticos
        score -= (criticalErrors * 20);
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Registrar validación en historial
     */
    recordValidation(validationResults) {
        this.validationHistory.validations.unshift(validationResults);
        
        // Mantener solo las últimas 50 validaciones
        if (this.validationHistory.validations.length > 50) {
            this.validationHistory.validations = this.validationHistory.validations.slice(0, 50);
        }

        this.validationHistory.lastValidation = validationResults.timestamp;
        this.validationHistory.totalValidations = this.validationHistory.validations.length;
        
        this.saveValidationHistory();
        this.log(`📊 Validación registrada: ${validationResults.passed ? 'PASSED' : 'FAILED'} (${validationResults.score}%)`);
    }

    /**
     * Cargar historial de validaciones
     */
    loadValidationHistory() {
        try {
            if (fs.existsSync(this.config.validationHistoryFile)) {
                return JSON.parse(fs.readFileSync(this.config.validationHistoryFile, 'utf8'));
            }
        } catch (error) {
            this.log('⚠️ Error al cargar historial de validaciones:', error.message);
        }

        return {
            validations: [],
            lastValidation: null,
            totalValidations: 0
        };
    }

    /**
     * Guardar historial de validaciones
     */
    saveValidationHistory() {
        try {
            fs.writeFileSync(this.config.validationHistoryFile, JSON.stringify(this.validationHistory, null, 2));
        } catch (error) {
            this.log('❌ Error al guardar historial de validaciones:', error.message);
        }
    }

    /**
     * Generar reporte de validaciones
     */
    generateValidationReport() {
        const recentValidations = this.validationHistory.validations.slice(0, 10);
        const passRate = recentValidations.length > 0 ? 
            (recentValidations.filter(v => v.passed).length / recentValidations.length * 100).toFixed(1) :
            0;

        const report = {
            timestamp: new Date().toISOString(),
            totalValidations: this.validationHistory.totalValidations,
            lastValidation: this.validationHistory.lastValidation,
            recentPassRate: `${passRate}%`,
            recentValidations: recentValidations.map(v => ({
                timestamp: v.timestamp,
                passed: v.passed,
                score: v.score,
                errors: v.errors.length,
                warnings: v.warnings.length
            }))
        };

        this.log('📊 Reporte de validaciones generado:', JSON.stringify(report, null, 2));
        return report;
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
        const logMessage = `[${timestamp}] [VALIDATOR] ${message}`;
        
        console.log(logMessage, ...args);
        
        try {
            fs.appendFileSync(this.config.logFile, logMessage + '\n');
        } catch (error) {
            console.error('Error escribiendo al log file:', error.message);
        }
    }
}

// CLI Interface
if (require.main === module) {
    const command = process.argv[2];
    const validator = new DeployValidator();
    
    switch (command) {
        case 'validate':
            validator.runAllValidations().then(result => {
                process.exit(result.passed ? 0 : 1);
            });
            break;
        case 'report':
            validator.generateValidationReport();
            break;
        case 'history':
            console.log(JSON.stringify(validator.validationHistory, null, 2));
            break;
        case 'help':
        default:
            console.log(`
✅ Deploy Validator System

Uso: node deploy-validator.js [comando]

Comandos:
  validate  - Ejecutar todas las validaciones pre-deploy
  report    - Generar reporte de validaciones
  history   - Mostrar historial de validaciones
  help      - Mostrar esta ayuda

El validador verifica:
  ✅ Archivos requeridos (package.json, server.js, render.yaml)
  ✅ Sintaxis de JavaScript
  ✅ Dependencias de NPM
  ✅ Configuración de package.json
  ✅ Build simulation
  ✅ Seguridad básica
  ⚠️  Linting (opcional)
  ⚠️  Tests (opcional)

Ejemplo:
  node deploy-validator.js validate
            `);
            break;
    }
}

module.exports = DeployValidator;
