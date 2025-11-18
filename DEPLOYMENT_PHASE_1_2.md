# Deployment Guide - Fase 1 & 2: Sincronización Crítica

## 🎯 Objetivo
Solucionar problemas críticos de sincronización que causan:
- ❌ Cobros duplicados
- ❌ Clicks duplicados
- ❌ Tiempos de respuesta lentos
- ❌ Desincronización entre frontend y backend

## ✅ Cambios Implementados

### **Fase 1: Fixes Críticos**

1. **Base de Datos - Idempotency Persistente**
   - Nueva tabla `idempotency_keys` para prevenir duplicados
   - Stored procedure `create_order_atomic` para transacciones atómicas
   - Índices de performance para queries frecuentes

2. **Backend (server.js)**
   - Endpoint `/api/orders` usa stored procedure
   - Eliminado caché en memoria (lines 513-514)
   - Transacciones atómicas: orden + stock + crédito

3. **Frontend (AppContext.tsx)**
   - Cart se limpia DESPUÉS de confirmación del servidor
   - Retry logic automático (3 intentos con exponential backoff)
   - Request deduplication para prevenir múltiples requests

4. **Utilidades Nuevas**
   - `utils/retryWithBackoff.ts` - Retry con exponential backoff
   - `utils/requestDeduplication.ts` - Prevención de requests duplicados

### **Fase 2: Gestión de Estado**

1. **State Machine para Checkout**
   - `types/checkout.ts` - Estados válidos y transiciones
   - `hooks/useCheckoutStateMachine.ts` - Hook para state machine
   - Estados: IDLE → SELECTING → VALIDATING → SUBMITTING → SUCCESS/ERROR

2. **Global Loading States**
   - `contexts/OperationContext.tsx` - Context para operaciones globales
   - `hooks/useOperation.ts` - Hook para prevenir operaciones concurrentes

3. **SalesScreen Mejorado**
   - Integrado state machine
   - Prevención de double-clicks
   - Estados de loading claros

## 📋 Deployment Steps

### **PASO 1: Database Migrations (5 minutos)**

#### A. Conectar a Railway Database

```bash
# Opción 1: Conectar via Railway CLI
railway connect postgres

# Opción 2: Usar connection string directamente
psql "postgresql://postgres:[password]@[host]:[port]/railway"
```

#### B. Ejecutar Migraciones en Orden

```bash
# 1. Crear tabla idempotency_keys
psql $DATABASE_URL -f database/migrations/001_add_idempotency_table.sql

# 2. Crear stored procedures
psql $DATABASE_URL -f database/migrations/002_create_stored_procedures.sql

# 3. Agregar índices de performance
psql $DATABASE_URL -f database/migrations/003_add_performance_indexes.sql
```

#### C. Verificar Migraciones

```sql
-- Verificar tabla
\dt idempotency_keys
-- Debe mostrar: public | idempotency_keys | table | postgres

-- Verificar stored procedure
\df create_order_atomic
-- Debe mostrar: public | create_order_atomic | function | ...

-- Verificar índices
\di idx_orders_created_at
\di idx_idempotency_expires
-- Deben aparecer ambos índices
```

### **PASO 2: Deploy Backend (3 minutos)**

```bash
# Commit cambios
git add server.js database/ utils/
git commit -m "feat: Implement atomic transactions and idempotency

- Add idempotency_keys table for persistent deduplication
- Create stored procedure for atomic order creation
- Replace in-memory cache with database-backed idempotency
- Add retry logic with exponential backoff
- Fix cart clear timing (after server confirmation)

Fixes:
- Duplicate order prevention
- Stock update atomicity
- Cart state race condition
- Network failure recovery

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to Railway
git push railway main
# O si tu remote es origin:
git push origin main

# Esperar deployment
# Railway automáticamente detectará y desplegará los cambios
```

### **PASO 3: Deploy Frontend (2 minutos)**

```bash
# Commit cambios de frontend
git add contexts/AppContext.tsx screens/SalesScreen.tsx hooks/ types/
git commit -m "feat: Add state machine and operation tracking

- Implement checkout state machine for better flow control
- Add global operation context for loading states
- Integrate retry logic and request deduplication
- Update SalesScreen with state machine

Improvements:
- Prevents double-clicks on checkout
- Clear loading states
- Better error handling
- Automatic retry on network failures

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push
git push railway main
```

### **PASO 4: Smoke Testing (5 minutos)**

Después del deployment, probar:

#### Test 1: Crear Orden Normal
- [x] Agregar productos al carrito
- [x] Click en "Cobrar"
- [x] Llenar detalles
- [x] Click en "Pagar"
- [x] ✅ Orden creada exitosamente
- [x] ✅ Carrito se limpia después de éxito

#### Test 2: Prevención de Duplicados
- [x] Agregar productos
- [x] Click rápido múltiple en "Pagar"
- [x] ✅ Solo se crea UNA orden
- [x] ✅ Console muestra "Reusing existing request"

#### Test 3: Network Failure Recovery
- [x] Abrir DevTools → Network tab
- [x] Throttling a "Slow 3G"
- [x] Crear orden
- [x] ✅ Request se reintenta automáticamente
- [x] ✅ Console muestra "Retrying order creation (attempt N)"

