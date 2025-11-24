// Service Worker Optimizado para Conejo Negro POS
// Versión: 3.0.0 - Multi-tier caching strategy with intelligent resource management
// Performance target: >80% cache hit rate, <1MB transfer on repeat visits

const VERSION = '3.0.0';
const CACHE_PREFIX = 'conejo-negro-pos';
const CACHES = {
  static: `${CACHE_PREFIX}-static-v${VERSION}`,      // JS, CSS con hash - Cache First
  images: `${CACHE_PREFIX}-images-v${VERSION}`,      // Imágenes - Stale-While-Revalidate
  runtime: `${CACHE_PREFIX}-runtime-v${VERSION}`,    // HTML, otros - Network First
  cdn: `${CACHE_PREFIX}-cdn-v${VERSION}`             // CDNs externos - Cache First
};

// Límites de cache para prevenir crecimiento excesivo
const CACHE_LIMITS = {
  images: 50,  // Máximo 50 imágenes
  runtime: 30, // Máximo 30 recursos runtime
  cdn: 20      // Máximo 20 recursos CDN
};

// TTL (Time To Live) en milisegundos
const CACHE_TTL = {
  static: 7 * 24 * 60 * 60 * 1000,   // 7 días para assets estáticos
  images: 3 * 24 * 60 * 60 * 1000,   // 3 días para imágenes
  cdn: 30 * 24 * 60 * 60 * 1000,     // 30 días para CDNs
  runtime: 24 * 60 * 60 * 1000       // 1 día para runtime
};

// Assets críticos para precache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
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
  cdn: /(cdn\.|unpkg\.|jsdelivr\.|cdnjs\.|fonts\.googleapis\.com|fonts\.gstatic\.com)/i,

  // API routes
  api: /\/api\//i
};

// ============================================================================
// INSTALACIÓN Y ACTIVACIÓN
// ============================================================================

self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing...`);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHES.static);

      // Precache solo recursos críticos
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
  // 1. API requests - NO cachear, pasar directo
  if (PATTERNS.api.test(url.pathname)) {
    return null; // Dejar pasar al browser
  }

  // 2. Assets de Vite con hash - Cache First (immutable)
  if (PATTERNS.viteAssets.test(url.pathname)) {
    return cacheFirst(request, CACHES.static);
  }

  // 3. Fonts - Cache First (immutable)
  if (PATTERNS.fonts.test(url.pathname)) {
    return cacheFirst(request, CACHES.static);
  }

  // 4. CDNs externos - Cache First con TTL
  if (url.origin !== location.origin && PATTERNS.cdn.test(url.hostname)) {
    return cacheFirst(request, CACHES.cdn, CACHE_TTL.cdn);
  }

  // 5. Imágenes - Stale-While-Revalidate
  if (PATTERNS.images.test(url.pathname)) {
    return staleWhileRevalidate(request, CACHES.images, CACHE_TTL.images);
  }

  // 6. Navegación y otros - Network First
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    return networkFirst(request, CACHES.runtime);
  }

  // 7. Recursos del mismo origen - Network First
  if (url.origin === location.origin) {
    return networkFirst(request, CACHES.runtime);
  }

  // Default: dejar pasar
  return null;
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

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

console.log(`[SW ${VERSION}] Service Worker loaded with multi-tier caching`);
