# PWA Sync Fix - Sesiones de Coworking

## 🔍 Problema Resuelto

**Síntoma**: Las sesiones de coworking se cargan inmediatamente en PC pero no aparecen en la versión PWA móvil.

**Causa raíz**: El sistema de sincronización en tiempo real (SSE) estaba implementado pero nunca se activó en la aplicación. Además, el Service Worker tenía un cache demasiado agresivo (60 segundos).

## ✅ Solución Implementada

### 1. Sincronización en Tiempo Real Activada (SSE)

**Antes**: SSE implementado pero no usado → Sin sync automático
**Ahora**: SSE activo → Sync automático cada vez que cambian los datos

**Cómo funciona**:
- Establece conexión persistente con el servidor
- Cuando cambias datos en PC, el servidor envía evento SSE
- PWA móvil recibe el evento y refresca automáticamente
- Cache del Service Worker se invalida automáticamente

### 2. Cache Reducido en Service Worker

**Antes**:
- Coworking sessions: 60 segundos de cache
- Orders: 60 segundos de cache

**Ahora**:
- Coworking sessions: 15 segundos de cache (4x más rápido)
- Orders: 30 segundos de cache (2x más rápido)

### 3. Refresh Forzado al Abrir Coworking

Cada vez que abres la pantalla de coworking en PWA, se hace un refresh automático para garantizar datos frescos.

## 📱 Cómo Verificar que Funciona

### Prueba 1: Sync en Tiempo Real (Cross-Device)

1. **PC**: Abre la app en navegador de escritorio
2. **Móvil**: Abre la app PWA en tu celular
3. **PC**: Crea una nueva sesión de coworking
4. **Móvil**: Observa que la sesión aparece en 1-2 segundos SIN refrescar

✅ **Si aparece automáticamente**: SSE funciona perfectamente
❌ **Si no aparece**: Ve a "Solución de Problemas" abajo

### Prueba 2: Refresh Manual

1. **Móvil**: Abre la app PWA
2. **Móvil**: Navega a otra pantalla (Ventas, Inventario, etc.)
3. **Móvil**: Regresa a Coworking
4. **Resultado esperado**: Datos se refrescan automáticamente

### Prueba 3: Cache Timeout

1. **Móvil**: Abre Coworking, nota las sesiones actuales
2. **PC**: Crea una nueva sesión
3. **Móvil**: NO hagas nada, solo espera 15-20 segundos
4. **Móvil**: Refresca la página (pull-to-refresh)
5. **Resultado esperado**: Nueva sesión aparece

## 🔧 Solución de Problemas

### Problema: SSE No Conecta (Símbolo de desconexión)

**Diagnóstico**: Abrir DevTools en móvil:
1. Chrome móvil → ⋮ → Herramientas de Desarrollo
2. Console tab
3. Buscar mensajes `[RealtimeSync]`

**Mensajes esperados**:
```
[RealtimeSync] Connecting to SSE server...
[RealtimeSync] ✅ Connected to SSE server
[RealtimeSync] Server acknowledged connection
```

**Si dice "Connection error"**:
- Verifica que tengas conexión a internet
- Verifica que el servidor Railway esté corriendo
- En Railway, revisa logs: `railway logs --tail 50`

### Problema: Cache No Se Invalida

**Diagnóstico**:
1. F12 (DevTools) en PWA
2. Application tab → Service Workers
3. Verifica que la versión sea `4.5.0`

**Si es versión antigua** (4.4.0 o menor):
1. Application tab → Service Workers
2. Click "Unregister" en el Service Worker viejo
3. Refresca la página (Ctrl+Shift+R o Cmd+Shift+R)
4. Nueva versión 4.5.0 se instalará automáticamente

### Problema: Datos Siguen Viejos Después de 15 Segundos

**Diagnóstico**:
1. F12 → Network tab
2. Filtra por "coworking-sessions"
3. Refresca Coworking screen
4. Verifica que hace request al servidor

**Si NO hace request**:
- Cache podría estar corrupto
- Solución: Clear cache del navegador
  - Chrome: Settings → Privacy → Clear browsing data → Cached images and files
  - Safari: Settings → Safari → Clear History and Website Data

**Solución nuclear** (si nada funciona):
```javascript
// En DevTools Console:
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});

// Luego refresca la página
```

## 🔍 Logs de Diagnóstico

### En PC (Chrome DevTools):

**Console**:
```
[RealtimeSync] Connecting to SSE server...
[RealtimeSync] ✅ Connected to SSE server
[AppContext] Real-time update: coworking-sessions create
[SW SSE] 🔄 Invalidating API cache for: coworking-sessions
[SW SSE] ✅ Deleted cache: http://localhost:5173/api/coworking-sessions
```

**Network tab** (filtrar por "events"):
```
GET /api/events
Status: 200 OK
Type: eventsource
```

### En Railway Server:

**Buscar en logs**:
```bash
railway logs --tail 100 | grep -i "sse\|event"
```

**Mensajes esperados**:
```
[SSE] Client connected: <connection-id>
[SSE] Broadcasting data change: coworking-sessions
[SSE] Sent event to 3 clients
```

## 📊 Performance Esperado

### Latencia de Sincronización:

| Escenario | Antes | Ahora |
|-----------|-------|-------|
| Con SSE activo | N/A (sin SSE) | 1-2 segundos |
| Sin SSE (cache) | 60 segundos | 15 segundos |
| Manual refresh | Inmediato | Inmediato |

### Uso de Red:

- SSE mantiene 1 conexión persistente (~1KB/min de overhead)
- Cache reduce requests HTTP en 70-80%
- Sync en tiempo real = menos refreshes manuales

## 🚀 Próximos Pasos

Si todo funciona:
1. ✅ Las sesiones se sincronizan automáticamente entre dispositivos
2. ✅ PWA responde en 1-2 segundos a cambios
3. ✅ Menos uso de datos móviles (cache inteligente)

Si algo falla:
1. Revisa los logs de diagnóstico arriba
2. Verifica versión del Service Worker (debe ser 4.5.0)
3. Prueba "Solución nuclear" para limpiar todo y empezar fresco
4. Si persiste, reporta el issue con logs completos

## 🔐 Consideraciones de Seguridad

- SSE usa la misma autenticación que el resto de la app
- Conexión SSE se desconecta automáticamente al cerrar sesión
- Cache solo almacena datos ya autorizados
- Service Worker respeta políticas CORS

---

**Versión del Service Worker**: 4.5.0
**Última actualización**: 2026-03-25
**Compatibilidad**: Chrome 90+, Safari 15+, Firefox 88+
