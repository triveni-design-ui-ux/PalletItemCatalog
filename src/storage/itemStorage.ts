import { createMMKV, type MMKV } from "react-native-mmkv";

import type { ItemCatalogItem } from "@/services/itemApi";

const ITEMS_KEY = "item-catalog.items";
const LAST_SYNC_KEY = "item-catalog.last-sync";
const SYNC_INTERVAL_KEY = "item-catalog.sync-interval";

export const syncIntervals = [15, 30, 60] as const;
export type SyncIntervalMinutes = (typeof syncIntervals)[number];

export interface ItemCacheSnapshot {
  items: ItemCatalogItem[];
  lastSyncAt: number | null;
  syncIntervalMinutes: SyncIntervalMinutes;
}

// createMMKV is the v4 factory — `new MMKV()` was removed in react-native-mmkv v4
const storage: MMKV = createMMKV({
  id: "item-catalog-storage",
  compareBeforeSet: true, // skip disk write if value is unchanged
});

const DEFAULT_SYNC_INTERVAL: SyncIntervalMinutes = 15;

const isSyncInterval = (value: number): value is SyncIntervalMinutes =>
  syncIntervals.includes(value as SyncIntervalMinutes);

const safeParseItems = (rawItems?: string): ItemCatalogItem[] => {
  if (!rawItems) return [];

  try {
    const parsed = JSON.parse(rawItems);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const itemStorage = {
  getItems: () => safeParseItems(storage.getString(ITEMS_KEY)),

  setItems: (items: ItemCatalogItem[]) => {
    storage.set(ITEMS_KEY, JSON.stringify(items));
  },

  getLastSyncAt: () => {
    const value = storage.getNumber(LAST_SYNC_KEY);

    return typeof value === "number" && Number.isFinite(value) ? value : null;
  },

  setLastSyncAt: (timestamp: number) => {
    storage.set(LAST_SYNC_KEY, timestamp);
  },

  getSyncIntervalMinutes: (): SyncIntervalMinutes => {
    // getNumber returns number | undefined in v4; narrow before returning
    const value = storage.getNumber(SYNC_INTERVAL_KEY);
    const num = value ?? 0;

    return isSyncInterval(num) ? num : DEFAULT_SYNC_INTERVAL;
  },

  setSyncIntervalMinutes: (minutes: SyncIntervalMinutes) => {
    storage.set(SYNC_INTERVAL_KEY, minutes);
  },

  getSnapshot: (): ItemCacheSnapshot => ({
    items: safeParseItems(storage.getString(ITEMS_KEY)),
    lastSyncAt: itemStorage.getLastSyncAt(),
    syncIntervalMinutes: itemStorage.getSyncIntervalMinutes(),
  }),

  clear: () => {
    // v4 renamed delete() → remove()
    storage.remove(ITEMS_KEY);
    storage.remove(LAST_SYNC_KEY);
  },
};

/**
 * On native, storage is synchronous (MMKV) so no boot promise is needed.
 * Exported as `undefined` so the shared import in useItems.ts compiles on
 * both platforms. The web variant (itemStorage.web.ts) exports a real Promise.
 */
export const itemStorageWebReady: Promise<void> | undefined = undefined;

