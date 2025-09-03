# 🚀 INSTRUCCIONES CRÍTICAS PARA RAILWAY

## ⚠️ PROBLEMA IDENTIFICADO
La aplicación está funcionando pero usando **file-based database** en lugar de **PostgreSQL**.

## 🔧 SOLUCIÓN URGENTE

### 1️⃣ Configurar Variables de Entorno en Railway Dashboard

Ve a tu proyecto Railway: https://railway.app/project/fed11c6d-a65a-4d93-90e6-955e16b6753f

**Variables requeridas:**
```
DATABASE_URL = postgresql://postgres:aezVREfCHRpQHBfwweXHEaANsbeIMeno@postgres.railway.internal:5432/railway
NODE_ENV = production
PORT = 3000
```

### 2️⃣ Verificar PostgreSQL Service

1. En Railway Dashboard, verifica que tienes el servicio **PostgreSQL** activo
2. Si no existe: Click "New" → "Database" → "Add PostgreSQL"  
3. Railway automáticamente creará `DATABASE_URL`

### 3️⃣ Redeploy Forzado

Después de configurar las variables:
1. Ve a Deployments
2. Click "Redeploy" en el último deployment

### 4️⃣ Verificar Éxito

Después del redeploy, verifica en:
https://pos-conejonegro-production.up.railway.app/api/health

**Debe mostrar:**
```json
{
  "database": {
    "type": "postgresql",
    "status": "ready"
  }
}
```

## 🎯 ESTADO ACTUAL

✅ **Funcionando**: Home, Login, API endpoints  
❌ **Problema**: Usando file-based DB (datos se pierden)  
🎯 **Necesario**: Configurar DATABASE_URL en Railway

## 🔍 Debug

Para verificar si DATABASE_URL está disponible después del redeploy:
- Logs deberían mostrar: "🔗 Using PostgreSQL connection"
- Health endpoint debe mostrar: "type": "postgresql"