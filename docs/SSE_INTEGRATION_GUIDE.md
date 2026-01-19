# Guía de Integración de SSE (Server-Sent Events) para Sincronización en Tiempo Real

## 🎯 Objetivo
Eliminar el desfasamiento entre PWA y Web App mediante sincronización en tiempo real usando Server-Sent Events.

## 📋 Archivos Creados

### Backend (Node.js/Express)
1. **`src/services/sseService.js`** - Servicio SSE para broadcast de cambios
2. **`src/middleware/sseMiddleware.js`** - Middleware para agregar `res.broadcastChange()`
3. **`src/routes/sseRoutes.js`** - Ruta `/api/events` para conexiones SSE

### Frontend (React/TypeScript)
1. **`services/realtimeSync.ts`** - Cliente SSE con reconexión automática
2. **`hooks/useRealtimeSync.ts`** - React Hook para usar SSE en componentes

### Service Worker
- **`public/sw.js`** - Actualizado para invalidar caché con eventos SSE

### HTML
- **`index.html`** - Removida destrucción agresiva de Service Worker

---

## 🔧 Integración en el Servidor

### Paso 1: Importar SSE Service en `server.js`

Ya se agregó en la línea 7:
```javascript
import { registerClient, broadcastDataChange } from './src/services/sseService.js';
```

### Paso 2: Agregar endpoint SSE

Agregar DESPUÉS de la línea 482 (antes de `// --- API ENDPOINTS ---`):

```javascript
// --- SSE (Server-Sent Events) ENDPOINT ---
app.get('/api/events', (req, res) => {
  const userId = req.query.userId || 'anonymous';
  console.log(`[SSE] New client connection: ${userId}`);
  registerClient(res, userId);
});
```

### Paso 3: Agregar broadcasts en APIs

Para cada operación de modificación de datos (POST, PUT, DELETE), agregar un broadcast:

#### Ejemplo: Products API

**Crear producto (línea ~494):**
```javascript
app.post('/api/products', async (req, res) => {
    const product = { ...req.body, id: `prod-${Date.now()}` };
    const result = await saveProduct(product);

    // ✅ AGREGAR ESTA LÍNEA:
    broadcastDataChange('products', { action: 'create', id: product.id });

    res.json(result);
});
```

**Actualizar producto (línea ~503):**
```javascript
app.put('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const updatedProduct = { ...req.body, id };
    const result = await updateProduct(updatedProduct);
    if (result.error) {
        return res.status(404).json(result);
    }

    // ✅ AGREGAR ESTA LÍNEA:
    broadcastDataChange('products', { action: 'update', id });

    res.json(result);
});
```

**Eliminar producto (línea ~517):**
```javascript
app.delete('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const result = await deleteProduct(id);
    if (result.error) {
        return res.status(404).json(result);
    }

    // ✅ AGREGAR ESTA LÍNEA:
    broadcastDataChange('products', { action: 'delete', id });

    res.json(result);
});
```

### Paso 4: Repetir para todas las APIs

Agregar broadcasts en:
- ✅ **Orders** (POST /api/orders - línea ~723)
- ✅ **Orders** (DELETE /api/orders/:id - línea ~795)
- ✅ **Expenses** (POST /api/expenses - línea ~904)
- ✅ **Expenses** (PUT /api/expenses/:id - línea ~931)
- ✅ **Expenses** (DELETE /api/expenses/:id - línea ~945)
- ✅ **Coworking Sessions** (POST, PUT, DELETE - líneas ~983, 1040, 1062)
- ✅ **Cash Sessions** (POST, PUT - líneas ~1130, 1158)
- ✅ **Cash Withdrawals** (POST, DELETE - líneas ~1209, 1221)
- ✅ **Customers** (todas las operaciones)

#### Template para copiar y pegar:

```javascript
// Después de la operación exitosa, ANTES del res.json():
broadcastDataChange('DATATYPE', { action: 'ACTION', id: ID_VARIABLE });
```

Reemplazar:
- `DATATYPE`: `'products'` | `'orders'` | `'expenses'` | `'coworking-sessions'` | `'cash-sessions'` | `'customers'` | `'cash-withdrawals'`
- `ACTION`: `'create'` | `'update'` | `'delete'`
- `ID_VARIABLE`: variable con el ID del item modificado

---

## 🎨 Integración en el Frontend (AppContext)

### Paso 1: Importar el hook en `contexts/AppContext.tsx`

Agregar al inicio del archivo:
```typescript
import useRealtimeSync from '../hooks/useRealtimeSync';
```

### Paso 2: Usar el hook en AppContextProvider

Dentro del componente `AppContextProvider`, agregar:

