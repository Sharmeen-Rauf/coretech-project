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
  idField = "id"
): any[] {
  const localItems = getLocalItems(key);
  const filteredLocal = filterFn ? localItems.filter(filterFn) : localItems;
  
  // Merge items. Items in DB take precedence, but if a local item with same ID exists,
  // we check if it is already present in DB. If not, append it.
  const merged = [...dbItems];
  
  filteredLocal.forEach((local) => {
    const exists = dbItems.some((db) => db[idField] === local[idField]);
    if (!exists) {
      merged.push(local);
    }
  });

  return merged;
}
