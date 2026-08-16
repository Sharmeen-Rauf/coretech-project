"use client";

// Client-side local storage fallback utility to ensure 100% functionality
// even if database tables are missing or RLS (Row-Level Security) policies block writes.

export function getLocalItems(key: string): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Failed to load local items for key "${key}":`, e);
    return [];
  }
}

export function saveLocalItem(key: string, item: any, isEdit = false, idField = "id"): any {
  if (typeof window === "undefined") return item;
  try {
    const items = getLocalItems(key);
    let finalItem = { ...item };

    if (isEdit) {
      const idx = items.findIndex((x: any) => x[idField] === item[idField]);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...item };
        finalItem = items[idx];
      } else {
        items.push(item);
      }
    } else {
      if (!item[idField]) {
        // Ensure UUID or unique key exists
        finalItem[idField] = typeof crypto !== "undefined" && crypto.randomUUID 
          ? crypto.randomUUID() 
          : "local_" + Math.random().toString(36).substring(2, 11);
      }
      if (!finalItem.created_at) {
        finalItem.created_at = new Date().toISOString();
      }
      items.push(finalItem);
    }

    localStorage.setItem(key, JSON.stringify(items));
    return finalItem;
  } catch (e) {
    console.error(`Failed to save local item for key "${key}":`, e);
    return item;
  }
}

export function mergeLocalItems(
  dbItems: any[],
  key: string,
  filterFn?: (item: any) => boolean,
  idField = "id",
  extraDedupField?: string
): any[] {
  const localItems = getLocalItems(key);
  const filteredLocal = filterFn ? localItems.filter(filterFn) : localItems;

  // Merge items. Items in DB take precedence, but if a local item with same ID exists,
  // we check if it is already present in DB. If not, append it.
  //
  // extraDedupField covers the case where a real DB row now exists for something
  // that previously only made it as far as the local fallback (e.g. an order that
  // failed its DB insert and got saved locally, then succeeded on a later retry -
  // the two copies have different generated IDs but the same order_code). Without
  // this, the stale local copy would linger forever, showing outdated status.
  const isDuplicate = (local: any) =>
    dbItems.some((db) => {
      if (db[idField] === local[idField]) return true;
      if (extraDedupField && local[extraDedupField] && db[extraDedupField] === local[extraDedupField]) return true;
      return false;
    });

  const merged = [...dbItems];
  const staleLocalIds: any[] = [];

  filteredLocal.forEach((local) => {
    if (isDuplicate(local)) {
      staleLocalIds.push(local[idField]);
    } else {
      merged.push(local);
    }
  });

  // Prune confirmed-stale local copies so they don't need re-filtering forever.
  if (staleLocalIds.length > 0 && typeof window !== "undefined") {
    try {
      const allLocal = getLocalItems(key);
      const pruned = allLocal.filter((item: any) => !staleLocalIds.includes(item[idField]));
      localStorage.setItem(key, JSON.stringify(pruned));
    } catch (e) {
      console.error(`Failed to prune stale local items for key "${key}":`, e);
    }
  }

  return merged;
}

export function deleteLocalItem(key: string, id: string, idField = "id"): void {
  if (typeof window === "undefined") return;
  try {
    const items = getLocalItems(key);
    const updatedItems = items.filter((item: any) => item[idField] !== id);
    localStorage.setItem(key, JSON.stringify(updatedItems));
  } catch (e) {
    console.error(`Failed to delete local item for key "${key}":`, e);
  }
}
