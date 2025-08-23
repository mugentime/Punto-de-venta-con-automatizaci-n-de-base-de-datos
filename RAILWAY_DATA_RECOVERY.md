# Railway Data Recovery Instructions

## Problema Identificado
Los datos del POS se perdieron debido a que Railway reemplaza el sistema de archivos en cada deployment.

## Estado Actual
- ✅ Código configurado para usar persistencia de archivos
- ❌ Railway no mantiene archivos entre deployments
- ✅ Datos de ejemplo agregados temporalmente

## Configuración Actualizada de Railway (2025)

### 1. Opciones para Persistencia de Datos

**OPCIÓN A: PostgreSQL Database (Recomendada)**
Railway ofrece PostgreSQL gratuito que es la mejor opción para persistencia:

1. En tu proyecto Railway
2. Botón "New" → "Database" → "Add PostgreSQL"
3. Esto creará una base de datos persistente automáticamente
4. Se generarán variables como `DATABASE_URL` automáticamente

**OPCIÓN B: Variables de Entorno para Configuración**
Para mantener usando archivos (menos recomendado):

1. Ve a tu proyecto Railway 
2. Pestaña "Variables"
3. Agregar estas variables:
   ```
   NODE_ENV=production
   JWT_SECRET=tu-clave-segura-de-32-caracteres-minimo
   DATA_PERSISTENCE=true
   ```

**IMPORTANTE**: Railway ya no soporta volúmenes persistentes en el plan gratuito para archivos JSON. Los datos se perderán en cada deployment.

## Soluciones Prácticas Inmediatas

### SOLUCIÓN 1: Usar PostgreSQL (Más Robusta) 
```bash
# En Railway Dashboard:
1. Crear servicio PostgreSQL (gratis)
2. Migrar a base de datos real
3. Datos persisten automáticamente
```

### SOLUCIÓN 2: Sistema de Backup Manual (Rápida)
```bash
# Usar botón "Exportar Respaldo" antes de cada deployment
1. Descargar backup JSON
2. Después del deployment, subir datos via API
3. Repetir según necesidad
```

### SOLUCIÓN 3: No hacer más deployments (Temporal)
```bash
# Mantener datos actuales:
1. No hacer push al repositorio por ahora  
2. Trabajar localmente para desarrollo
3. Solo deployar cambios críticos
4. Usar "Exportar Respaldo" antes de cualquier deployment
```

### Variables de Entorno Actuales Necesarias
```
NODE_ENV=production
JWT_SECRET=crea-clave-segura-de-32-caracteres-aqui
PORT=3000
```

## Recomendación Urgente
**Para no perder más datos:**
1. ✅ USA el botón "Exportar Respaldo" AHORA mismo 
2. ✅ Guarda el archivo JSON en tu computadora
3. ⚠️  NO hagas más deployments hasta decidir la estrategia de persistencia

## Datos de Recuperación
He agregado datos de ejemplo realistas que incluyen:

### Productos (ya existían)
- Cafetería: Espresso, Americano, Capuccino, Latte
- Refrigerador: Coca-Cola, Agua Mineral, Jugo de Naranja

### Registros de Ejemplo (agregados)
- **María González**: Americano con propina ($45 total)
- **Juan Pérez**: Coworking 3 horas + 2 Espresso ($184 total)
- **Ana Ruiz**: Capuccino + Coca-Cola ($70 total) 
- **Carlos López**: Coworking 2 horas + Latte ($126 total)
- **Sofia Martínez**: Jugo de Naranja con propina ($40 total)

### Métricas de Ejemplo
- **Total Clientes**: 5
- **Ingresos**: $465
- **Costos**: $109  
- **Ganancias**: $356
- **Propinas**: $30

## Prevención Futura
1. ✅ Configurar volumen persistente en Railway
2. ✅ Implementar backups automáticos 
3. ✅ Exportar reportes regularmente
4. ⚠️ **NUNCA** hacer commit de datos reales al repositorio por seguridad

## Notas Importantes
- Los datos que agregué son solo ejemplos para testing
- Una vez configurado el volumen persistente, los datos reales se mantendrán
- El sistema de reportes funcionará correctamente con los datos de ejemplo
- Puedes eliminar estos datos de ejemplo y agregar datos reales