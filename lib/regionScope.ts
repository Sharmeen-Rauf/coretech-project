// Shared "Region" scope resolver for Sales (ST-1, ST-2, Return, Transfer, Sell
// Out). Confirmed rule (ROLE-MANAGEMENT-PLAN.md, "Sales region-scoping"): a
// caller sees a transaction under Region scope if AT LEAST ONE side (source or
// destination) resolves to their own region - not both. One shared helper so
// every sub-tab resolves "which region does this transaction touch" the same
// way; a per-page reimplementation is exactly how the sub-tabs could end up
// silently disagreeing with each other for the same manager.
//
// A party's region resolves from two places, matching how the data actually
// exists today (checked live 2026-08-19):
// - warehouse -> regions.warehouse (1:1, always defined for every real warehouse)
// - distributor / sub_dealer -> that profile's own `region` column (already
//   populated for every existing distributor/sub-dealer - see plan doc)
// "consumer" (Sell Out's destination) and any party with no id never resolve to
// a region - they just don't count toward either side of the match.

export type SalesPartyType = "warehouse" | "distributor" | "sub_dealer" | "consumer" | string | null | undefined;

export interface PartyRef {
  type: SalesPartyType;
  id?: string | null; // profile id (distributor/sub_dealer) or warehouses.id (warehouse)
  warehouseName?: string | null; // used when only the warehouse's name is on hand (e.g. stock.warehouse_name), not its id
}

// Resolves every distinct party referenced across a batch of rows in one pass
// (a handful of `.in()` queries total) instead of one lookup per row.
export async function buildPartyRegionMap(supabase: any, parties: PartyRef[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const warehouseIds = Array.from(new Set(parties.filter((p) => p.type === "warehouse" && p.id).map((p) => p.id as string)));
  const directWarehouseNames = Array.from(
    new Set(parties.filter((p) => p.type === "warehouse" && !p.id && p.warehouseName).map((p) => p.warehouseName as string))
  );
  const profileIds = Array.from(
    new Set(parties.filter((p) => (p.type === "distributor" || p.type === "sub_dealer") && p.id).map((p) => p.id as string))
  );

  const namesToResolve = new Set<string>(directWarehouseNames);
  const warehouseNameById = new Map<string, string>();

  if (warehouseIds.length > 0) {
    const { data: warehouses } = await supabase.from("warehouses").select("id, name").in("id", warehouseIds);
    (warehouses || []).forEach((w: any) => {
      if (w.name) {
        warehouseNameById.set(w.id, w.name);
        namesToResolve.add(w.name);
      }
    });
  }

  if (namesToResolve.size > 0) {
    // Select `name`, not `region_code` - `profiles.region` (the value a
    // distributor/sub_dealer/RSM's own region is stored as) holds the region's
    // display name (e.g. "SOUTH 1"), not its short code (e.g. "STH1"). Matching
    // a warehouse's resolved region_code against that would never match, even
    // for the same real region - caught via a live end-to-end test 2026-08-19.
    const { data: regions } = await supabase.from("regions").select("name, warehouse").in("warehouse", Array.from(namesToResolve));

    // A warehouse is NOT always 1:1 with a region - e.g. live data has one
    // warehouse (Karachi Korangi) fulfilling 4 separate regions at once. When a
    // warehouse serves more than one region, which one a given transaction
    // "belongs to" isn't derivable from the warehouse alone - leave it
    // unresolved (never wrongly matched) rather than silently picking one region
    // arbitrarily, which is worse than not resolving it at all. Caught via a
    // live end-to-end test 2026-08-19 - see ROLE-MANAGEMENT-PLAN.md.
    const namesByWarehouse = new Map<string, Set<string>>();
    (regions || []).forEach((r: any) => {
      if (!r.warehouse || !r.name) return;
      if (!namesByWarehouse.has(r.warehouse)) namesByWarehouse.set(r.warehouse, new Set());
      namesByWarehouse.get(r.warehouse)!.add(r.name);
    });
    const regionByWarehouseName = new Map<string, string>();
    namesByWarehouse.forEach((names, warehouseName) => {
      if (names.size === 1) regionByWarehouseName.set(warehouseName, Array.from(names)[0]);
    });
    warehouseIds.forEach((id) => {
      const name = warehouseNameById.get(id);
      const region = name ? regionByWarehouseName.get(name) : null;
      if (region) map.set(`warehouse_id:${id}`, region);
    });
    directWarehouseNames.forEach((name) => {
      const region = regionByWarehouseName.get(name);
      if (region) map.set(`warehouse_name:${name}`, region);
    });
  }

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, region").in("id", profileIds);
    (profiles || []).forEach((p: any) => {
      if (p.region) map.set(`profile:${p.id}`, p.region);
    });
  }

  return map;
}

export function regionForParty(map: Map<string, string>, party: PartyRef): string | null {
  if (party.type === "warehouse") {
    if (party.id) return map.get(`warehouse_id:${party.id}`) || null;
    if (party.warehouseName) return map.get(`warehouse_name:${party.warehouseName}`) || null;
    return null;
  }
  if (party.type === "distributor" || party.type === "sub_dealer") {
    return party.id ? map.get(`profile:${party.id}`) || null : null;
  }
  return null; // "consumer" or anything unrecognized never has a region
}

export function regionsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
