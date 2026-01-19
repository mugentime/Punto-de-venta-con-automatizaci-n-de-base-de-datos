// Service Worker Optimizado para Conejo Negro POS - PWA Performance Edition
// Versión: 4.4.0 - Added pagination + SSE real-time sync
// Performance target: >90% cache hit rate, instant page loads

const VERSION = '4.4.0';
const CACHE_PREFIX = 'conejo-negro-pos';
const CACHES = {
  static: `${CACHE_PREFIX}-static-v${VERSION}`,      // JS, CSS con hash - Cache First
  images: `${CACHE_PREFIX}-images-v${VERSION}`,      // Imágenes - Stale-While-Revalidate
  runtime: `${CACHE_PREFIX}-runtime-v${VERSION}`,    // HTML, otros - Network First
  cdn: `${CACHE_PREFIX}-cdn-v${VERSION}`,            // CDNs externos - Cache First
  api: `${CACHE_PREFIX}-api-v${VERSION}`             // API responses - Network First w/ Cache Fallback
};

// Límites de cache para prevenir crecimiento excesivo
const CACHE_LIMITS = {
  images: 50,  // Máximo 50 imágenes
  runtime: 30, // Máximo 30 recursos runtime
  cdn: 20,     // Máximo 20 recursos CDN
  api: 100     // Máximo 100 API responses
};

// TTL (Time To Live) en milisegundos
const CACHE_TTL = {
  static: 7 * 24 * 60 * 60 * 1000,   // 7 días para assets estáticos
  images: 3 * 24 * 60 * 60 * 1000,   // 3 días para imágenes
  cdn: 30 * 24 * 60 * 60 * 1000,     // 30 días para CDNs
  runtime: 24 * 60 * 60 * 1000,      // 1 día para runtime
  api: {
    products: 10 * 60 * 1000,        // 10 minutos - productos cambian poco
    orders: 60 * 1000,               // 60 segundos - SSE invalida cache cuando cambian
    expenses: 2 * 60 * 1000,         // 2 minutos
    'coworking-sessions': 60 * 1000, // 60 segundos - SSE invalida cache cuando cambian
    'cash-sessions': 60 * 1000,      // 1 minuto
    users: 5 * 60 * 1000,            // 5 minutos
    customers: 5 * 60 * 1000,        // 5 minutos
    'cash-withdrawals': 60 * 1000,   // 1 minuto
    default: 30 * 1000               // 30 segundos default
  }
};

// Assets críticos para precache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.css'
];

// Regex patterns para clasificación de recursos
const PATTERNS = {
  // Assets de Vite con hash (ej: index-V0A218nn.js)
  viteAssets: /\/(assets|dist)\/[^/]+\.[a-f0-9]{8,}\.(js|css)$/i,

  // Imágenes
  images: /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,

  // Fonts
  fonts: /\.(woff|woff2|ttf|eot|otf)$/i,

  // CDNs conocidos
  cdn: /(cdn\.|unpkg\.|jsdelivr\.|cdnjs\.|fonts\.googleapis\.com|fonts\.gstatic\.com|aistudiocdn\.com)/i,

  // API routes
  api: /\/api\//i,

  // API routes que pueden ser cacheadas
  cacheableApi: /\/api\/(products|orders|expenses|coworking-sessions|cash-sessions|users|customers|cash-withdrawals)/i
};

// ============================================================================
// INSTALACIÓN Y ACTIVACIÓN
// ============================================================================

self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing...`);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHES.static);

      // Precache recursos críticos
      await cache.addAll(PRECACHE_URLS);

      console.log(`[SW ${VERSION}] Precache complete`);

      // Activar inmediatamente
      return self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Activating...`);

  event.waitUntil(
    (async () => {
      // Limpiar caches antiguas
      const cacheNames = await caches.keys();
      const oldCaches = cacheNames.filter(name =>
        name.startsWith(CACHE_PREFIX) &&
        !Object.values(CACHES).includes(name)
      );

      await Promise.all(
        oldCaches.map(name => {
          console.log(`[SW ${VERSION}] Deleting old cache: ${name}`);
          return caches.delete(name);
        })
      );

      console.log(`[SW ${VERSION}] Activation complete`);

      // Tomar control de todas las páginas
      return self.clients.claim();
    })()
  );
});

// ============================================================================
// ESTRATEGIAS DE CACHE
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Clasificar y rutear request
  const strategy = classifyRequest(url, request);

  if (strategy) {
    event.respondWith(strategy);
  }
});

/**
 * Clasifica el request y devuelve la estrategia apropiada
 */
