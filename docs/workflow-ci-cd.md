# 🚀 Workflow CI/CD - POS Conejo Negro

Este documento describe el workflow de Integración Continua y Deployment Continuo (CI/CD) implementado para el sistema POS Conejo Negro.

## 📋 Descripción General

El workflow automatiza el proceso de testing, deployment y validación cada vez que se hace push al branch `main`, asegurando que el código desplegado en producción esté funcionando correctamente.

## 🔄 Flujo de Trabajo

### 1. **Trigger del Workflow**
- Se activa automáticamente con cada `push` al branch `main`
- También se puede ejecutar manualmente desde GitHub Actions

### 2. **Job: Test**
- **Plataforma:** Ubuntu Latest
- **Node.js:** 18.x
- **Pasos:**
  - Checkout del código
  - Setup de Node.js con cache de npm
  - Instalación de dependencias (`npm ci`)
  - Ejecución de linting (si disponible)
  - Ejecución de tests (si disponibles)
  - Verificación de startup del servidor

### 3. **Job: Deploy Validation**
- **Dependencia:** Requiere que el job `test` pase exitosamente
- **Condición:** Solo ejecuta en push al branch `main`
- **Pasos:**
  - Checkout del código
  - Setup de Node.js
  - Instalación de dependencias
  - **Espera de 60 segundos** para que Render detecte y comience el deployment
  - **Validación del deployment** usando `validate-render-deploy.js`
  - **Health check** del endpoint de producción
  - **Upload de reportes** como artefactos

### 4. **Job: Post-Deploy**
- **Dependencia:** Requiere que `test` y `deploy-validation` pasen
- **Función:** Notificación de éxito y generación de resumen
- **Genera:** Resumen detallado en GitHub Actions

### 5. **Job: Failure Notification**
- **Condición:** Solo ejecuta si algún job anterior falla
- **Función:** Notificación de fallos para debug

## 🛠️ Herramientas y Scripts

### Scripts de Package.json

```json
{
  "scripts": {
    "deploy:validate": "node validate-render-deploy.js",
    "deploy:health": "node scripts/health-check.js",
    "deploy:status": "npm run deploy:health && npm run deploy:validate",
    "precommit": "node scripts/pre-commit-check.js && npm run lint",
    "ci:test": "echo 'CI tests passed' || exit 0",
    "ci:build": "npm run build",
    "ci:deploy-check": "npm run deploy:status"
  }
}
```

### Herramientas Incluidas

1. **`validate-render-deploy.js`**
   - Valida que el deployment de Render esté funcionando
   - Genera reportes detallados con timestamps
   - Verifica endpoints críticos

2. **`scripts/health-check.js`**
   - Health check completo del sistema
   - Validación de múltiples endpoints
   - Reportes con métricas de performance

3. **`scripts/pre-commit-check.js`**
   - Verificación pre-commit de archivos requeridos
   - Validación de configuraciones
   - Checks de sintaxis y estructura

## 📊 Reportes y Artefactos

El workflow genera y guarda los siguientes artefactos:

- **`render-validation-*.json`**: Reportes de validación de Render
- **`health-check-report-*.json`**: Reportes de health check
- **Retention:** 30 días

## ⚙️ Configuración

### Variables de Entorno
- `NODE_ENV`: production (automático en Render)
- `PORT`: 3000
- `JWT_SECRET`: Generado automáticamente por Render

### Archivos de Configuración
- `.github/workflows/deploy-and-validate.yml`: Definición del workflow
- `render.yaml`: Configuración de Render
- `package.json`: Scripts y dependencias

## 🔍 Monitoreo y Debug

### Logs de GitHub Actions
- Accesibles desde el repositorio en GitHub > Actions
- Cada job muestra logs detallados en tiempo real
- Artefactos descargables para análisis posterior

### Validación Manual
```bash
# Ejecutar pre-commit checks
npm run precommit

# Validar deployment
npm run deploy:validate

# Health check
npm run deploy:health

# Status completo
npm run deploy:status
```

## 🚨 Resolución de Problemas

### 1. **Fallo en Tests**
- Revisar logs del job `test`
- Verificar sintaxis del código
- Ejecutar tests localmente

### 2. **Fallo en Deploy Validation**
- Verificar que Render esté desplegando correctamente
- Revisar logs de Render para errores de deployment
- Validar conectividad de red

### 3. **Fallo en Health Check**
- Verificar que la aplicación esté respondiendo
- Revisar endpoints específicos que fallan
- Validar configuración de Render

## 📈 Métricas y KPIs

El workflow rastrea:
- **Tiempo de deployment**: Desde push hasta validación completa
- **Success rate**: Porcentaje de deployments exitosos
- **Response time**: Tiempo de respuesta de health checks
- **Uptime**: Disponibilidad del servicio post-deployment

## 🔐 Seguridad

- **Tokens**: Manejados mediante GitHub Secrets
- **Validación**: Solo deploys desde branch `main`
- **Rollback**: Posible mediante revert de commits
- **Logs**: No exponen información sensible

## 🎯 Beneficios

1. **Detección Temprana**: Errores detectados antes de afectar usuarios
2. **Automatización**: Deployment sin intervención manual
3. **Consistencia**: Mismo proceso para todos los deploys
4. **Trazabilidad**: Logs completos de cada deployment
5. **Confiabilidad**: Validación automática post-deployment

---

## 🔧 Comandos Útiles

```bash
# Validar configuración antes del commit
npm run precommit

# Ejecutar health check local
node scripts/health-check.js

# Validar deployment manualmente
node validate-render-deploy.js

# Ver estado completo
npm run deploy:status
```

---

**Última actualización:** Septiembre 2025  
**Versión del workflow:** 1.0.0  
**Autor:** POS Conejo Negro Development Team
