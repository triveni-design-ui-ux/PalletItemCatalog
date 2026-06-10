import { itemStorage, type SyncIntervalMinutes } from "@/storage/itemStorage";

import type { ItemCatalogItem } from "./itemApi";

export interface CacheState {
  items: ItemCatalogItem[];
  lastSyncAt: number | null;
  syncIntervalMinutes: SyncIntervalMinutes;
}

export const cacheService = {
  load: (): CacheState => itemStorage.getSnapshot(),

  saveItems: (items: ItemCatalogItem[], syncedAt = Date.now()) => {
    itemStorage.setItems(items);
    itemStorage.setLastSyncAt(syncedAt);

    return itemStorage.getSnapshot();
  },

  isSyncRequired: (state: CacheState, now = Date.now()) => {
    if (state.items.length === 0) return true;
    if (!state.lastSyncAt) return true;

    const intervalMs = state.syncIntervalMinutes * 60 * 1000;

    return now - state.lastSyncAt >= intervalMs;
  },

  setSyncInterval: (minutes: SyncIntervalMinutes) => {
    itemStorage.setSyncIntervalMinutes(minutes);

    return itemStorage.getSnapshot();
  },
};
