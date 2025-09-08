# 📋 REGLAS DE GESTIÓN DE DEPENDENCIAS
## POS CONEJO NEGRO - DEPENDENCY MANAGEMENT RULES

### 🚨 **REGLA CRÍTICA: VERIFICACIÓN AUTOMÁTICA DE DEPENDENCIAS**

**Problema Identificado:** El error `Cannot find module 'redis'` y otros módulos faltantes ocurre frecuentemente al iniciar el servidor, causando fallos en el sistema.

**Solución Implementada:** Scripts automáticos de verificación y reparación de dependencias.

---

## 🛠️ **SCRIPTS IMPLEMENTADOS**

### 1. **fix-dependencies.ps1**
- **Propósito:** Verificar e instalar automáticamente dependencias faltantes
- **Uso:** `.\fix-dependencies.ps1`
- **Funcionalidades:**
  - ✅ Verifica dependencias críticas: redis, express, cors, helmet, etc.
  - ✅ Instala automáticamente módulos faltantes
  - ✅ Verifica integridad de node_modules
  - ✅ Reinstala si node_modules está corrupto

### 2. **start-server-safe.ps1**
- **Propósito:** Iniciar el servidor con verificaciones previas automáticas
- **Uso:** 
  - Segundo plano: `.\start-server-safe.ps1 -Background`
  - Primer plano: `.\start-server-safe.ps1`
  - Saltar deps: `.\start-server-safe.ps1 -Background -SkipDepsCheck`
- **Funcionalidades:**
  - ✅ Verifica que el servidor no esté ya ejecutándose
  - ✅ Ejecuta verificación de dependencias automáticamente
  - ✅ Valida archivos críticos (server.js, package.json)
  - ✅ Inicia servidor en modo seguro
  - ✅ Verifica conectividad después del inicio

---

## 📝 **NUEVA REGLA PARA AGENTES**

**REGLA ID:** DEPENDENCY_AUTO_CHECK
**PRIORIDAD:** ALTA
**APLICACIÓN:** Siempre antes de iniciar el servidor

### **Procedimiento Obligatorio:**

1. **ANTES de iniciar cualquier servidor o aplicación Node.js:**
   ```powershell
   # Verificar dependencias automáticamente
   .\fix-dependencies.ps1
   
   # O usar el script de inicio seguro
   .\start-server-safe.ps1 -Background
   ```

2. **Si encuentras error "Cannot find module":**
   ```powershell
   # Ejecutar reparación automática
   .\fix-dependencies.ps1
   
   # Reiniciar servidor
   .\start-server-safe.ps1 -Background -Force
   ```

3. **Para desarrollo/testing:**
   ```powershell
   # Inicio rápido (saltando verificación si estás seguro)
   .\start-server-safe.ps1 -Background -SkipDepsCheck
   ```

---

## 🎯 **DEPENDENCIAS CRÍTICAS MONITOREADAS**

Las siguientes dependencias se verifican automáticamente:

- **redis** - Para caché y sesiones
- **express** - Framework web principal
- **cors** - Manejo de CORS
- **helmet** - Seguridad
- **express-rate-limit** - Limitación de requests
- **dotenv** - Variables de entorno
- **bcryptjs** - Hashing de passwords
- **jsonwebtoken** - Autenticación JWT
- **multer** - Upload de archivos
- **node-cron** - Tareas programadas

---

## ⚡ **COMANDOS RÁPIDOS**

```powershell
# Verificar y reparar dependencias
.\fix-dependencies.ps1

# Iniciar servidor en segundo plano con verificación completa
.\start-server-safe.ps1 -Background

# Verificar estado del servidor
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing

# Acceder a gestión de gastos
Start-Process "http://localhost:3000/gastos.html"
```

---

## 🔄 **AUTOMATIZACIÓN**

**Los siguientes procesos ahora son AUTOMÁTICOS:**
- ✅ Verificación de dependencias al iniciar
- ✅ Instalación de módulos faltantes
- ✅ Validación de integridad de node_modules
- ✅ Reinicio limpio del servidor
- ✅ Verificación de conectividad post-inicio

**RESULTADO:** Eliminación de errores manuales y mayor estabilidad del sistema.

---

## 📞 **USO DE LA REGLA**

**Para Agentes/Desarrolladores:**
1. SIEMPRE usar `.\start-server-safe.ps1 -Background` en lugar de `node server.js`
2. Si hay error de módulo faltante, ejecutar `.\fix-dependencies.ps1` inmediatamente
3. Nunca ignorar errores de dependencias - el script los resolverá automáticamente

**Beneficios:**
- 🚀 Inicio de servidor más rápido y confiable
- 🛡️ Prevención de errores comunes
- 📊 Logs informativos del proceso
- ⚡ Reparación automática sin intervención manual
