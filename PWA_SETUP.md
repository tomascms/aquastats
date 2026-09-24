# 📱 Aquastats PWA - Offline-First Setup (Fase 7)

**Status:** ✅ COMPLETED - Full offline-first PWA implemented

---

## 🎯 What's Implemented

### Service Worker (`/public/sw.js`)
- ✅ **Static asset caching** (cache-first strategy)
  - Caches JS, CSS, images, fonts on first load
  - Serves from cache for instant load times
  
- ✅ **API response caching** (network-first strategy)
  - Tries network first, falls back to cache
  - Perfect for dynamic data (workouts, times, athletes)
  
- ✅ **Offline fallback** (`/offline.html`)
  - Beautiful offline page with useful information
  - Explains what users can do offline
  
- ✅ **Background sync** (Sync API)
  - Automatically syncs pending data when online
  - Retries failed requests with backoff
  - User-initiated manual sync available

- ✅ **Push notifications** support
  - Display notifications on push events
  - Handle notification clicks
  - Open app on notification click

### IndexedDB (`/src/lib/offline.ts`)
- ✅ **Offline data storage**
  - `pending-workouts`: Workouts created offline
  - `pending-times`: Times logged offline
  - `sync-queue`: API requests queued for retry
  - `cached-data`: Cache for offline viewing

- ✅ **Sync queue management**
  - Stores failed API requests
  - Automatic retry with exponential backoff
  - Manual sync trigger available

### Web App Manifest (`/public/manifest.json`)
- ✅ **Installable PWA**
  - Add to home screen (iOS/Android)
  - Standalone display mode
  - Splash screen & icons
  
- ✅ **App shortcuts**
  - Quick access to Dashboard
  - Quick access to Time logging
  - Quick access to Workout creation
  - Quick access to Race analysis

- ✅ **Share target**
  - Users can share CSV/JSON data to app
  - Accepts files and URLs

### React Integration (`/src/hooks/useOffline.ts`)
- ✅ **`useOfflineStatus()` hook**
  - Get online/offline status
  - Pending sync count
  - Offline stats
  - Manual sync trigger
  
- ✅ **`useOfflineQueue()` hook**
  - Queue requests for offline retry
  - Automatic fallback to queue when offline
  - Seamless request management

### Offline Page (`/public/offline.html`)
- ✅ **Beautiful offline UI**
  - Clear offline message
  - Features available offline
  - Sync status indicator
  - Actions to reconnect
  - Dark mode support

---

## 🔧 Setup Instructions

### 1. Add Meta Tags to HTML Head

```html
<!-- app/layout.tsx -->
<meta name="theme-color" content="#0ea5e9" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Aquastats" />
<link rel="manifest" href="/manifest.json" />
<link rel="icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

### 2. Register Service Worker in App

```typescript
// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { initializeOfflineApp } from '@/lib/offline';