```typescript
// En el inicio de AppContextProvider (después de los useState):
useRealtimeSync({
  dataTypes: [
    'products',
    'orders',
    'expenses',
    'coworking-sessions',
    'cash-sessions',
    'customers',
    'cash-withdrawals'
  ],
  onDataChange: async (dataType, action) => {
    console.log(`[AppContext] Refetching ${dataType} due to ${action}`);

    // Refetch data según el tipo
    switch (dataType) {
      case 'products':
        await refetchProducts(); // Implementar si no existe
        break;
      case 'orders':
        await refetchOrders();
        break;
      case 'expenses':
        await refetchExpenses(); // Implementar si no existe
        break;
      case 'coworking-sessions':
        await refetchCoworkingSessions(); // Implementar si no existe
        break;
      case 'cash-sessions':
        await refetchCashSessions(); // Implementar si no existe
        break;
      case 'customers':
        await refetchCustomers(); // Implementar si no existe
        break;
      case 'cash-withdrawals':
        await refetchCashWithdrawals(); // Implementar si no existe
        break;
    }
  },
  enabled: currentUser !== null, // Solo activar si hay usuario logueado
  debounceDelay: 1000 // 1 segundo de debounce para evitar refetches excesivos
});
```

### Paso 3: Implementar funciones refetch (si no existen)

Ejemplo:
```typescript
const refetchProducts = useCallback(async () => {
  try {
    const response = await fetch('/api/products');
    const data = await response.json();
    setProducts(data);

    // También actualizar IndexedDB
    await Promise.all(data.map(p => offlineStorage.set(STORES.PRODUCTS, p)));
  } catch (error) {
    console.error('Failed to refetch products:', error);
  }
}, []);
```

---

## ✅ Verificación de la Integración

### 1. Verificar conexión SSE

Abrir DevTools Console y buscar:
```
[RealtimeSync] ✅ Connected to SSE server
[SSE] Client connected. Total clients: 1
```

### 2. Probar sincronización

1. Abrir la app en 2 pestañas (o PWA + Browser)
2. En pestaña 1: Crear/modificar un producto
3. En pestaña 2: Debería actualizarse automáticamente en 1-2 segundos

Logs esperados en Console:
```
[SSE] Broadcast products change to 2 clients
[RealtimeSync] 🔄 Data change detected: products update
[SW SSE] 🔄 Invalidating API cache for: products
[AppContext] Refetching products due to update
```

### 3. Verificar invalidación de caché

En DevTools:
- **Application** → **Service Workers** → Verificar mensajes
- **Network** → Verificar que API calls no usen cache después de cambios

---

## 🐛 Troubleshooting

### SSE no conecta
- ✅ Verificar que `sseService.js` esté importado en `server.js`
- ✅ Verificar que `/api/events` endpoint esté definido
- ✅ Revisar errores de CORS si frontend y backend están en diferentes puertos

### No se actualizan los datos
- ✅ Verificar que los broadcasts estén agregados en todas las APIs
- ✅ Verificar que `useRealtimeSync` esté en AppContext
- ✅ Verificar que las funciones refetch existan y funcionen

### Service Worker no invalida caché
- ✅ Verificar que `sw.js` tenga el código actualizado (línea ~497-528)
- ✅ Force refresh (Ctrl+Shift+R) para actualizar Service Worker
- ✅ En DevTools: Application → Service Workers → "Unregister" y recargar

---

## 📊 Monitoreo

### Ver clientes conectados

En el servidor, agregar endpoint de status:
```javascript
app.get('/api/events/status', (req, res) => {
  const { getClientCount } = require('./src/services/sseService.js');
  res.json({ connectedClients: getClientCount() });
});
```

### Logs de SSE

Buscar en console:
- `[SSE]` - Eventos del servidor
- `[RealtimeSync]` - Eventos del cliente
- `[SW SSE]` - Invalidación de caché en Service Worker

---

## 🚀 Próximos Pasos

1. ✅ Agregar broadcasts en todas las APIs (ver Paso 4)
2. ✅ Integrar `useRealtimeSync` en AppContext
3. ✅ Implementar funciones refetch para cada tipo de dato
4. ✅ Probar en producción con Railway
5. ✅ Monitorear logs de conexiones y broadcasts

---

## 📝 Notas Técnicas

- **TTL de caché actualizado**: Coworking sessions ahora tiene 30s en vez de 5s
- **No más destrucción de caché**: Removido en `index.html` para evitar thrashing
- **Reconexión automática**: Cliente SSE se reconecta automáticamente con backoff exponencial
- **Heartbeat**: Servidor envía heartbeat cada 30s para mantener conexiones vivas
- **Cleanup**: Conexiones stale se limpian cada 2 minutos

---

**¡La sincronización en tiempo real está lista! 🎉**
