/* ============================================
   Service Worker for Offline Support
   FinAll - Personal Financial Allocation
   ============================================ */

const CACHE_NAME = 'finall-v1.5.286';
const OFFLINE_CACHE = 'finall-offline-v1';

// Assets to cache immediately
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/dashboard.html',
  '/transaction.html',
  '/settings.html',
  '/reports.html',
  '/release-notes.html',
  '/css/critical.css',
  '/css/style.css',
  '/css/dashboard.css',
  '/css/login.css',
  '/css/non-critical.css',
  '/js/firebase.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/transaction.js',
  '/js/settings.js',
  '/js/report.js',
  '/assets/logo.svg',
  '/assets/icons/favicon.svg',
  '/assets/icons/check.svg',
  '/assets/icons/star.svg',
  '/assets/images/empty-state.svg',
  '/assets/images/no-data.svg',
  '/version.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Assets to cache on demand
const ON_DEMAND_ASSETS = [
  // Additional assets that can be cached when accessed
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching critical assets');
        return cache.addAll(CRITICAL_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Critical assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Old caches cleaned');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('[Service Worker] Activation failed:', error);
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Firebase and external API calls
  if (url.hostname.includes('firebaseio.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Network-first strategy for Firebase calls
  if (url.pathname.includes('/firebase/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return offline fallback for Firebase config
          return caches.match('/firebase/init.json');
        })
    );
    return;
  }

  // Cache-first strategy for static assets
  if (url.pathname.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request)
        .then((response) => {
          if (response) {
            // Update cache in background
            fetch(request).then((freshResponse) => {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, freshResponse);
              });
            });
            return response;
          }
          
          return fetch(request)
            .then((response) => {
              // Cache successful responses
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            })
            .catch(() => {
              // Return offline fallback for HTML pages
              if (request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
              }
            });
        })
    );
    return;
  }

  // Network-first strategy for HTML pages
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful HTML responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Serve from cache if network fails
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return offline page as fallback
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Default network request
  event.respondWith(fetch(request));
});

// Message event - handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(urls))
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncTransactions());
  }
});

// Push notifications (optional)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'FinAll: Ada pembaruan baru',
    icon: '/assets/logo.svg',
    badge: '/assets/icons/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('FinAll', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/dashboard.html')
  );
});

// Sync transactions when back online
async function syncTransactions() {
  try {
    // Get offline transactions from IndexedDB
    // This would need to be implemented with IndexedDB
    console.log('[Service Worker] Syncing offline transactions...');
    // Implementation would go here
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
  }
}

// Periodic cache cleanup
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupCache());
  }
});

async function cleanupCache() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name !== CACHE_NAME && name !== OFFLINE_CACHE
  );
  
  await Promise.all(
    oldCaches.map(name => caches.delete(name))
  );
  
  console.log('[Service Worker] Cache cleanup completed');
}