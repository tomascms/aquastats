/**
 * Offline-first utilities using Service Workers and IndexedDB
 */

/**
 * Register Service Worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Offline] Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[Offline] Service Worker registered:', registration);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          console.log('[Offline] Service Worker updated');
          // Notify user about update
          window.dispatchEvent(new Event('sw-updated'));
        }
      });
    });

    // Handle service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, data } = event.data;

      if (type === 'SYNC_COMPLETE') {
        console.log('[Offline] Sync complete');
        window.dispatchEvent(
          new CustomEvent('sync-complete', { detail: data })
        );
      }

      if (type === 'SYNC_PROGRESS') {
        console.log('[Offline] Sync progress:', data);
        window.dispatchEvent(
          new CustomEvent('sync-progress', { detail: data })
        );
      }
    });

    return registration;
  } catch (error) {
    console.error('[Offline] Failed to register Service Worker:', error);
  }
}

/**
 * Open IndexedDB database
 */
export function openDatabase(dbName = 'aquastats', version = 1): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create stores for offline data
      const stores = ['pending-workouts', 'pending-times', 'cached-data', 'sync-queue'];
      stores.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      });
    };
  });
}

/**
 * Add item to IndexedDB store
 */
export async function addToStore(storeName: string, data: any): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add({
      ...data,
      createdAt: new Date().toISOString(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
}

/**
 * Get all items from store
 */
export async function getAllFromStore(storeName: string): Promise<any[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get single item from store
 */
export async function getFromStore(storeName: string, id: number): Promise<any> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Delete item from store
 */
export async function deleteFromStore(storeName: string, id: number): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Clear entire store
 */
export async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Queue API request for offline retry
 */
export async function queueRequest(
  method: string,
  url: string,
  data?: any
): Promise<void> {
  const request = {
    method,
    url,
    data,
    timestamp: Date.now(),
    retries: 0,
  };

  await addToStore('sync-queue', request);
  console.log('[Offline] Request queued:', request);

  // Try to sync immediately if online
  if (navigator.onLine) {
    await processSyncQueue();
  } else {
    // Request background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-data');
      } catch (error) {
        console.error('[Offline] Failed to register sync:', error);
      }
    }
  }
}

/**
 * Process sync queue manually
 */
export async function processSyncQueue(): Promise<void> {
  if (!navigator.onLine) {
    console.warn('[Offline] Cannot sync while offline');
    return;
  }

  const requests = await getAllFromStore('sync-queue');

  for (const request of requests) {
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: request.data ? JSON.stringify(request.data) : undefined,
      });

      if (response.ok) {
        await deleteFromStore('sync-queue', request.id);
        console.log('[Offline] Synced request:', request.url);
      } else if (response.status >= 500) {
        // Server error, retry later
        throw new Error(`Server error: ${response.status}`);
      } else {
        // Client error, don't retry
        await deleteFromStore('sync-queue', request.id);
        console.error('[Offline] Request failed (no retry):', response.status);
      }
    } catch (error) {
      request.retries++;
      if (request.retries > 5) {
        await deleteFromStore('sync-queue', request.id);
        console.error('[Offline] Request failed after 5 retries:', request);
      } else {
        // Update with retry count
        const updated = await getFromStore('sync-queue', request.id);
        updated.retries = request.retries;
      }
    }
  }
}

/**
 * Get offline status
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Listen to online/offline changes
 */
export function onlineStatusListener(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Get pending sync items count
 */
export async function getPendingSyncCount(): Promise<number> {
  const queue = await getAllFromStore('sync-queue');
  return queue.length;
}

/**
 * Get offline stats
 */
export async function getOfflineStats() {
  return {
    pendingWorkouts: (await getAllFromStore('pending-workouts')).length,
    pendingTimes: (await getAllFromStore('pending-times')).length,
    syncQueue: (await getAllFromStore('sync-queue')).length,
    isOnline: navigator.onLine,
  };
}

/**
 * Initialize offline-first app
 */
export async function initializeOfflineApp(): Promise<void> {
  // Register Service Worker
  await registerServiceWorker();

  // Handle online/offline changes
  onlineStatusListener((online) => {
    console.log('[Offline]', online ? 'Online' : 'Offline');
    if (online) {
      processSyncQueue().catch(console.error);
    }
  });

  // Log offline stats
  const stats = await getOfflineStats();
  console.log('[Offline] Stats:', stats);
}