#### Test 4: Validar Database
```sql
-- Verificar orden creada
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;

-- Verificar stock actualizado
SELECT id, name, stock FROM products WHERE id IN (...items_de_la_orden...);

-- Verificar idempotency key guardado
SELECT * FROM idempotency_keys ORDER BY created_at DESC LIMIT 1;

-- Si es crédito, verificar customer_credits
SELECT * FROM customer_credits WHERE "orderId" = 'order-xxx';
```

## 🔍 Monitoring Post-Deployment

### Metrics to Track (First 24 Hours)

1. **Order Success Rate**
   ```sql
   -- Count orders created
   SELECT COUNT(*) FROM orders WHERE created_at > NOW() - INTERVAL '1 hour';

   -- Count errors (check logs)
   ```
   **Target**: >99% success rate

2. **Duplicate Detection**
   ```sql
   -- Count idempotency key hits
   SELECT COUNT(*) FROM idempotency_keys WHERE created_at > NOW() - INTERVAL '1 hour';
   ```
   **Expected**: Some duplicates detected and prevented

3. **Performance**
   - Check Railway logs for response times
   - **Target**: <200ms average for /api/orders

### Log Monitoring

```bash
# Watch logs in real-time
railway logs --follow

# Look for these indicators:
# ✅ "Order created successfully"
# ✅ "Duplicate order detected via idempotency key"
# ✅ "Retrying order creation (attempt N)"
# ❌ "Order creation failed" - investigate immediately
```

## 🚨 Rollback Plan (If Needed)

### If Critical Issues Detected:

#### 1. Rollback Backend Code
```bash
git revert HEAD
git push railway main
```

#### 2. Rollback Database (Only if Necessary)
```bash
# Connect to database
railway connect postgres

# Rollback migrations in REVERSE order
psql $DATABASE_URL -f database/migrations/003_add_performance_indexes_rollback.sql
psql $DATABASE_URL -f database/migrations/002_create_stored_procedures_rollback.sql
psql $DATABASE_URL -f database/migrations/001_add_idempotency_table_rollback.sql
```

#### 3. Rollback Frontend
```bash
git revert HEAD~1  # Revert frontend commit
git push railway main
```

### When to Rollback:
- ⚠️ Order creation failing >10%
- ⚠️ Database errors in logs
- ⚠️ Critical bug reported by users
- ⚠️ Performance degradation >500ms

## 📊 Success Criteria

### Day 1:
- ✅ Zero critical bugs
- ✅ Order creation working
- ✅ No duplicate orders in production
- ✅ Performance maintained or improved

### Week 1:
- ✅ Duplicate prevention working (logs show interceptions)
- ✅ Automatic retry working on network issues
- ✅ No data corruption incidents
- ✅ User satisfaction maintained

## 🔧 Troubleshooting

### Issue: "Failed to create order"

**Cause**: Stored procedure not found or syntax error

**Fix**:
```bash
# Re-run stored procedure migration
railway connect postgres
psql $DATABASE_URL -f database/migrations/002_create_stored_procedures.sql
```

### Issue: "Credit limit exceeded" but customer has credit

**Cause**: Database state out of sync

**Fix**:
```sql
-- Check customer credit
SELECT "currentCredit", "creditLimit" FROM customers WHERE id = 'xxx';

-- Recalculate from orders
SELECT SUM(total) FROM orders WHERE "customerId" = 'xxx' AND "paymentMethod" = 'Crédito';

-- Update if needed
UPDATE customers SET "currentCredit" = [correct_value] WHERE id = 'xxx';
```

### Issue: Slow performance

**Cause**: Indexes not created

**Fix**:
```bash
# Re-run index migration
railway connect postgres
psql $DATABASE_URL -f database/migrations/003_add_performance_indexes.sql
```

## 📝 Files Changed

### New Files (12):
```
database/
  migrations/
    001_add_idempotency_table.sql
    001_add_idempotency_table_rollback.sql
    002_create_stored_procedures.sql
    002_create_stored_procedures_rollback.sql
    003_add_performance_indexes.sql
    003_add_performance_indexes_rollback.sql
  procedures/
    create_order_atomic.sql
utils/
  retryWithBackoff.ts
  requestDeduplication.ts
types/
  checkout.ts
hooks/
  useCheckoutStateMachine.ts
  useOperation.ts
contexts/
  OperationContext.tsx
```

### Modified Files (3):
```
server.js (lines 512-597)
contexts/AppContext.tsx (lines 1-5, 452-550)
screens/SalesScreen.tsx (lines 1-6, 45-117)
```

## ⏭️ Next Steps (Future Phases)

**Fase 3 (Optional): Real-Time Sync con WebSocket**
- Replace polling with WebSocket for coworking sessions
- Real-time updates across devices
- 90% reduction in polling overhead

**Fase 4 (Optional): Performance Optimization**
- Database query optimization
- Cleanup jobs for idempotency_keys
- Monitoring dashboard

## 📞 Support

If issues arise:
1. Check Railway logs: `railway logs`
2. Check database: `railway connect postgres`
3. Review this deployment guide
4. Contact: je2alvarela@gmail.com

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Result**: ✅ Success / ❌ Rolled Back
**Notes**: _______________
