# CONFIGURACIÓN RAILWAY - PASO A PASO

## EL PROBLEMA
Railway NO está guardando tus datos entre deploys. Cada vez que se hace push, se pierden.

## LA SOLUCIÓN - CONFIGURAR VOLUMEN PERSISTENTE

### 1. Ve a Railway Dashboard
https://railway.app/dashboard

### 2. Selecciona tu proyecto POS-CONEJONEGRO

### 3. Click en "Settings" → "Volumes"

### 4. Crear nuevo volumen:
- Mount Path: `/app/data`
- Name: `pos-data`
- Size: 1GB

### 5. En "Variables" agregar:
```
RAILWAY_VOLUME_MOUNT_PATH=/app/data
DATABASE_PERSIST=true
JWT_SECRET=conejo-negro-pos-2025
```

### 6. Click "Deploy" para reiniciar con el volumen

## VERIFICACIÓN

Una vez configurado el volumen, los datos se guardarán en:
- `/app/data/records.json` - Tus transacciones
- `/app/data/users.json` - Usuarios
- `/app/data/products.json` - Productos

## TUS DATOS REALES
- Cliente Prueba: $214
- Test Cliente: $25
- Total ayer: $239

Estos datos YA están en el código, pero necesitas el volumen para que persistan.