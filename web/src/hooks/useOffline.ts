/**
 * React hook for offline functionality
 */
import { useState, useEffect, useCallback } from 'react';
import {
  isOffline,
  onlineStatusListener,
  getPendingSyncCount,
  processSyncQueue,
  getOfflineStats,
} from '@/lib/offline';

interface OfflineStats {
  pendingWorkouts: number;
  pendingTimes: number;
  syncQueue: number;
  isOnline: boolean;
}

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [stats, setStats] = useState<OfflineStats | null>(null);

  // Set initial online status
  useEffect(() => {
    setIsOnline(!isOffline());
  }, []);

  // Listen for online/offline changes
  useEffect(() => {
    const unsubscribe = onlineStatusListener((online) => {
      setIsOnline(online);
      if (online) {
        // Trigger sync when coming online
        processSyncQueue().catch(console.error);
      }
    });

    return unsubscribe;
  }, []);

  // Update pending sync count
  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function updateCounts() {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);

      const offlineStats = await getOfflineStats();
      setStats(offlineStats);
    }

    updateCounts();
    interval = setInterval(updateCounts, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const manualSync = useCallback(async () => {
    if (!isOnline) {
      console.warn('Cannot sync while offline');
      return;
    }

    try {
      await processSyncQueue();
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }, [isOnline]);

  return {
    isOnline,
    isOffline: !isOnline,
    pendingSyncCount,
    stats,
    manualSync,
  };
}

/**
 * Hook to queue requests for offline retry
 */
export function useOfflineQueue() {
  const { isOnline } = useOfflineStatus();

  const queueRequest = useCallback(
    async (method: string, url: string, data?: any) => {
      if (isOnline) {
        // Make request directly if online
        return fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: data ? JSON.stringify(data) : undefined,
        });
      }

      // Queue for offline retry
      const { queueRequest: queue } = await import('@/lib/offline');
      await queue(method, url, data);
      return { ok: true, status: 202 };
    },
    [isOnline]
  );

  return { queueRequest };
}
