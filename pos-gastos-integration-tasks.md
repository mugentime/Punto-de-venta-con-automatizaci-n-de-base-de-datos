# 🎯 TASKMASTER PLAN: INTEGRACIÓN PESTAÑA GASTOS POS

## 📋 PROBLEMA IDENTIFICADO
- La pestaña "Gastos" no aparece en el frontend del POS
- El módulo `gastos.html` existe pero no está integrado
- Backend de gastos funcional pero desconectado del frontend principal

## 🎯 OBJETIVO
Integrar completamente el módulo de gastos en la aplicación principal del POS, incluyendo navegación, funcionalidad y deploy automático.

## 📋 TAREAS TASKMASTER

### TAREA 1: PREPARACIÓN DEL ENTORNO Y VALIDACIÓN
**Objetivo**: Configurar el entorno y validar componentes existentes  
**Deploy**: ✅ git push + render deploy  
**Acciones**:
- ✅ Crear rama feature/pos-gastos-integration 
- Verificar que gastos.html, ExpenseController.js, routes/expenses-file.js existen
- Iniciar servidor en background para desarrollo en caliente
- Validar endpoints básicos de gastos

### TAREA 2: AUDITORÍA COMPLETA DEL MÓDULO DE GASTOS
**Objetivo**: Documentar estructura actual y dependencias  
**Deploy**: ✅ git push + render deploy  
**Acciones**:
- Analizar gastos.html (HTML/CSS/JS, dependencias, IDs/clases)
- Revisar routes/expenses-file.js y ExpenseController.js
- Documentar endpoints disponibles (/api/expenses, /api/expense-categories)
- Identificar posibles conflictos con app principal

### TAREA 3: AGREGAR PESTAÑA "GASTOS" AL MENÚ DESKTOP
**Objetivo**: Agregar navegación desktop para gastos  
**Deploy**: ✅ git push + render deploy  
**Archivos**: conejo_negro_online.html (líneas 1481-1488)
**Acciones**:
- Agregar `<li><a href="#" class="nav-link" data-section="gastos">Gastos</a></li>`
- Mantener consistencia visual (íconos, clases, estados hover/activo)
- Verificar que el patrón data-section="gastos" funcione

### TAREA 4: AGREGAR PESTAÑA "GASTOS" AL MENÚ MÓVIL
**Objetivo**: Agregar navegación móvil para gastos  
**Deploy**: ✅ git push + render deploy  
**Archivos**: conejo_negro_online.html (líneas 1373-1397)
**Acciones**:
- Agregar elemento al mobile-bottom-nav con data-section="gastos"
- Incluir ícono apropiado y texto "Gastos"
- Verificar comportamiento de selección activa y colapso

### TAREA 5: CREAR SECCIÓN GASTOS EN APLICACIÓN PRINCIPAL
**Objetivo**: Estructura base para el módulo de gastos  
**Deploy**: ✅ git push + render deploy  
**Archivos**: conejo_negro_online.html
**Acciones**:
- Crear `<section id="gastos" class="section" data-section="gastos" style="display: none;">`
- Incluir div contenedor: `<div id="expenses-root"></div>`
- Asegurar consistencia con patrón de secciones existente

### TAREA 6: INTEGRAR HTML DEL MÓDULO DE GASTOS
**Objetivo**: Mover contenido de gastos.html a la app principal  
**Deploy**: ✅ git push + render deploy  
**Archivos**: gastos.html → conejo_negro_online.html
**Acciones**:
- Extraer contenido del body de gastos.html (sin head/scripts duplicados)
- Integrar en #expenses-root
- Prefijar IDs duplicados con "expenses-" para evitar conflictos
- Mantener estructura de formularios, tablas, modales

### TAREA 7: INTEGRAR CSS DEL MÓDULO DE GASTOS
**Objetivo**: Styles consistentes y sin conflictos  
**Deploy**: ✅ git push + render deploy  
**Archivos**: css/gastos.css (nuevo)
**Acciones**:
- Extraer CSS específico de gastos.html
- Encapsular selectores bajo #gastos para evitar conflictos
- Reemplazar colores por variables CSS existentes del tema
- Incluir en head de conejo_negro_online.html

### TAREA 8: MODULARIZAR E INTEGRAR JAVASCRIPT DE GASTOS
**Objetivo**: Funcionalidad JavaScript integrada y organizada  
**Deploy**: ✅ git push + render deploy  
**Archivos**: js/expenses.js (nuevo)
**Acciones**:
- Extraer JS de gastos.html a módulo independiente
- Crear patrón: `window.Expenses = { onEnter, onLeave, init }`
- Implementar delegación de eventos y gestión de estado
- Manejar carga inicial de datos (categorías, listado)

