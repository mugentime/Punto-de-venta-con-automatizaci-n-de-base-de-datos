/**
 * @fileoverview Service Worker for Offline POS Capabilities
 * @description Enables offline functionality, caching strategies, and performance optimizations
 * @author POS Development Team
 * @version 1.0.0
 * @created 2025-09-12
 */

const CACHE_NAME = 'pos-conejo-negro-v1.0.0';
const CACHE_VERSION = '20250912';
const OFFLINE_PAGE = '/offline.html';

// Assets to cache immediately on install
const CRITICAL_ASSETS = [
  '/',
  '/online',
  '/index.html',
  '/conejo_negro_online.html',
  '/css/mobile-optimized.css',
  '/js/mobile-enhancements.js',
  '/js/mobile-menu-simple.js',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Roboto:wght@300;400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API routes to cache
const API_CACHE_ROUTES = [
  '/api/health',
  '/api/version',
  '/api/stats',
  '/api/products',
  '/api/sync/status'
];

// Routes that should always be fresh (never cached)
const NO_CACHE_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/records',
  '/api/cashcuts',
  '/api/sync/backup'
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

/**
 * Service Worker Install Event
 * Pre-caches critical assets for offline functionality
 */
self.addEventListener('install', event => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Pre-caching critical assets...');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('✅ Critical assets cached');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(error => {
        console.error('❌ Failed to cache critical assets:', error);
      })
  );
});

/**
 * Service Worker Activate Event
 * Cleans up old caches and claims clients
 */
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        // Delete old caches
        const deletePromises = cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('🗑️ Deleting old cache:', name);
            return caches.delete(name);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('✅ Old caches cleaned up');
        return self.clients.claim(); // Take control immediately
      })
  );
});

/**
 * Service Worker Fetch Event
 * Implements intelligent caching strategies based on request type
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Skip POST, PUT, DELETE requests for caching
  if (request.method !== 'GET') {
    return handleNetworkOnlyRequest(event);
  }
  
  // Determine cache strategy based on request
  const strategy = getCacheStrategy(url.pathname);
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return handleCacheFirstRequest(event);
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return handleNetworkFirstRequest(event);
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return handleStaleWhileRevalidateRequest(event);
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return handleNetworkOnlyRequest(event);
    case CACHE_STRATEGIES.CACHE_ONLY:
      return handleCacheOnlyRequest(event);
    default:
      return handleNetworkFirstRequest(event);
  }
});

/**
 * Determines the appropriate cache strategy for a given route
 * @param {string} pathname - The request pathname
 * @returns {string} Cache strategy constant
 */
function getCacheStrategy(pathname) {
  // Static assets: cache first
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return CACHE_STRATEGIES.CACHE_FIRST;
  }
  
  // HTML pages: stale while revalidate
  if (pathname.match(/\.(html?)$/) || pathname === '/' || pathname === '/online') {
    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
  }
  
  // Never cache sensitive routes
  if (NO_CACHE_ROUTES.some(route => pathname.startsWith(route))) {
    return CACHE_STRATEGIES.NETWORK_ONLY;
  }
  
  // Cache API routes with network first
  if (API_CACHE_ROUTES.some(route => pathname.startsWith(route))) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // Default to network first for API routes
  if (pathname.startsWith('/api/')) {
    return CACHE_STRATEGIES.NETWORK_FIRST;
  }
  
  // External resources: cache first
  return CACHE_STRATEGIES.CACHE_FIRST;
}

/**
 * Cache First Strategy
 * Serves from cache if available, otherwise fetches from network
 */
function handleCacheFirstRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(networkResponse => {
            // Cache successful responses
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(error => {
            console.error('Network request failed:', error);
            return createOfflineResponse();
          });
      })
  );
}

/**
 * Network First Strategy
 * Tries network first, falls back to cache
 */
function handleNetworkFirstRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Cache successful responses
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(error => {
        console.log('Network failed, trying cache:', error.message);
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return createOfflineResponse();
          });
      })
  );
}

/**
 * Stale While Revalidate Strategy
 * Serves from cache immediately, updates cache in background
 */
function handleStaleWhileRevalidateRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            // Update cache in background
            if (networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('Background fetch failed:', error.message);
          });
        
        // Return cached response immediately, or wait for network
        return cachedResponse || fetchPromise;
      })
  );
}

