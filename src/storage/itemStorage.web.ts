/**
 * Web-specific storage for the item catalog.
 *
 * react-native-mmkv falls back to localStorage on web, which has a ~5 MB
 * quota. With thousands of items the JSON payload easily exceeds that limit
 * and throws "exceeded the quota".
 *
 * This module is picked up automatically by Metro / Expo's platform-specific
 * file resolution (*.web.ts wins over *.ts on web).
 *
 * Strategy:
 *   • Items  → IndexedDB  (gigabytes of quota, async)
 *   • Scalars (lastSyncAt, syncInterval) → localStorage  (fast, synchronous)
 *
 * The public API mirrors itemStorage.ts exactly so the rest of the codebase
 * works without any changes.
 */

import type { ItemCatalogItem } from "@/services/itemApi";

// ─── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = "item-catalog-db";
const DB_VERSION = 1;
const STORE_NAME = "items";

const LS_LAST_SYNC_KEY = "item-catalog.last-sync";
const LS_SYNC_INTERVAL_KEY = "item-catalog.sync-interval";

export const syncIntervals = [15, 30, 60] as const;
export type SyncIntervalMinutes = (typeof syncIntervals)[number];

export interface ItemCacheSnapshot {
  items: ItemCatalogItem[];
  lastSyncAt: number | null;
  syncIntervalMinutes: SyncIntervalMinutes;
}

// ─── In-memory cache (so reads after the first IDB load are synchronous) ──────

let memoryItems: ItemCatalogItem[] = [];
let dbReady = false;

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key: string): Promise<ItemCatalogItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: ItemCatalogItem[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── localStorage helpers (small scalars only) ────────────────────────────────

const isSyncInterval = (value: number): value is SyncIntervalMinutes =>
  syncIntervals.includes(value as SyncIntervalMinutes);

const DEFAULT_SYNC_INTERVAL: SyncIntervalMinutes = 15;

function lsGetNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function lsSetNumber(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // ignore — scalar writes are tiny and should never fail
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ─── Bootstrap: pre-load items from IDB into memory on first import ───────────

const _boot = idbGet(STORE_NAME)
  .then((items) => {
    memoryItems = items;
    dbReady = true;
  })
  .catch(() => {
    memoryItems = [];
    dbReady = true;
  });

// ─── Public API (mirrors itemStorage.ts) ─────────────────────────────────────

export const itemStorage = {
  /** Synchronous — returns the in-memory snapshot loaded at boot. */
  getItems: (): ItemCatalogItem[] => memoryItems,

  /** Writes to both the in-memory cache and IndexedDB (async, fire-and-forget). */
  setItems: (items: ItemCatalogItem[]): void => {
    memoryItems = items;
    // Write to IDB asynchronously — don't block the caller
    idbSet(STORE_NAME, items).catch((err) => {
      console.warn("[itemStorage.web] Failed to persist items to IndexedDB:", err);
    });
  },

  getLastSyncAt: (): number | null => {
    const value = lsGetNumber(LS_LAST_SYNC_KEY);
    return value !== null && Number.isFinite(value) ? value : null;
  },

  setLastSyncAt: (timestamp: number): void => {
    lsSetNumber(LS_LAST_SYNC_KEY, timestamp);
  },

  getSyncIntervalMinutes: (): SyncIntervalMinutes => {
    const value = lsGetNumber(LS_SYNC_INTERVAL_KEY);
    const num = value ?? 0;
    return isSyncInterval(num) ? num : DEFAULT_SYNC_INTERVAL;
  },

  setSyncIntervalMinutes: (minutes: SyncIntervalMinutes): void => {
    lsSetNumber(LS_SYNC_INTERVAL_KEY, minutes);
  },

  getSnapshot: (): ItemCacheSnapshot => ({
    items: memoryItems,
    lastSyncAt: itemStorage.getLastSyncAt(),
    syncIntervalMinutes: itemStorage.getSyncIntervalMinutes(),
  }),

  clear: (): void => {
    memoryItems = [];
    lsRemove(LS_LAST_SYNC_KEY);
    idbDelete(STORE_NAME).catch(() => {});
  },
};

// Export the boot promise so callers can optionally await IDB hydration
export { _boot as itemStorageWebReady };
