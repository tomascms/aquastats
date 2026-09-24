// Service Worker with Workbox - Aquastats PWA
// Features: Offline mode, background sync, push notifications

const CACHE_PREFIX = 'aquastats';
const CACHE_VERSION = '1';
const CACHE_NAME = `${CACHE_PREFIX}-v${CACHE_VERSION}`;

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/favicon.ico',
];

// API endpoints to cache with network-first strategy
const API_ROUTES = [
  '/api/v1/athletes',
  '/api/v1/workouts',
  '/api/v1/times',
  '/api/v1/teams',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
      });
    })
  );

  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  self.clients.claim();
});

// Fetch event - network-first with offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests: network-first with cache fallback
  if (API_ROUTES.some((route) => url.pathname.includes(route))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets: cache-first with network fallback
  if (
    url.pathname.match(/\.(js|css|png|jpg|gif|svg|ico|woff|woff2)$/i) ||
    url.pathname === '/'
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML pages: network-first with offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Network-first strategy: Try network, fall back to cache
 * Best for: API calls, dynamic content
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network request failed, trying cache:', request.url);

    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page if no cached response
    return caches.match('/offline.html') || new Response('Offline', { status: 503 });
  }
}

/**
 * Cache-first strategy: Try cache, fall back to network
 * Best for: Static assets (JS, CSS, images)
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);
    return new Response('Not found', { status: 404 });
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);

  if (event.tag === 'sync-workouts') {
    event.waitUntil(syncWorkouts());
  }

  if (event.tag === 'sync-times') {
    event.waitUntil(syncTimes());
  }

  if (event.tag === 'sync-data') {
    event.waitUntil(syncAllData());
  }
});

/**
 * Sync workouts from IndexedDB to server
 */
async function syncWorkouts() {
  try {
    const db = await openDatabase();
    const workouts = await getAllFromStore(db, 'pending-workouts');

    for (const workout of workouts) {
      try {
        const response = await fetch('/api/v1/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workout.data),
        });

        if (response.ok) {
          await deleteFromStore(db, 'pending-workouts', workout.id);
          console.log('[SW] Synced workout:', workout.id);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('[SW] Failed to sync workout:', workout.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync workouts failed:', error);
    throw error; // Retry background sync
  }
}

/**
 * Sync time logs from IndexedDB to server
 */
async function syncTimes() {
  try {
    const db = await openDatabase();
    const times = await getAllFromStore(db, 'pending-times');

    for (const time of times) {
      try {
        const response = await fetch('/api/v1/times', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(time.data),
        });

        if (response.ok) {
          await deleteFromStore(db, 'pending-times', time.id);
          console.log('[SW] Synced time:', time.id);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('[SW] Failed to sync time:', time.id, error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync times failed:', error);
    throw error;
  }
}

/**
 * Sync all pending data
 */
async function syncAllData() {
  console.log('[SW] Syncing all pending data...');

  try {
    await syncWorkouts();
    await syncTimes();

    // Notify all clients of successful sync
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        success: true,
      });
    });

    console.log('[SW] Sync complete');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error;
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  const data = event.data?.json() || {};
  const options = {
    badge: '/favicon.ico',
    icon: '/android-chrome-192x192.png',
    body: data.body || 'Aquastats notification',
    actions: data.actions || [],
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Aquastats', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if there's already a window/tab open
      for (let i = 0; i < clients.length; i++) {
        if (clients[i].url === '/' && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }

      // Open new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

/**
 * IndexedDB helpers
 */

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aquastats', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores
      ['pending-workouts', 'pending-times', 'cached-data'].forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
