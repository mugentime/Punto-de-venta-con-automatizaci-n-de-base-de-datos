// Service Worker para Conejo Negro POS
// Versión: 2.0.0 - Force cache update after merge

const CACHE_NAME = 'conejo-negro-pos-v2';
const RUNTIME_CACHE = 'conejo-negro-runtime-v2';

// Archivos esenciales para cachear
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/app.css',
  '/manifest.json',
  // Los archivos JS se cachearán dinámicamente porque Vite genera nombres con hash
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precaching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting(); // Activa inmediatamente el nuevo SW
      })
      .catch((error) => {
        console.error('[SW] Precaching failed:', error);
      })
  );
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            // Eliminar caches antiguas
            return cacheName.startsWith('conejo-negro-') &&
                   cacheName !== CACHE_NAME &&
                   cacheName !== RUNTIME_CACHE;
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
    .then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim(); // Toma control de todas las páginas inmediatamente
    })
  );
});

// Estrategia de caché: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que no sean GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorar requests a otros dominios (APIs externas, CDNs)
  if (url.origin !== location.origin) {
    // Para CDNs (Tailwind, etc.), usar cache first
    if (url.hostname.includes('cdn')) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // Para rutas de API, siempre ir a la red (no cachear datos dinámicos)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(
            JSON.stringify({ error: 'Sin conexión. Por favor, intenta de nuevo más tarde.' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Para el resto de archivos estáticos (HTML, CSS, JS, imágenes)
  event.respondWith(networkFirst(request));
});

// Estrategia: Network First (prioridad a la red, fallback a cache)
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    // Intentar obtener de la red primero
    const networkResponse = await fetch(request);

    // Si la respuesta es exitosa, actualizar el cache
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Si falla la red, usar el cache
    console.log('[SW] Network failed, falling back to cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no hay cache, mostrar página offline para navegación
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }

    // Para otros recursos, devolver error
    return new Response('Sin conexión', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Estrategia: Cache First (para CDNs y recursos externos)
async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch:', request.url, error);
    return new Response('Recurso no disponible', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

// Manejo de mensajes desde la aplicación
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING message');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clearing all caches');
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});

// Logging
console.log('[SW] Service Worker loaded');
