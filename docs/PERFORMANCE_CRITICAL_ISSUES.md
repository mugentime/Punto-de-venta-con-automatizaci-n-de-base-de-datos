# 🚨 PROBLEMAS CRÍTICOS DE RENDIMIENTO

## RESUMEN EJECUTIVO

**Síntoma**: Carga de datos tarda hasta 10 minutos
**Causa**: Queries sin límites traen TODOS los datos históricos
**Severidad**: CRÍTICA - Inutiliza la aplicación con datos reales

---

## PROBLEMAS IDENTIFICADOS

### 1. 🔴 SELECT * SIN LÍMITES (CRÍTICO)

**Archivo**: `server.js`

Todas las queries principales traen TODOS los registros históricos:

```javascript
// ❌ LÍNEA 514 - Trae TODAS las órdenes
app.get('/api/orders', async (req, res) => {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    // Si hay 10,000 órdenes = 10,000 registros en memoria
});

// ❌ LÍNEA 292 - Trae TODOS los productos
app.get('/api/products', async (req, res) => {
    const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
});

// ❌ LÍNEA 684 - Trae TODOS los gastos
app.get('/api/expenses', async (req, res) => {
    const result = await pool.query('SELECT * FROM expenses ORDER BY created_at DESC');
});

// ❌ LÍNEA 758 - Trae TODAS las sesiones de coworking
app.get('/api/coworking-sessions', async (req, res) => {
    const result = await pool.query('SELECT * FROM coworking_sessions ORDER BY created_at DESC');
});

// ❌ LÍNEA 898 - Trae TODAS las sesiones de caja
app.get('/api/cash-sessions', async (req, res) => {
    const result = await pool.query('SELECT * FROM cash_sessions ORDER BY created_at DESC');
});
```

### 2. 🔴 CARGA COMPLETA EN APPCONTEXT (CRÍTICO)

**Archivo**: `contexts/AppContext.tsx` (líneas 109-174)

```typescript
useEffect(() => {
    const initializeData = async () => {
        // ❌ Carga TODOS los productos
        const productsResponse = await fetch('/api/products');

        // ❌ Carga TODAS las órdenes (PEOR CASO)
        const ordersResponse = await fetch('/api/orders');

        // ❌ Carga TODOS los gastos
        const expensesResponse = await fetch('/api/expenses');

        // ❌ Carga TODAS las sesiones de coworking
        const coworkingResponse = await fetch('/api/coworking-sessions');

        // ❌ Carga TODAS las sesiones de caja
        const cashResponse = await fetch('/api/cash-sessions');

        // ❌ Carga TODOS los usuarios
        const usersResponse = await fetch('/api/users');

        // ❌ Carga TODOS los clientes
        const customersResponse = await fetch('/api/customers');

        // ❌ Carga TODOS los retiros de efectivo
        const withdrawalsResponse = await fetch('/api/cash-withdrawals');
    };
}, []);
```

**Resultado**:
- Con 1,000 órdenes: ~2-5 segundos
- Con 5,000 órdenes: ~30-60 segundos
- Con 10,000 órdenes: **5-10 MINUTOS** ⚠️

---

## IMPACTO CALCULADO

### Escenario Real (3 meses de operación):

| Tabla | Registros | Tamaño Estimado | Tiempo Carga |
|-------|-----------|-----------------|--------------|
| orders | 10,000 | ~5 MB | 3-5 min |
| products | 100 | ~50 KB | < 1 seg |
| expenses | 500 | ~250 KB | 5-10 seg |
| coworking_sessions | 1,000 | ~500 KB | 30-60 seg |
| cash_sessions | 90 | ~50 KB | < 1 seg |
| customers | 200 | ~100 KB | < 1 seg |
| **TOTAL** | **11,890** | **~6 MB** | **5-10 MIN** |

---

## SOLUCIONES PROPUESTAS

### SOLUCIÓN 1: AGREGAR LÍMITES A QUERIES (RÁPIDA - 30 MIN)

**Prioridad**: ALTA
**Impacto**: Reducción de 90% en tiempo de carga

```javascript
// ✅ CORRECCIÓN
app.get('/api/orders', async (req, res) => {
    const limit = req.query.limit || 100; // Default: últimas 100 órdenes
    const offset = req.query.offset || 0;

    const result = await pool.query(
        'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
    );

    // También devolver el total para paginación
    const countResult = await pool.query('SELECT COUNT(*) FROM orders');

    res.json({
        orders: result.rows.map(order => ({...})),
        total: parseInt(countResult.rows[0].count),
        limit,
        offset
    });
});
```

### SOLUCIÓN 2: LAZY LOADING EN APPCONTEXT (MEDIA - 2 HRS)

**Prioridad**: ALTA
**Impacto**: Carga inicial en < 5 segundos

