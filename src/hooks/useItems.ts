import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cacheService } from "@/services/cacheService";
import {
  emptyFilters,
  filterItems,
  getCategoryFiltersFromItems,
  paginateItems,
  type FilterCategory,
  type ItemCatalogItem,
  type ItemFilters,
} from "@/services/itemApi";
import {
  syncService,
  type SyncResult,
} from "@/services/syncService";
import {
  syncIntervals,
  type SyncIntervalMinutes,
} from "@/storage/itemStorage";

// itemStorageWebReady is only exported by the .web.ts variant of itemStorage.
// On native it will be undefined, which is fine — we just skip the await.
import { itemStorageWebReady } from "@/storage/itemStorage";

export interface UseItemsState {
  allItems: ItemCatalogItem[];
  items: ItemCatalogItem[];
  filterCategories: FilterCategory[];
  totalRecords: number;
  loading: boolean;
  refreshing: boolean;
  syncing: boolean;
  isOffline: boolean;
  statusMessage: string | null;
  error: string | null;
  lastSyncAt: number | null;
  syncIntervalMinutes: SyncIntervalMinutes;
  syncIntervals: readonly SyncIntervalMinutes[];
  setSyncIntervalMinutes: (minutes: SyncIntervalMinutes) => void;
  refresh: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 20;

interface UseItemsOptions {
  searchQuery?: string;
  filters?: ItemFilters;
  page?: number;
  pageSize?: number;
}

export const useItems = ({
  searchQuery = "",
  filters = emptyFilters,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseItemsOptions = {}): UseItemsState => {
  const requestIdRef = useRef(0);

  // Ref keeps latest allItems count accessible inside the NetInfo closure
  // without triggering re-subscription on every render.
  const allItemsCountRef = useRef(0);

  // Track whether we were previously offline so we can trigger a sync on
  // reconnect without an extra useEffect dependency.
  const wasOfflineRef = useRef(false);

  const [allItems, setAllItems] = useState<ItemCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncIntervalMinutes, setSyncIntervalMinutesState] =
    useState<SyncIntervalMinutes>(15);

  // Keep the ref in sync with state so the NetInfo listener always reads fresh
  useEffect(() => {
    allItemsCountRef.current = allItems.length;
  }, [allItems.length]);

  const applySyncResult = useCallback((result: SyncResult) => {
    setLastSyncAt(result.lastSyncAt);
    setStatusMessage(result.message);

    if (result.changed) {
      setAllItems(result.items);
    }
  }, []);

  const sync = useCallback(
    async (force = false) => {
      const requestId = ++requestIdRef.current;

      try {
        setError(null);
        setSyncing(true);

        const result = await syncService.syncIfNeeded({ force });

        if (requestId !== requestIdRef.current) return;

        applySyncResult(result);
      } catch (syncError) {
        if (requestId !== requestIdRef.current) return;

        setError(
          syncError instanceof Error ? syncError.message : "Failed to sync items",
        );
      } finally {
        if (requestId !== requestIdRef.current) return;

        setSyncing(false);
      }
    },
    [applySyncResult],
  );

  // On mount: load cache immediately, register background sync, then sync if needed.
  useEffect(() => {
    // On web, itemStorage uses IndexedDB which is async. We wait for the
    // optional boot promise (only exported by itemStorage.web.ts) before
    // reading the cache so we don't get an empty in-memory snapshot on first load.
    const boot: Promise<void> = itemStorageWebReady ?? Promise.resolve();

    boot.then(() => {
      const cached = cacheService.load();

      setAllItems(cached.items);
      setLastSyncAt(cached.lastSyncAt);
      setSyncIntervalMinutesState(cached.syncIntervalMinutes);
      setLoading(false);

      if (cached.items.length) {
        setStatusMessage(null);
      }

      syncService.registerBackgroundSync(cached.syncIntervalMinutes).catch(
        (backgroundError) => {
          console.log("Failed to register item background sync:", backgroundError);
        },
      );

      sync(false);
    });
  }, [sync]);

  // Listen to network changes.
  // - Update isOffline state and status message.
  // - Trigger a foreground sync when coming back online.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );

      setIsOffline(!online);

      if (!online) {
        wasOfflineRef.current = true;
        setStatusMessage(
          allItemsCountRef.current
            ? "Showing cached data"
            : "No internet connection and no cached data available",
        );
      } else if (wasOfflineRef.current) {
        // Just came back online — clear the offline message and re-sync.
        wasOfflineRef.current = false;
        setStatusMessage(null);
        sync(false);
      }
    });

    return unsubscribe;
  }, [sync]);

  // Search + filter — operates entirely on local allItems, zero API calls.
  const filteredItems = useMemo(
    () => filterItems(allItems, searchQuery, filters),
    [allItems, filters, searchQuery],
  );

  // Windowed pagination from the filtered list (virtual pagination, all data in memory).
  const paginated = useMemo(
    () => paginateItems(filteredItems, pageSize * page, 1),
    [filteredItems, page, pageSize],
  );

  const filterCategories = useMemo(
    () => getCategoryFiltersFromItems(allItems),
    [allItems],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await sync(true);
    } finally {
      setRefreshing(false);
    }
  }, [sync]);

  const setSyncIntervalMinutes = useCallback(
    (minutes: SyncIntervalMinutes) => {
      const snapshot = cacheService.setSyncInterval(minutes);

      setSyncIntervalMinutesState(snapshot.syncIntervalMinutes);
      syncService.registerBackgroundSync(minutes).catch((backgroundError) => {
        console.log("Failed to update item background sync:", backgroundError);
      });
    },
    [],
  );

  return {
    allItems,
    items: paginated.data,
    filterCategories,
    totalRecords: filteredItems.length,
    loading,
    refreshing,
    syncing,
    isOffline,
    statusMessage,
    error,
    lastSyncAt,
    syncIntervalMinutes,
    syncIntervals,
    setSyncIntervalMinutes,
    refresh,
  };
};