export default function RootLayout({ children }) {
  useEffect(() => {
    // Initialize offline-first app
    initializeOfflineApp().catch(console.error);
    
    // Listen for SW updates
    window.addEventListener('sw-updated', () => {
      console.log('New version available');
      // Show update notification to user
    });
  }, []);

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

### 3. Use Offline Hooks in Components

```typescript
// components/example.tsx
'use client';

import { useOfflineStatus } from '@/hooks/useOffline';

export function MyComponent() {
  const { isOnline, pendingSyncCount, manualSync } = useOfflineStatus();

  return (
    <div>
      {!isOnline && (
        <div className="offline-banner">
          📡 Offline mode ({pendingSyncCount} pending)
          <button onClick={manualSync}>Sync Now</button>
        </div>
      )}
      {/* Component content */}
    </div>
  );
}
```

### 4. Queue Offline Requests

```typescript
// routes/times.tsx
import { queueRequest } from '@/lib/offline';

async function savetime(data: any) {
  // This will queue the request if offline
  await queueRequest('POST', '/api/v1/times', data);
}
```

---

## 📱 Installation on Mobile

### iOS
1. Open Aquastats in Safari
2. Tap Share → Add to Home Screen
3. Tap Add

### Android
1. Open Aquastats in Chrome
2. Tap Menu (⋮) → Install app
3. Tap Install

### PWA Features on Install
- ✅ Full-screen standalone experience
- ✅ App shortcuts
- ✅ Offline access to cached data
- ✅ Automatic background sync
- ✅ Push notifications

---

## 🧪 Testing Offline Features

### Test 1: Offline Viewing
1. Open app in browser
2. Go to Dashboard (loads from cache)
3. Open DevTools → Network → Offline
4. Refresh page → Still works
5. Go back → Can view all cached pages

### Test 2: Offline Recording
1. Go offline (DevTools)
2. Create new athlete
3. Record time
4. New data saved to IndexedDB
5. Go online (DevTools)
6. Data syncs automatically
7. Appears on server

### Test 3: Background Sync
1. Create a time while offline
2. Go online before leaving page
3. Watch sync happen automatically
4. Check server for new time

### Test 4: Manual Sync
1. Create data offline
2. Press "Sync Now" button
3. See pending items → 0
4. Check server

### Test 5: Failed Retry
1. Go offline
2. Create workout
3. Go online, but API is down
4. Request stays in queue
5. API recovers
6. Auto-retry succeeds
7. Data appears on server

---

## 🔄 Sync Behavior

### Automatic Sync
```
User goes offline
   ↓
Creates/modifies data
   ↓
Data saved to IndexedDB
   ↓
User goes online
   ↓
Service Worker detects online
   ↓
Starts background sync (Sync API)
   ↓
Sends queued requests to server
   ↓
Removes from queue on success
   ↓
Retries with backoff on failure
```

### Manual Sync
```
User clicks "Sync Now"
   ↓
App calls processSyncQueue()
   ↓
Fetches all queued requests
   ↓
Sends to server sequentially
   ↓
Removes on success
   ↓
Retries on 5xx error
   ↓
Shows user sync result
```

---

## 📊 Database Schema (IndexedDB)

### pending-workouts Store
```json
{
  "id": 1,
  "data": {
    "name": "Tuesday Swim",
    "duration": 60,
    "distance": 2000
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### pending-times Store
```json
{
  "id": 2,
  "data": {
    "athlete_id": "uuid",
    "distance": 100,
    "stroke": "free",
    "mm": 1,
    "ss": 5,
    "cc": 42
  },
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### sync-queue Store
```json
{
  "id": 3,
  "method": "POST",
  "url": "/api/v1/times",
  "data": { /* payload */ },
  "timestamp": 1705317000000,
  "retries": 0,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## 🎨 Offline UI Indicators

### Offline Banner
```typescript
{!isOnline && (
  <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 p-4">
    📡 You are offline. Changes will be synced when online.
    {pendingSyncCount > 0 && (
      <span className="ml-4">{pendingSyncCount} pending changes</span>
    )}
  </div>
)}
```

### Sync Status
```typescript
<div className="text-sm text-gray-600">
  {isOnline ? (
    <>✅ Online</>
  ) : (
    <>📡 Offline ({pendingSyncCount} pending)</>
  )}
</div>
```

---

## 🚀 Deployment Checklist

- ✅ Service Worker files `/public/sw.js` deployed
- ✅ Offline page `/public/offline.html` accessible
- ✅ Manifest `/public/manifest.json` linked in HTML
- ✅ HTTPS enabled (required for SW)
- ✅ Cache-Control headers configured
- ✅ IndexedDB quota adequate (typically 50MB+)
- ✅ App icons all sizes available
- ✅ Splash screen images provided

---

## 📚 Key Technologies

- **Service Worker API** - Background tasks, caching
- **Sync API** - Background sync when online
- **IndexedDB** - Local data storage
- **Web App Manifest** - Installation metadata
- **Push API** - Notifications
- **React Hooks** - Easy integration in components

---

## ⚠️ Common Issues & Solutions

### Problem: SW not caching
- **Solution:** Check HTTPS enabled, check cache storage quota

### Problem: Sync not working
- **Solution:** Check Sync API support, enable background sync permission

### Problem: Old data shown offline
- **Solution:** Cache TTL might be too long, add cache busting

### Problem: Conflicts when syncing
- **Solution:** Implement last-write-wins strategy with timestamps

---

## 🔗 Resources

- [Service Workers MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

---

**Ready for Phase 11-12: Production Deployment!** 🚀
