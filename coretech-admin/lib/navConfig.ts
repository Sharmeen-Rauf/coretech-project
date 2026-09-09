export interface GridTile {
  key: string;
  label: string;
  route: string;
  // lucide-react-native icon name - matches the group icon used for the
  // same key in the web app's lib/permissionCatalog.ts, so the two apps
  // read as the same product family.
  icon: string;
}

// Every mobileEligible permission except SN Lookup and Target lives in the
// Home icon grid, permanently - those two are the only bottom-bar slots
// and can never appear here too, in either direction (§12.1's "no
// cross-over"). Mirrors lib/permissionCatalog.ts's mobileEligible list on
// the web side exactly - keep the two in sync if that list ever changes.
export const GRID_TILES: GridTile[] = [
  { key: "sales.sellout", label: "Sell Out", route: "/screens/sell-out", icon: "TrendingUp" },
  { key: "sales.st1", label: "ST1", route: "/screens/st1", icon: "TrendingUp" },
  { key: "sales.st2", label: "ST2", route: "/screens/st2", icon: "TrendingUp" },
  { key: "purchase.inventory", label: "Inventory", route: "/screens/inventory", icon: "ShoppingCart" },
  { key: "users.dealer_assignment", label: "Sub Dealer List", route: "/screens/sub-dealers", icon: "Users" },
  { key: "users.add_distributor", label: "Distributor View", route: "/screens/directory?type=distributor", icon: "Users" },
  { key: "users.add_sub_dealer", label: "Sub-Dealer View", route: "/screens/directory?type=sub_dealer", icon: "Users" },
  { key: "buzzcart", label: "Buzzcart", route: "/screens/buzzcart", icon: "ShoppingBag" },
];

// The two conditional bottom-bar slots (§12.1) - Home and Account are
// universal and need no key.
export const SN_LOOKUP_KEY = "sn_lookup";
export const TARGET_KEY = "resources";