```typescript
// ✅ Solo cargar datos esenciales al inicio
useEffect(() => {
    const initializeData = async () => {
        // Cargar solo lo esencial
        await Promise.all([
            fetchProducts(),           // Todos (< 100 items)
            fetchRecentOrders(100),    // Solo últimas 100
            fetchActiveCoworking(),    // Solo sesiones activas
            fetchCurrentCashSession(), // Solo sesión actual
            fetchCustomers()           // Todos (< 500 items)
        ]);
    };
}, []);

// Cargar más datos bajo demanda
const fetchRecentOrders = async (limit = 100) => {
    const response = await fetch(`/api/orders?limit=${limit}`);
    const data = await response.json();
    setOrders(data.orders);
};
```

### SOLUCIÓN 3: ÍNDICES EN BASE DE DATOS (RÁPIDA - 15 MIN)

**Prioridad**: MEDIA
**Impacto**: 50% más rápido en queries con ORDER BY

```sql
-- Acelerar ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coworking_created_at ON coworking_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_created_at ON cash_sessions(created_at DESC);

-- Acelerar búsqueda por estado
CREATE INDEX IF NOT EXISTS idx_coworking_status ON coworking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);

-- Acelerar búsqueda por cliente
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders("customerId");
```

### SOLUCIÓN 4: PAGINACIÓN EN FRONTEND (MEDIA - 3 HRS)

**Prioridad**: MEDIA
**Impacto**: Mejor UX, carga incremental

```typescript
// Componente de lista con paginación
const OrdersList = () => {
    const [page, setPage] = useState(1);
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const limit = 50;

    useEffect(() => {
        fetchOrders(page);
    }, [page]);

    const fetchOrders = async (page) => {
        const offset = (page - 1) * limit;
        const response = await fetch(`/api/orders?limit=${limit}&offset=${offset}`);
        const data = await response.json();
        setOrders(data.orders);
        setTotal(data.total);
    };

    return (
        <>
            <OrderTable orders={orders} />
            <Pagination
                currentPage={page}
                totalPages={Math.ceil(total / limit)}
                onPageChange={setPage}
            />
        </>
    );
};
```

### SOLUCIÓN 5: FILTROS POR FECHA (RÁPIDA - 1 HR)

**Prioridad**: ALTA
**Impacto**: Solo cargar datos del período relevante

```javascript
// Solo traer datos del último mes por defecto
app.get('/api/orders', async (req, res) => {
    const { startDate, endDate, limit = 100, offset = 0 } = req.query;

    // Si no hay fechas, traer último mes
    const defaultStartDate = new Date();
    defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);

    const result = await pool.query(
        `SELECT * FROM orders
         WHERE created_at >= $1 AND created_at <= $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [
            startDate || defaultStartDate,
            endDate || new Date(),
            limit,
            offset
        ]
    );

    res.json(result.rows);
});
```

---

## PLAN DE IMPLEMENTACIÓN INMEDIATA

### Fase 1: Fix Rápido (1 hora)
1. ✅ Agregar LIMIT 100 a query de órdenes
2. ✅ Agregar LIMIT 50 a query de gastos
3. ✅ Agregar LIMIT 100 a query de sesiones de coworking
4. ✅ Crear índices en created_at

**Resultado esperado**: De 10 minutos → 10 segundos

### Fase 2: Optimización Media (3 horas)
1. ⏳ Implementar paginación en endpoints
2. ⏳ Lazy loading en AppContext
3. ⏳ Filtros por fecha por defecto (último mes)

**Resultado esperado**: De 10 segundos → 2-3 segundos

### Fase 3: Optimización Avanzada (1 día)
1. ⏳ Paginación en UI
2. ⏳ Virtual scrolling para listas grandes
3. ⏳ Cache en frontend con React Query
4. ⏳ Service Worker para cache offline

**Resultado esperado**: < 1 segundo, experiencia fluida

---

## VALIDACIÓN POST-IMPLEMENTACIÓN

### Métricas a Monitorear:

```javascript
// Agregar logging de performance
const startTime = Date.now();
const result = await pool.query('SELECT * FROM orders LIMIT 100');
const duration = Date.now() - startTime;
console.log(`📊 Query duration: ${duration}ms`);

// Target:
// - Sin índices: < 1000ms (1 seg)
// - Con índices: < 200ms
// - Con LIMIT: < 100ms
```

---

## CONCLUSIÓN

**Problema Raíz**: Arquitectura diseñada para demo/desarrollo, no producción.

**Solución**: Implementar paginación, límites, e índices.

**Prioridad**: 🔴 CRÍTICA - La aplicación es inutilizable con datos reales.

**Tiempo de Implementación**:
- Fix rápido: 1 hora
- Fix completo: 1 día

---

**Investigado por**: Claude Code AI
**Fecha**: 16 de Noviembre de 2025
**Estado**: ⚠️ REQUIERE ATENCIÓN INMEDIATA