/**
 * Network Only Strategy
 * Always fetches from network, no caching
 */
function handleNetworkOnlyRequest(event) {
  event.respondWith(
    fetch(event.request)
      .catch(error => {
        console.error('Network-only request failed:', error);
        return createOfflineResponse();
      })
  );
}

/**
 * Cache Only Strategy
 * Only serves from cache, never hits network
 */
function handleCacheOnlyRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        return cachedResponse || createOfflineResponse();
      })
  );
}

/**
 * Creates a generic offline response
 * @returns {Response} Offline response object
 */
function createOfflineResponse() {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'La aplicación está funcionando sin conexión',
      timestamp: new Date().toISOString(),
      offline: true
    }),
    {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

/**
 * Background Sync Event
 * Handles background synchronization when connection is restored
 */
self.addEventListener('sync', event => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'pos-data-sync':
      event.waitUntil(syncPOSData());
      break;
    case 'offline-records':
      event.waitUntil(syncOfflineRecords());
      break;
    default:
      console.log('Unknown sync tag:', event.tag);
  }
});

/**
 * Syncs POS data when connection is restored
 */
async function syncPOSData() {
  try {
    console.log('📊 Syncing POS data...');
    
    // Get offline data from IndexedDB or localStorage
    const offlineData = await getOfflineData();
    
    if (offlineData.length > 0) {
      // Send offline data to server
      const response = await fetch('/api/sync/offline-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(offlineData)
      });
      
      if (response.ok) {
        console.log('✅ Offline data synced successfully');
        await clearOfflineData();
      } else {
        throw new Error(`Sync failed: ${response.status}`);
      }
    }
    
    // Refresh cached data
    await refreshCachedData();
    
  } catch (error) {
    console.error('❌ Data sync failed:', error);
  }
}

/**
 * Syncs offline records specifically
 */
async function syncOfflineRecords() {
  try {
    console.log('📝 Syncing offline records...');
    
    // Implementation would depend on your offline storage strategy
    const offlineRecords = await getOfflineRecords();
    
    for (const record of offlineRecords) {
      try {
        const response = await fetch('/api/records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${record.token}`
          },
          body: JSON.stringify(record.data)
        });
        
        if (response.ok) {
          await removeOfflineRecord(record.id);
        }
      } catch (recordError) {
        console.error('Failed to sync record:', record.id, recordError);
      }
    }
    
  } catch (error) {
    console.error('❌ Records sync failed:', error);
  }
}

/**
 * Message Event Handler
 * Handles messages from the main thread
 */
self.addEventListener('message', event => {
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CACHE_ASSETS':
      cacheAssets(payload.urls);
      break;
    case 'CLEAR_CACHE':
      clearCache();
      break;
    case 'GET_CACHE_SIZE':
      getCacheSize().then(size => {
        event.ports[0].postMessage({ type: 'CACHE_SIZE', size });
      });
      break;
    default:
      console.log('Unknown message type:', type);
  }
});

/**
 * Cache additional assets dynamically
 * @param {string[]} urls - URLs to cache
 */
async function cacheAssets(urls) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(urls);
    console.log('✅ Assets cached:', urls);
  } catch (error) {
    console.error('❌ Failed to cache assets:', error);
  }
}

/**
 * Clear all caches
 */
async function clearCache() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('✅ All caches cleared');
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
  }
}

/**
 * Get total cache size
 * @returns {Promise<number>} Cache size in bytes
 */
async function getCacheSize() {
  try {
    let totalSize = 0;
    const cacheNames = await caches.keys();
    
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      
      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('❌ Failed to calculate cache size:', error);
    return 0;
  }
}

// Placeholder functions for offline data management
// These would be implemented based on your specific offline storage strategy

async function getOfflineData() {
  // Return offline data from IndexedDB/localStorage
  return [];
}

async function clearOfflineData() {
  // Clear offline data after successful sync
}

async function getOfflineRecords() {
  // Return offline records
  return [];
}

async function removeOfflineRecord(id) {
  // Remove specific offline record
}

async function refreshCachedData() {
  // Refresh cached API responses
  const cache = await caches.open(CACHE_NAME);
  const cachedRequests = await cache.keys();
  
  for (const request of cachedRequests) {
    if (request.url.includes('/api/')) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
        }
      } catch (error) {
        console.log('Failed to refresh cached data:', request.url);
      }
    }
  }
}