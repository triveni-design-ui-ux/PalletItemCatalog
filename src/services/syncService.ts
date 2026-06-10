import NetInfo from "@react-native-community/netinfo";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { cacheService } from "./cacheService";
import { fetchAllItemsFromApi, type ItemCatalogItem } from "./itemApi";

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

export const isOnline = async () => {
  const state = await NetInfo.fetch();

  return Boolean(state.isConnected && state.isInternetReachable !== false);
};

export const syncService = {
  syncIfNeeded: async (options: { force?: boolean } = {}): Promise<SyncResult> => {
    const cache = cacheService.load();
    const online = await isOnline();

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

    if (!options.force && !cacheService.isSyncRequired(cache)) {
      return {
        items: cache.items,
        changed: false,
        lastSyncAt: cache.lastSyncAt,
        fromCache: true,
        message: null,
      };
    }

    const apiItems = await fetchAllItemsFromApi();
    const changed = haveItemsChanged(cache.items, apiItems);
    const syncedAt = Date.now();

    itemStorage.setLastSyncAt(syncedAt);

    if (changed) {
      itemStorage.setItems(apiItems);
    }

    return {
      items: changed ? apiItems : cache.items,
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
    await syncService.syncIfNeeded();

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.log("Item catalog background sync failed:", error);

    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