### TAREA 9: CONFIGURAR NAVEGACIÓN SPA PARA GASTOS
**Objetivo**: Integrar gastos al sistema de navegación SPA  
**Deploy**: ✅ git push + render deploy  
**Archivos**: conejo_negro_online.html (sección JS)
**Acciones**:
- Localizar función showSection() y agregar case 'gastos'
- Conectar eventos nav-link y mobile-nav-btn para data-section="gastos"
- Implementar hooks: Expenses.onEnter() al mostrar, onLeave() al salir
- Soportar deep-link: #gastos en URL

### TAREA 10: IMPLEMENTAR CLIENTE API PARA GASTOS
**Objetivo**: Comunicación con backend de gastos  
**Deploy**: ✅ git push + render deploy  
**Archivos**: js/api/expensesApi.js (nuevo)
**Acciones**:
- Crear ExpensesAPI con métodos: list, create, update, delete, categories
- Seguir patrón de autenticación existente (tokens/cookies)
- Manejar errores y mostrar notificaciones consistentes
- Implementar retry y manejo de estado offline

### TAREA 11: VERIFICAR ENDPOINTS DE API DE GASTOS
**Objetivo**: Validar que backend funciona correctamente  
**Deploy**: ✅ git push + render deploy  
**Testing**:
```bash
curl -i http://localhost:3000/api/expenses
curl -i http://localhost:3000/api/expense-categories  
curl -i -X POST http://localhost:3000/api/expenses -H "Content-Type: application/json" -d '{"amount":100,"categoryId":1,"date":"2025-01-01","note":"Test"}'
```

### TAREA 12: IMPLEMENTAR PERMISOS Y CONSISTENCIA UX
**Objetivo**: Control de acceso y experiencia uniforme  
**Deploy**: ✅ git push + render deploy  
**Acciones**:
- Verificar si hay sistema de permisos y agregar rules para gastos
- Mostrar/ocultar pestaña según rol de usuario
- Mantener patrones UX: breadcrumbs, títulos, botones, estados loading
- Implementar estados vacíos y mensajes de error apropiados

### TAREA 13: TESTING END-TO-END DEL MÓDULO GASTOS
**Objetivo**: Validación completa de funcionalidades  
**Deploy**: ✅ git push + render deploy  
**Flujos a probar**:
- ✅ Navegación: desktop/móvil, cambio entre secciones
- ✅ CRUD gastos: crear, listar, editar, eliminar
- ✅ Filtros: por fecha, categoría, búsqueda
- ✅ Validaciones de formulario y manejo de errores
- ✅ Estados responsive y interacción touch
- ✅ Performance: no bloqueos, no memory leaks

### TAREA 14: REFACTOR, CODE REVIEW Y DOCUMENTACIÓN
**Objetivo**: Código limpio y documentado  
**Deploy**: ✅ git push + render deploy  
**Acciones**:
- Lint/format código, eliminar dead code
- Comentarios en expenses.js con JSDoc
- README del módulo con estructura, dependencias, endpoints
- Screenshots del módulo funcionando

### TAREA 15: MERGE Y DEPLOY A PRODUCCIÓN
**Objetivo**: Integrar cambios a rama principal  
**Deploy**: ✅ git push main + render deploy automático  
**Acciones**:
- Merge a main tras code review
- Trigger deploy automático de Render
- Smoke test post-deploy: navegación y CRUD básico
- Monitoreo de logs para detectar errores

### TAREA 16: MONITOREO POST-DEPLOY Y VALIDACIÓN FINAL
**Objetivo**: Confirmar funcionamiento en producción  
**Deploy**: ✅ Monitoreo continuo  
**Acciones**:
- Verificar que la pestaña "Gastos" aparece en producción
- Probar funcionalidades clave: crear/editar/eliminar gasto
- Monitorear logs de errores en backend
- Confirmar que todos los endpoints responden correctamente
- Documentar cualquier issue encontrado

## 🔄 PATRÓN DE DEPLOY POR TAREA
Cada tarea incluye:
1. **Desarrollo**: Implementar cambios
2. **Testing**: Validar funcionamiento local
3. **Commit**: `git add . && git commit -m "feat: [descripción tarea]"`
4. **Push**: `git push origin feature/pos-gastos-integration`
5. **Deploy**: Trigger automático de Render
6. **Validación**: Confirmar funcionamiento en ambiente desplegado

## 🎯 RESULTADO ESPERADO
- ✅ Pestaña "Gastos" visible en menú desktop y móvil
- ✅ Funcionalidad completa de gestión de gastos integrada
- ✅ Navegación fluida entre todas las secciones del POS
- ✅ Backend y frontend completamente conectados
- ✅ Deploy automático funcionando para cada cambio
- ✅ Documentación y código limpio

---
**Creado por**: TaskMaster MCP Integration  
**Fecha**: 2025-09-08  
**Branch**: feature/pos-gastos-integration
