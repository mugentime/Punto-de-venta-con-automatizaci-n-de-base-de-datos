# 🧠 TaskMaster - Memoria Permanente de Errores y Lecciones

## ⚠️ REGLAS CRÍTICAS - NUNCA OLVIDAR

### 🚫 NUNCA HACER DEPLOY SIN VALIDAR
- **REGLA #1:** SIEMPRE validar correcciones localmente ANTES de git push
- **REGLA #2:** NUNCA hacer `git push` o `render deploy` hasta confirmar que la solución funciona
- **REGLA #3:** Crear pruebas de validación PRIMERO, luego corregir, luego validar, DESPUÉS deploy

### 🔧 PATRONES DE ERROR RECURRENTES

#### Error Tipo A: Modificaciones Directas Fallidas
- **Problema:** Intentar modificar archivos complejos directamente
- **Síntoma:** Dependencias rotas, métodos faltantes, importaciones duplicadas
- **Solución:** Crear nuevo servicio limpio en lugar de modificar existente
- **Ejemplo:** `cashCutService.js` → `improvedCashCutService.js` ✅

#### Error Tipo B: Ediciones Sin Completar
- **Problema:** Hacer cambios parciales que rompen funcionalidad
- **Síntoma:** Llamadas a métodos que no existen
- **Solución:** Completar TODA la implementación antes de probar
- **Ejemplo:** `performEnhancedManualCashCut` no implementado ❌

#### Error Tipo C: No Validar Antes de Deploy
- **Problema:** Hacer push sin probar localmente
- **Síntoma:** Usuario pregunta si ya hice deploy cuando aún no probé
- **Solución:** SIEMPRE probar → validar → DESPUÉS deploear

## 📋 PROTOCOLO OBLIGATORIO PARA CORRECCIONES

### Paso 1: DIAGNÓSTICO
```bash
1. Reproducir el problema EXACTAMENTE
2. Confirmar evidencia del bug
3. Documentar en archivo permanente
```

### Paso 2: SOLUCIÓN
```bash
1. Crear nuevo archivo/servicio (NO modificar existente si es complejo)
2. Implementar COMPLETA la solución
3. Mantener TaskMaster como arquitecto principal
```

### Paso 3: VALIDACIÓN (OBLIGATORIO)
```bash
1. Crear script de prueba
2. Ejecutar pruebas localmente
3. Confirmar que problema está RESUELTO
4. Solo DESPUÉS considerar deploy
```

### Paso 4: DEPLOY (SOLO DESPUÉS DE VALIDAR)
```bash
1. git add .
2. git commit -m "TaskMaster: Fix [problema]"
3. git push
4. Monitorear deploy
```

## 🎯 CHECKLIST DE VALIDACIÓN ANTES DE DEPLOY

- [ ] ¿Reproduje el problema original?
- [ ] ¿Confirmé que mi solución lo resuelve?
- [ ] ¿Probé la solución localmente?
- [ ] ¿Ejecuté script de pruebas?
- [ ] ¿Documenté los cambios?
- [ ] ¿TaskMaster supervisa la corrección?

**SOLO SI TODOS SON ✅ → ENTONCES DEPLOY**

## 📝 ESTADO ACTUAL - DUPLICADOS CORTES DE CAJA

### ✅ COMPLETADO:
- Problema reproducido y confirmado
- Evidencia documentada
- `improvedCashCutService.js` creado
- `routes/cashcuts-file.js` actualizado
- Supervisor TaskMaster activado
- Memoria permanente creada

### ⏳ PENDIENTE:
- [ ] **PROBAR LA SOLUCIÓN** (CRÍTICO)
- [ ] Validar que duplicados están prevenidos
- [ ] Confirmar que montos son correctos
- [ ] SOLO DESPUÉS → Deploy

## 🚨 SEÑALES DE ALERTA

### Cuándo DETENER y NO hacer deploy:
1. Usuario pregunta si ya hice deploy
2. No he probado la solución
3. Hay métodos sin implementar
4. Importaciones rotas
5. Scripts de prueba fallan

### Cuándo SÍ proceder con deploy:
1. Pruebas locales pasan
2. Problema original resuelto
3. No hay errores de sintaxis
4. TaskMaster confirma corrección

## 🔄 PRÓXIMA ACCIÓN INMEDIATA

**AHORA MISMO:** Crear y ejecutar script de validación para duplicados de cortes de caja

**NO HACER:** Git push hasta confirmar que funciona

---
**Última actualización:** 2025-09-05T18:53:16Z
**Responsable:** TaskMaster
**Status:** ACTIVA - Consultarla SIEMPRE antes de deploy
