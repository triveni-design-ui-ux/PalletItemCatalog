import NetInfo from "@react-native-community/netinfo";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { cacheService } from "./cacheService";
import {
  fetchAllItemsFromApi,
  fetchIncrementalItemsFromApi,
  isVisibleItem,
  type ItemCatalogItem,
} from "./itemApi";

import { itemStorage, type SyncIntervalMinutes } from "@/storage/itemStorage";

export const ITEM_CATALOG_BACKGROUND_SYNC_TASK =
  "item-catalog-background-sync";

export interface SyncResult {
  items: ItemCatalogItem[];
  changed: boolean;
  lastSyncAt: number | null;
  fromCache: boolean;
  message: string | null;
}

/** Returns a stable string ID for an item used as a Map key. */
const getItemStableId = (item: ItemCatalogItem, index: number) =>
  String(item.id ?? item.itemId ?? item.identity?.itemCode ?? index);

const createItemsFingerprint = (items: ItemCatalogItem[]) =>
  JSON.stringify(
    items.map((item, index) => ({
      id: getItemStableId(item, index),
      name: item.identity?.itemName ?? null,
      code: item.identity?.itemCode ?? null,
      category: item.categoryTax?.primaryCategoryName ?? null,
      subCategory: item.categoryTax?.secondaryCategoryName ?? null,
      price: item.pricing?.sellingPrice ?? null,
      imageURL: item.image?.imageURL ?? null,
      imagePath: item.image?.imagePath ?? null,
    })),
  );

export const haveItemsChanged = (
  currentItems: ItemCatalogItem[],
  nextItems: ItemCatalogItem[],
) => {
  if (currentItems.length !== nextItems.length) return true;

  return createItemsFingerprint(currentItems) !== createItemsFingerprint(nextItems);
};

/**
 * FULL SYNC merge — replaces the existing catalog with the new API result.
 * Simply checks whether anything actually changed so we avoid unnecessary writes.
 */
export const mergeFullSync = (
  existingItems: ItemCatalogItem[],
  apiItems: ItemCatalogItem[],
): { merged: ItemCatalogItem[]; changed: boolean } => {
  const changed = haveItemsChanged(existingItems, apiItems);
  return { merged: apiItems, changed };
};

/**
 * INCREMENTAL merge — applies only the changes returned by the API
 * (items modified since `updateDate`).
 *
 * Rules:
 *  • Visible item not in cache   → ADD
 *  • Visible item already cached → UPDATE if any field changed
 *  • Invisible item (isDeleted / !isActive) in cache → REMOVE (handles deletes)
 *  • Invisible item not in cache → ignore
 *
 * The incoming list must NOT be pre-filtered — it must include
 * deleted/inactive items so we can remove them from the cache.
 */
export const mergeItemsIncremental = (
  existingItems: ItemCatalogItem[],
  incomingItems: ItemCatalogItem[],
): { merged: ItemCatalogItem[]; changed: boolean } => {
  // Build map keyed by stable ID
  const itemMap = new Map<string, ItemCatalogItem>();
  existingItems.forEach((item, index) => {
    itemMap.set(getItemStableId(item, index), item);
  });

  let changed = false;

  incomingItems.forEach((incomingItem) => {
    // Use index=0 fallback — real items always have id/itemId/itemCode
    const id = getItemStableId(incomingItem, 0);

    if (!isVisibleItem(incomingItem)) {
      // Item was deleted or deactivated — remove from local catalog
      if (itemMap.has(id)) {
        itemMap.delete(id);
        changed = true;
      }
      return;
    }

    const existing = itemMap.get(id);

    if (!existing) {
      // New item
      itemMap.set(id, incomingItem);
      changed = true;
    } else {
      // Update if anything changed (price, name, image, etc.)
      if (JSON.stringify(existing) !== JSON.stringify(incomingItem)) {
        itemMap.set(id, incomingItem);
        changed = true;
      }
    }
  });

  return { merged: Array.from(itemMap.values()), changed };
};

export const isOnline = async () => {
  const state = await NetInfo.fetch();

  return Boolean(state.isConnected && state.isInternetReachable !== false);
};

export const syncService = {
  syncIfNeeded: async (options: { force?: boolean } = {}): Promise<SyncResult> => {
    const cache = cacheService.load();
    const online = await isOnline();

    // ── Offline: serve from cache ──────────────────────────────────────────
    if (!online) {
      return {
        items: cache.items,
        changed: false,
        lastSyncAt: cache.lastSyncAt,
        fromCache: true,
        message: cache.items.length
          ? "Showing cached data"
          : "No internet connection and no cached data available",
      };
    }

    // ── Not due yet (and not forced): skip ────────────────────────────────
    if (!options.force && !cacheService.isSyncRequired(cache)) {
      return {
        items: cache.items,
        changed: false,
        lastSyncAt: cache.lastSyncAt,
        fromCache: true,
        message: null,
      };
    }

    const syncedAt = Date.now();
    const isFirstSync = !cache.lastSyncAt || cache.items.length === 0;

    let merged: ItemCatalogItem[];
    let changed: boolean;

    if (isFirstSync) {
      // ── FULL SYNC ──────────────────────────────────────────────────────
      // Do NOT send updateDate → API returns the complete item catalog.
      // This is used on first launch.
      const apiItems = await fetchAllItemsFromApi();
      ({ merged, changed } = mergeFullSync(cache.items, apiItems));
    } else {
      // ── INCREMENTAL SYNC ───────────────────────────────────────────────
      // Send updateDate (last sync date) → API returns only items changed
      // since that date: price updates, new items, deletions, etc.
      // The result is NOT pre-filtered so deleted items are included and
      // can be removed from the local cache by mergeItemsIncremental.
      const incomingItems = await fetchIncrementalItemsFromApi(cache.lastSyncAt!);
      ({ merged, changed } = mergeItemsIncremental(cache.items, incomingItems));
    }

    // Persist timestamp always; persist items only when they changed.
    itemStorage.setLastSyncAt(syncedAt);

    if (changed) {
      itemStorage.setItems(merged);
    }

    return {
      items: changed ? merged : cache.items,
      changed,
      lastSyncAt: syncedAt,
      fromCache: false,
      message: null,
    };
  },

  registerBackgroundSync: async (intervalMinutes?: SyncIntervalMinutes) => {
    // BackgroundTask.registerTaskAsync expects minimumInterval in SECONDS
    const interval = intervalMinutes ?? itemStorage.getSyncIntervalMinutes();
    const intervalSeconds = interval * 60;

    try {
      const status = await BackgroundTask.getStatusAsync();

      if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
        return false;
      }

      await BackgroundTask.registerTaskAsync(ITEM_CATALOG_BACKGROUND_SYNC_TASK, {
        minimumInterval: intervalSeconds,
      });

      return true;
    } catch (error) {
      // Not supported in all environments (web, some simulators)
      console.log("Background sync registration skipped:", error);
      return false;
    }
  },
};

TaskManager.defineTask(ITEM_CATALOG_BACKGROUND_SYNC_TASK, async () => {
  try {
    // Background task always runs as incremental (not forced)
    await syncService.syncIfNeeded({ force: false });

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.log("Item catalog background sync failed:", error);

    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
