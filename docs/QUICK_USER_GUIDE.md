# 🚀 Guía Rápida - Sistema de Sincronización POS Conejo Negro

## 📱 Acceso al Dashboard de Sincronización

**URL**: `https://pos-conejo-negro.onrender.com/sync-dashboard.html`

## 🎯 Funciones Principales

### ✅ Verificar Estado del Sistema
1. Abre el dashboard de sincronización
2. En la parte superior verás el estado:
   - 🟢 **Verde** = Todo funciona correctamente  
   - 🟡 **Amarillo** = Advertencias menores
   - 🔴 **Rojo** = Requiere atención

### 💾 Crear Backup Manual
1. En el dashboard, busca el botón **"Crear Backup"**
2. Haz clic y espera la confirmación
3. El nuevo backup aparecerá en la lista
4. ✅ **Recomendación**: Crear backup antes de operaciones importantes

### 🔄 Restaurar Datos
1. En "Lista de Backups", encuentra el backup deseado
2. Haz clic en **"Restaurar"** junto al backup
3. Confirma la acción en el diálogo
4. Espera a que se complete (unos segundos)
5. ✅ El sistema restaurará todos los datos

### 🔍 Monitoreo de Archivos
El dashboard muestra el estado de cada archivo:
- `users.json` - Usuarios del sistema
- `products.json` - Catálogo de productos  
- `records.json` - Ventas registradas
- `cash_cuts.json` - Cortes de caja
- `expenses.json` - Gastos

## 🚨 Cuándo Usar Cada Función

### Crear Backup Manual:
- ✅ Antes de cambios importantes (nuevos usuarios, productos)
- ✅ Antes de cortes de caja importantes
- ✅ Si notas problemas con el sistema
- ✅ Al final de cada día laboral

### Restaurar desde Backup:
- 🆘 Si se perdieron datos importantes
- 🆘 Si hay errores en los registros
- 🆘 Para volver a un estado anterior conocido
- 🆘 Si el dashboard muestra errores rojos

### Verificar Estado:
- 📅 **Diariamente** antes de abrir el negocio
- 📅 Si hay problemas con ventas o productos
- 📅 Después de actualizaciones del sistema

## 🔧 Solución Rápida de Problemas

### ❌ "No se pueden guardar las ventas"
1. Ve al dashboard de sincronización
2. Verifica si hay errores rojos
3. Crea un backup manual
4. Si el problema persiste, restaura el último backup bueno

### ❌ "Los productos no aparecen"
1. Revisa el estado de `products.json` en el dashboard
2. Si aparece en rojo, restaura desde backup
3. Verifica que el backup se haya creado correctamente

### ❌ "Error de sincronización" 
1. El sistema se recupera automáticamente
2. Si persiste, crear backup manual forzará la sincronización
3. El indicador debe volver a verde en unos minutos

## 📋 Rutina Recomendada

### Cada Mañana (2 minutos):
1. ✅ Abrir dashboard de sincronización
2. ✅ Verificar que todo esté en verde
3. ✅ Confirmar que hay backups recientes

### Cada Noche (1 minuto):
1. ✅ Crear backup manual del día
2. ✅ Verificar que se guardó correctamente

### Una Vez por Semana (5 minutos):
1. ✅ Revisar la lista de backups
2. ✅ Confirmar que el sistema funciona sin errores
3. ✅ Reportar cualquier problema persistente

## 📞 Contacto de Emergencia

Si tienes problemas graves:
1. **Anota** exactamente qué estabas haciendo
2. **Toma captura** del mensaje de error
3. **No hagas** cambios adicionales
4. **Contacta** al soporte técnico

## 💡 Consejos Importantes

### ✅ Buenas Prácticas:
- Crear backup antes de operaciones importantes
- Verificar estado del dashboard diariamente  
- No cerrar el navegador durante restauraciones
- Mantener internet estable durante sincronizaciones

### ❌ Evitar:
- Restaurar backups muy antiguos sin necesidad
- Ignorar indicadores rojos en el dashboard
- Hacer cambios durante sincronizaciones en progreso
- Cerrar el sistema abruptamente

---

## 🎉 ¡Beneficios del Nuevo Sistema!

### 💰 **Costo Cero**
- No más pagos mensuales por base de datos
- Backup automático incluido
- Mantenimiento simplificado

### 🛡️ **Más Seguro**
- Backups automáticos cada hora
- Historial completo de cambios
- Recuperación instantánea

### 🚀 **Más Rápido**
- Datos locales = velocidad máxima
- Sin dependencia de internet para operaciones básicas
- Sincronización inteligente en segundo plano

---

*Para más detalles técnicos, consulta el archivo `FILE_BASED_DATABASE_SYSTEM.md`*