function classifyRequest(url, request) {
  // 1. API requests cacheables - Stale-While-Revalidate
  if (PATTERNS.cacheableApi.test(url.pathname)) {
    return apiStaleWhileRevalidate(request, url);
  }

  // 2. Otros API requests - Network only (mutaciones)
  if (PATTERNS.api.test(url.pathname)) {
    return null; // Dejar pasar al browser para mutaciones
  }

  // 3. Assets de Vite con hash - Cache First (immutable)
  if (PATTERNS.viteAssets.test(url.pathname)) {
    return cacheFirst(request, CACHES.static);
  }

  // 4. Fonts - Cache First (immutable)
  if (PATTERNS.fonts.test(url.pathname)) {
    return cacheFirst(request, CACHES.static);
  }

  // 5. CDNs externos - Cache First con TTL largo
  if (url.origin !== location.origin && PATTERNS.cdn.test(url.hostname)) {
    return cacheFirst(request, CACHES.cdn, CACHE_TTL.cdn);
  }

  // 6. Imágenes - Stale-While-Revalidate
  if (PATTERNS.images.test(url.pathname)) {
    return staleWhileRevalidate(request, CACHES.images, CACHE_TTL.images);
  }

  // 7. Navegación y otros - Network First
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    return networkFirst(request, CACHES.runtime);
  }

  // 8. Recursos del mismo origen - Network First
  if (url.origin === location.origin) {
    return networkFirst(request, CACHES.runtime);
  }

  // Default: dejar pasar
  return null;
}

/**
 * API Stale-While-Revalidate - Optimizado para datos PWA
 * Retorna cache inmediatamente y actualiza en background
 */
async function apiStaleWhileRevalidate(request, url) {
  const cache = await caches.open(CACHES.api);
  const cachedResponse = await cache.match(request);

  // Determinar TTL para este endpoint
  const endpoint = url.pathname.split('/api/')[1]?.split('/')[0]?.split('?')[0] || 'default';
  const ttl = CACHE_TTL.api[endpoint] || CACHE_TTL.api.default;

  // Verificar si cache es válido
  let cacheIsValid = false;
  if (cachedResponse) {
    const cachedDate = cachedResponse.headers.get('sw-cached-date');
    if (cachedDate) {
      const age = Date.now() - new Date(cachedDate).getTime();
      cacheIsValid = age < ttl;

      if (cacheIsValid) {
        console.log(`[SW API] Cache HIT (${endpoint}): age ${Math.round(age/1000)}s < ${Math.round(ttl/1000)}s TTL`);
      } else {
        console.log(`[SW API] Cache STALE (${endpoint}): age ${Math.round(age/1000)}s > ${Math.round(ttl/1000)}s TTL`);
      }
    }
  }

  // Función para hacer fetch y actualizar cache
  const fetchAndUpdate = async () => {
    try {
      const networkResponse = await fetch(request);

      if (networkResponse && networkResponse.ok) {
        await saveToCache(cache, request, networkResponse.clone(), CACHES.api);
        console.log(`[SW API] Cache UPDATED: ${endpoint}`);
      }

      return networkResponse;
    } catch (error) {
      console.error(`[SW API] Network failed for ${endpoint}:`, error);
      throw error;
    }
  };

  // Si tenemos cache válido, retornarlo inmediatamente
  if (cachedResponse && cacheIsValid) {
    // Actualizar en background si estamos más del 50% del TTL
    const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date'));
    const age = Date.now() - cachedDate.getTime();

    if (age > ttl * 0.5) {
      console.log(`[SW API] Background refresh for ${endpoint}`);
      fetchAndUpdate().catch(() => {});
    }

    return cachedResponse;
  }

  // Si cache es stale, intentar red primero
  if (cachedResponse) {
    // Intentar red, pero con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    try {
      const networkResponse = await fetch(request, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (networkResponse.ok) {
        await saveToCache(cache, request, networkResponse.clone(), CACHES.api);
        return networkResponse;
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.log(`[SW API] Network slow/failed, using stale cache for ${endpoint}`);
      return cachedResponse;
    }
  }

  // Sin cache, necesitamos la red
  return fetchAndUpdate();
}

/**
 * Cache First - Para recursos immutable (assets con hash, fonts)
 */
async function cacheFirst(request, cacheName, ttl = null) {
  const cache = await caches.open(cacheName);

  // Buscar en cache primero
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Verificar TTL si está configurado
    if (ttl) {
      const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date'));
      const now = Date.now();

      if (now - cachedDate.getTime() > ttl) {
        // Cache expirado, actualizar en background
        fetchAndCache(request, cache).catch(() => {});
      }
    }

    return cachedResponse;
  }

  // Si no está en cache, obtener de la red
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      await saveToCache(cache, request, networkResponse.clone(), cacheName);
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    return new Response('Recurso no disponible', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Network First - Para HTML y contenido dinámico
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      await saveToCache(cache, request, networkResponse.clone(), cacheName);
    }

    return networkResponse;
  } catch (error) {
    // Fallback a cache si red falla
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[SW] Network failed, using cache:', request.url);
      return cachedResponse;
    }

    // Si es navegación, devolver index.html para SPA
    if (request.mode === 'navigate') {
      const indexResponse = await cache.match('/index.html');
      if (indexResponse) {
        return indexResponse;
      }
    }

    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

