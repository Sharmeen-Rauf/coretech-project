export interface GridTile {
  key: string;
  label: string;
  title: string;
}

// Every mobileEligible permission except SN Lookup and Target lives in the
// Home icon grid, permanently - those two are the only bottom-bar slots
// and can never appear here too, in either direction (§12.1's "no
// cross-over"). Mirrors lib/permissionCatalog.ts's mobileEligible list on
// the web side exactly - keep the two in sync if that list ever changes.
// Real screens land in Phase 6; each tile pushes a placeholder for now.
export const GRID_TILES: GridTile[] = [
  { key: "sales.sellout", label: "Sell Out", title: "Sell Out" },
  { key: "sales.st1", label: "ST1", title: "ST1 (View Only)" },
  { key: "sales.st2", label: "ST2", title: "ST2" },
  { key: "purchase.inventory", label: "Inventory", title: "Inventory" },
  { key: "users.dealer_assignment", label: "Sub Dealer List", title: "Sub Dealer List" },
  { key: "users.add_distributor", label: "Distributor View", title: "Distributor View" },
  { key: "users.add_sub_dealer", label: "Sub-Dealer View", title: "Sub-Dealer View" },
  { key: "buzzcart", label: "Buzzcart", title: "Buzzcart" },
];

// The two conditional bottom-bar slots (§12.1) - Home and Account are
// universal and need no key.
export const SN_LOOKUP_KEY = "sn_lookup";
export const TARGET_KEY = "resources";
