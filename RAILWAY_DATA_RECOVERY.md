# Railway Data Recovery Instructions

## Problema Identificado
Los datos del POS se perdieron debido a que Railway no está configurado con volumen persistente adecuadamente.

## Estado Actual
- ✅ Código configurado para usar volumen persistente (`RAILWAY_VOLUME_MOUNT_PATH`)
- ❌ Railway no tiene volumen persistente configurado
- ✅ Datos de ejemplo agregados temporalmente

## Configuración Necesaria en Railway

### 1. Configurar Volumen Persistente
En el dashboard de Railway:

1. Ve a tu proyecto POS-CONEJONEGRO
2. Ve a la pestaña "Variables"
3. Verifica que `RAILWAY_VOLUME_MOUNT_PATH` esté configurada como `/app/data`
4. Ve a la pestaña "Settings" 
5. En "Volumes" agrega un nuevo volumen:
   - **Mount Path**: `/app/data`
   - **Size**: 1GB (suficiente para el POS)

### 2. Variables de Entorno Requeridas
```
NODE_ENV=production
JWT_SECRET=tu-clave-secreta-segura
RAILWAY_VOLUME_MOUNT_PATH=/app/data
```

### 3. Redeploy
Después de configurar el volumen, haz un nuevo deployment para que Railway monte el volumen correctamente.

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