/**
 * Stale-While-Revalidate - Para imágenes y recursos que pueden estar desactualizados
 */
async function staleWhileRevalidate(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch en background para actualizar cache
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse && networkResponse.status === 200) {
      saveToCache(cache, request, networkResponse.clone(), cacheName);
    }
    return networkResponse;
  }).catch(() => cachedResponse); // Si falla, usar cache

  // Retornar cache inmediatamente si existe
  return cachedResponse || fetchPromise;
}

/**
 * Guardar respuesta en cache con metadata y límites
 */
async function saveToCache(cache, request, response, cacheName) {
  // Agregar metadata de fecha
  const headers = new Headers(response.headers);
  headers.set('sw-cached-date', new Date().toISOString());

  const cachedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });

  await cache.put(request, cachedResponse);

  // Aplicar límites de cache
  await enforceQuota(cache, cacheName);
}

/**
 * Fetch y cache helper
 */
async function fetchAndCache(request, cache) {
  const response = await fetch(request);
  if (response && response.status === 200) {
    await cache.put(request, response.clone());
  }
  return response;
}

/**
 * Enforcer límites de cache para prevenir crecimiento excesivo
 */
async function enforceQuota(cache, cacheName) {
  // Determinar límite basado en tipo de cache
  let limit = CACHE_LIMITS.runtime; // default

  if (cacheName.includes('images')) {
    limit = CACHE_LIMITS.images;
  } else if (cacheName.includes('cdn')) {
    limit = CACHE_LIMITS.cdn;
  } else if (cacheName.includes('api')) {
    limit = CACHE_LIMITS.api;
  }

  const keys = await cache.keys();

  if (keys.length > limit) {
    // Eliminar las entradas más antiguas (FIFO)
    const toDelete = keys.length - limit;
    for (let i = 0; i < toDelete; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[SW] Quota enforced: deleted ${toDelete} old entries from ${cacheName}`);
  }
}

// ============================================================================
// BACKGROUND SYNC para operaciones offline
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log(`[SW] Background sync triggered: ${event.tag}`);

  if (event.tag === 'sync-pending-operations') {
    event.waitUntil(processPendingOperations());
  }
});

async function processPendingOperations() {
  // Este se integra con IndexedDB pendingSync store
  console.log('[SW] Processing pending operations...');
  // La lógica real está en offlineStorage.ts
  // El SW solo dispara la sincronización

  // Notificar a los clientes que la sincronización comenzó
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_STARTED' });
  });
}

// ============================================================================
// MENSAJES Y UTILIDADES
// ============================================================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING requested');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] CLEAR_CACHE requested');
    event.waitUntil(
      caches.keys().then(names =>
        Promise.all(names.map(name => caches.delete(name)))
      )
    );
  }

  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    console.log('[SW] CLEAR_API_CACHE requested');
    event.waitUntil(caches.delete(CACHES.api));
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }

  if (event.data && event.data.type === 'GET_CACHE_STATS') {
    event.waitUntil(
      (async () => {
        const stats = {};
        for (const [name, cacheName] of Object.entries(CACHES)) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          stats[name] = keys.length;
        }
        event.ports[0].postMessage({ stats });
      })()
    );
  }

  // Invalidar cache de API específico (usado por SSE para sincronización en tiempo real)
  if (event.data && event.data.type === 'INVALIDATE_API') {
    const endpoint = event.data.endpoint;
    console.log(`[SW SSE] 🔄 Invalidating API cache for: ${endpoint}`);
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHES.api);
        const keys = await cache.keys();
        let deleted = 0;

        for (const request of keys) {
          if (request.url.includes(endpoint)) {
            await cache.delete(request);
            deleted++;
            console.log(`[SW SSE] ✅ Deleted cache: ${request.url}`);
          }
        }

        console.log(`[SW SSE] Invalidated ${deleted} cache entries for ${endpoint}`);

        // Notify all clients that cache was invalidated
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'CACHE_INVALIDATED',
            endpoint,
            count: deleted
          });
        });
      })()
    );
  }
});

console.log(`[SW ${VERSION}] Service Worker loaded with API caching and offline support`);
