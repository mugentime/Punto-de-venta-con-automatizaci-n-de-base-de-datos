# 🚀 Railway Deployment - Manual Steps

**Status**: Project linked to Railway ✅
**Environment**: production
**Services**: POS.CLAUDE (app), Postgres (database)

---

## ⚠️ Railway CLI Limitation

Railway CLI requiere selección interactiva de servicios cuando hay múltiples servicios en un proyecto. Por favor ejecuta estos comandos manualmente:

---

## 📋 PASO 1: Link Service (1 minuto)

```bash
railway service
```

**Cuando aparezca el menú:**
- Selecciona: `POS.CLAUDE` (la aplicación)
- Presiona: Enter

**Verifica:**
```bash
railway status
```

Debe mostrar: `Service: POS.CLAUDE`

---

## 🗄️ PASO 2: Ejecutar Migraciones (3 minutos)

### Migración 1: Tabla de idempotency

```bash
railway run psql $DATABASE_URL -f database/migrations/001_add_idempotency_table.sql
```

**Verifica:**
```bash
railway run psql $DATABASE_URL -c "\dt idempotency_keys"
```

Debe mostrar:
```
 Schema |       Name        | Type  |  Owner
--------+-------------------+-------+----------
 public | idempotency_keys  | table | postgres
```

---

### Migración 2: Stored Procedures

```bash
railway run psql $DATABASE_URL -f database/migrations/002_create_stored_procedures.sql
```

**Verifica:**
```bash
railway run psql $DATABASE_URL -c "\df create_order_atomic"
```

Debe mostrar la función `create_order_atomic`

---

### Migración 3: Índices de Performance

```bash
railway run psql $DATABASE_URL -f database/migrations/003_add_performance_indexes.sql
```

**Verifica:**
```bash
railway run psql $DATABASE_URL -c "\di idx_orders_created_at"
railway run psql $DATABASE_URL -c "\di idx_idempotency_expires"
```

Ambos índices deben aparecer

---

## 🚢 PASO 3: Deploy Application (2 minutos)

```bash
railway up --detach
```

**Monitorea logs:**
```bash
railway logs --follow
```

**Busca estos indicadores de éxito:**
```
✅ [WS] WebSocket server initialized
✅ Server listening on port...
✅ Connected to PostgreSQL database
✅ 5 rooms created: cash, customers, orders, products, coworking
```

Press Ctrl+C para detener logs (deployment continúa)

---

## ✅ PASO 4: Verificación (5 minutos)

### Test 1: WebSocket Connection

1. Abre tu app Railway en navegador
2. Abre DevTools (F12) → Console
3. Busca: `[WS] Connected to server`
4. Verifica esquina superior derecha: **"En línea"** (verde)

✅ **Esperado**: Indicador verde, WebSocket conectado

---

### Test 2: Sincronización de Caja

1. Abre PWA en dispositivo 1
2. Abre PWA en dispositivo 2
3. **Dispositivo 1**: Abre caja
4. **Dispositivo 2**: **Debe aparecer INSTANTÁNEAMENTE**

✅ **Esperado**: Sincronización < 1 segundo

---

### Test 3: Clientes en Lista

1. Crea un nuevo cliente
2. Ve a Ventas → Cobrar
3. **Lista debe mostrar el nuevo cliente INMEDIATAMENTE**

✅ **Esperado**: Cliente aparece sin refresh

---

### Test 4: Órdenes en Tiempo Real

1. Abre app en 2 navegadores
2. Browser 1: Crea una orden
3. Browser 2: Ve a Historial
4. **Orden debe aparecer INSTANTÁNEAMENTE**

✅ **Esperado**: Orden sincronizada < 1 segundo

---

## 🔍 Verificar Database

```bash
railway run psql $DATABASE_URL
```

Dentro de psql:

```sql
-- Verificar tabla idempotency
SELECT COUNT(*) FROM idempotency_keys;

-- Verificar stored procedure
\df create_order_atomic

-- Verificar índices
\di idx_orders_created_at
\di idx_idempotency_expires

-- Salir
\q
```

---

## 📊 Railway Dashboard

Abre: https://railway.app/project/[tu-project-id]

**Verifica:**
- ✅ Service: POS.CLAUDE está "Active"
- ✅ Latest deployment: "Success"
- ✅ Logs: No errores críticos
- ✅ Metrics: CPU/Memory normales

---

## 🚨 Si hay problemas

### Error: "WebSocket not connecting"

**Check logs:**
```bash
railway logs | grep WS
railway logs | grep error
```

**Common fix:**
- Verifica que el service worker no esté cacheando conexiones viejas
- Abre en modo incognito
- Clear cache del navegador

---

### Error: "Migration failed"

**Rollback migration:**
```bash
railway run psql $DATABASE_URL

# Dentro de psql:
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP FUNCTION IF EXISTS create_order_atomic CASCADE;
\q

# Re-ejecuta migraciones
```

---

### Error: "Clientes no aparecen"

**Verifica WebSocket:**
1. DevTools → Console
2. Busca: `[AppContext] Received customers create update`
3. Si no aparece, verifica que el broadcast esté funcionando

**Check logs:**
```bash
railway logs | grep "broadcast"
railway logs | grep "customers"
```

---

### Error: "Caja no sincroniza"

**Verifica:**
```bash
railway logs | grep "cash:update"
railway logs | grep "[WS] Broadcast cash"
```

**Si no hay broadcasts:**
- El código no se deployó correctamente
- Re-deploy: `railway up --detach`

---

## 📈 Métricas de Éxito

Después de 1 hora de uso:

| Métrica | Target | Cómo verificar |
|---------|--------|----------------|
| Sincronización | <50ms | DevTools timestamps en console |
| WebSocket uptime | >99% | Logs: disconnects < 1/hora |
| Duplicados prevenidos | 100% | Check `idempotency_keys` table |
| Clientes visibles | 100% | Test manual en 2 dispositivos |
| Caja sincronizada | 100% | Test manual en 2 dispositivos |

---

## 🎯 Comandos Quick Reference

```bash
# Ver status
railway status

# Ver logs en tiempo real
railway logs --follow

# Ver variables de entorno
railway variables

# Restart service (si necesario)
railway restart

# Conectar a database
railway run psql $DATABASE_URL

# Re-deploy
railway up --detach
```

---

## ✅ Deployment Checklist

**Pre-deployment:**
- [x] Código committed y pushed a GitHub
- [x] Railway project linked
- [ ] Railway service linked (POS.CLAUDE)

**Durante deployment:**
- [ ] Migración 1 ejecutada
- [ ] Migración 2 ejecutada
- [ ] Migración 3 ejecutada
- [ ] Migraciones verificadas
- [ ] Application deployed
- [ ] Logs monitoreados

**Post-deployment:**
- [ ] WebSocket conectando
- [ ] Caja sincroniza instantáneamente
- [ ] Clientes aparecen en lista
- [ ] Órdenes sincronizadas
- [ ] Sin errores en logs
- [ ] 4 tests manuales pasados

---

## 🎉 Success!

Si todos los tests pasan:
- ✅ WebSocket funcionando
- ✅ Sincronización universal implementada
- ✅ Caja sincroniza instantáneamente
- ✅ Clientes aparecen sin delays
- ✅ Órdenes y productos en tiempo real

**Tu POS ahora tiene sincronización sub-segundo entre TODAS las sesiones PWA! 🚀**

---

**Deployment Date**: _______________
**Deployed By**: je2alvarela@gmail.com
**Result**: ⬜ Success / ⬜ Partial / ⬜ Rolled Back
**Notes**: _______________
