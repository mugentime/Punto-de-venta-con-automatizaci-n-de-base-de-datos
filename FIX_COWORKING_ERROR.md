# Fix para Error de Coworking - Tabla idempotency_keys

## 🐛 Problema
```
Error al guardar la orden de coworking: 400 - {"error":"column \"order_id\" of relation \"idempotency_keys\" does not exist"}
```

## 🔍 Causa
La tabla `idempotency_keys` existe en la base de datos pero le falta la columna `order_id` que es requerida por el procedimiento almacenado `create_order_atomic`.

## ✅ Solución

### Opción 1: Ejecutar el script de migración (Recomendado)

1. Asegúrate de tener Railway CLI instalado y estar logueado
2. Linkea tu proyecto (si no lo has hecho):
   ```bash
   railway link
   # Selecciona: POS.CLAUDE
   ```

3. Ejecuta el script de migración:
   ```bash
   railway run node scripts/fix-idempotency-keys-table.js
   ```

### Opción 2: Ejecutar SQL manualmente

Si prefieres ejecutar el SQL directamente:

1. Conéctate a la base de datos:
   ```bash
   railway run psql $DATABASE_URL
   ```

2. Ejecuta el SQL desde el archivo:
   ```bash
   railway run psql $DATABASE_URL -f database/migrations/004_fix_idempotency_keys_schema.sql
   ```

### Opción 3: Desde Railway Dashboard

1. Ve a tu proyecto en Railway Dashboard
2. Abre la base de datos PostgreSQL
3. Ve a la pestaña "Query"
4. Copia y pega este SQL:

```sql
-- Migration: Fix idempotency_keys table schema
BEGIN;

-- Drop existing table if it has incorrect schema
DROP TABLE IF EXISTS idempotency_keys CASCADE;

-- Recreate table with correct schema
CREATE TABLE idempotency_keys (
  key VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50) NOT NULL DEFAULT 'order',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  response_data JSONB
);

-- Index for efficient expiration cleanup
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);

-- Index for querying by resource type and creation date
CREATE INDEX idx_idempotency_resource ON idempotency_keys(resource_type, created_at);

-- Index for querying by order_id
CREATE INDEX idx_idempotency_order ON idempotency_keys(order_id);

COMMIT;
```

5. Ejecuta el query

## 🧪 Verificación

Después de ejecutar la migración, verifica que la tabla tiene la estructura correcta:

```bash
railway run psql $DATABASE_URL -c "\d idempotency_keys"
```

Deberías ver una salida similar a:
```
                                    Table "public.idempotency_keys"
    Column     |           Type           | Nullable |               Default
---------------+--------------------------+----------+--------------------------------------
 key           | character varying(255)   | not null |
 order_id      | character varying(255)   | not null |
 resource_type | character varying(50)    | not null | 'order'::character varying
 created_at    | timestamp with time zone | not null | CURRENT_TIMESTAMP
 expires_at    | timestamp with time zone | not null | (CURRENT_TIMESTAMP + '24:00:00'::interval)
 response_data | jsonb                    |          |
```

## 📝 Archivos Relacionados

- **Script de migración**: `scripts/fix-idempotency-keys-table.js`
- **SQL de migración**: `database/migrations/004_fix_idempotency_keys_schema.sql`
- **Procedimiento afectado**: `database/procedures/create_order_atomic.sql` (líneas 86-99)

## 🎯 Resultado Esperado

Después de aplicar la migración:
- ✅ La tabla `idempotency_keys` tendrá la columna `order_id`
- ✅ Los pedidos de coworking se guardarán correctamente
- ✅ El sistema de prevención de duplicados funcionará
- ✅ No habrá más errores de "column does not exist"

## 🚨 Nota Importante

Esta migración usa `DROP TABLE IF EXISTS` lo que eliminará cualquier dato existente en la tabla `idempotency_keys`. Esto es seguro porque:
- Las llaves de idempotencia solo duran 24 horas
- Se usan únicamente para prevenir duplicados durante el procesamiento
- No afectan órdenes ya guardadas en la tabla `orders`

Si prefieres no perder los datos (aunque son temporales), puedes modificar el script para usar `ALTER TABLE` en lugar de `DROP TABLE`.
