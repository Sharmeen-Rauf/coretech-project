// Single source of truth for every dashboard tab/sub-tab that Role Management can
// grant or revoke. Sidebar.tsx, middleware.ts, and the Role Management UI all read
// from this same list so they can never drift out of sync with each other - the
// exact problem CLAUDE.md flags about the old hardcoded Sidebar/middleware pair.
//
// `route` is what middleware.ts matches against `pathname.startsWith(route)`.
// Items sharing a route (all of `users.*`) can't be distinguished by middleware -
// only by the page itself, which independently guards its own query-param views.
//
// Home (`/dashboard`) and Account (`/dashboard/account`) are deliberately excluded -
// both are universal, unconditional for every authenticated role, never gated.

// Which scope levels a page's data-scoping actually enforces. Only add a level here
// once the page's fetch logic has real code behind it - an unenforced level in the
// UI would be a setting that silently does nothing, which is worse than not offering
// it at all. Defaults to ["everything"] (no scoping concept) when omitted.
export type ScopeLevel = "self" | "region" | "everything";

export interface PermissionItem {
  key: string;
  label: string;
  route: string;
  supportedScopes?: ScopeLevel[];
  // Whether this permission has any mobile screen at all - a code-level fact
  // set by whoever builds each mobile screen, not admin-editable. Role
  // Management's mobile column is greyed out/un-clickable for every item
  // where this is false, distinct from an admin simply not granting it.
  // Fixed list confirmed in notes/MOBILE-ADMIN-APP-PLAN.md §9/§14 - don't add
  // to this without a matching client decision recorded there.
  mobileEligible?: boolean;
  // Some mobileEligible permissions are "view only" as a hard app-level
  // design decision - no create/edit/delete screen is ever built for them on
  // mobile, regardless of mobile_can_write's stored value. Only meaningful
  // when mobileEligible is true; defaults to true (writable) otherwise.
  mobileWriteEligible?: boolean;
  // Overrides supportedScopes for mobile's own scope dropdown, when mobile
  // shouldn't offer every scope web does. Defaults to supportedScopes.
  mobileSupportedScopes?: ScopeLevel[];
}

export interface PermissionGroup {
  groupKey: string;
  groupLabel: string;
  icon: string; // lucide-react icon name, resolved by the consuming component
  items: PermissionItem[];
}

export const PERMISSION_CATALOG: PermissionGroup[] = [
  {
    groupKey: "product",
    groupLabel: "Product Catalog",
    icon: "Box",
    items: [{ key: "product", label: "Product Catalog", route: "/dashboard/product" }],
  },
  {
    groupKey: "purchase",
    groupLabel: "Purchase Management",
    icon: "ShoppingCart",
    items: [
      { key: "purchase.import_stock", label: "Import Stock", route: "/dashboard/purchase/import-stock" },
      { key: "purchase.inventory", label: "Inventory", route: "/dashboard/purchase/inventory", supportedScopes: ["self", "region", "everything"], mobileEligible: true },
      { key: "purchase.warehouse", label: "Warehouses", route: "/dashboard/purchase/warehouse" },
    ],
  },
  {
    groupKey: "region",
    groupLabel: "Region Management",
    icon: "MapPin",
    items: [{ key: "region", label: "Region Management", route: "/dashboard/region" }],
  },
  {
    groupKey: "sales",
    groupLabel: "Sales Management",
    icon: "TrendingUp",
    items: [
      // ST-1 is view-only on mobile everywhere it appears - no create/edit
      // screen is ever built for it there, regardless of mobile_can_write.
      { key: "sales.st1", label: "ST-1", route: "/dashboard/sales/st1", supportedScopes: ["self", "region", "everything"], mobileEligible: true, mobileWriteEligible: false },
      { key: "sales.st2", label: "ST-2", route: "/dashboard/sales/st2", supportedScopes: ["self", "region", "everything"], mobileEligible: true },
      { key: "sales.return", label: "Return", route: "/dashboard/sales/return", supportedScopes: ["self", "region", "everything"] },
      { key: "sales.transfer", label: "Transfer", route: "/dashboard/sales/transfer", supportedScopes: ["self", "region", "everything"] },
      { key: "sales.sellout", label: "Sell Out", route: "/dashboard/sales/sellout", supportedScopes: ["self", "region", "everything"], mobileEligible: true },
    ],
  },
  {
    groupKey: "buzzcart",
    groupLabel: "Buzzcart",
    icon: "ShoppingBag",
    items: [{ key: "buzzcart", label: "Buzzcart", route: "/dashboard/buzzcart/orders", supportedScopes: ["self", "region", "everything"], mobileEligible: true }],
  },
  {
    groupKey: "installer",
    groupLabel: "Installer Management",
    icon: "Wrench",
    items: [
      { key: "installer.verify_installer", label: "Verify Installer", route: "/dashboard/installer/list" },
      { key: "installer.verify_installation", label: "Verify Installation", route: "/dashboard/installer/jobs" },
      { key: "installer.performance", label: "Performance Logs", route: "/dashboard/installer/performance" },
    ],
  },
  {
    groupKey: "expenses",
    groupLabel: "Expense Management",
    icon: "FileText",
    items: [{ key: "expenses", label: "Expense Management", route: "/dashboard/expenses", supportedScopes: ["self", "region", "everything"] }],
  },
  {
    groupKey: "resources",
    groupLabel: "Target Management",
    icon: "Download",
    items: [
      // Key unchanged from the old single "Target Management" item - every
      // role that already had access keeps it, unaffected by this split.
      // Mobile's Target View is read-only everywhere (§12.1's "Target (Read
      // Only)" bottom-bar slot) - no write screen is ever built for it.
      { key: "resources", label: "Sales Targets & Incentives", route: "/dashboard/resources", mobileEligible: true, mobileWriteEligible: false },
      // New capability, starts ungranted for every existing role (only admin
      // has it by default) - assigning targets to anyone is real power that
      // shouldn't silently inherit from whoever could see the old fake tab.
      // Own real route now (was sharing /dashboard/resources with the item
      // above, which is why the two used to render as buttons inside one page
      // instead of two independent sidebar entries like every other section).
      { key: "resources.create_targets", label: "Create Targets", route: "/dashboard/resources/create-targets" },
    ],
  },
  {
    groupKey: "users",
    groupLabel: "User Management",
    icon: "Users",
    items: [
      { key: "users.add_employee", label: "Add Employee", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"] },
      // Backs the admin app's Employee "Distributor View" - hard view-only on
      // mobile, same reasoning as ST1 above. No "Self" on mobile - an
      // employee viewing their own distributor/sub-dealer record isn't a
      // meaningful scope the way it is for a distributor's own ST2 access.
      { key: "users.add_distributor", label: "Add Distributor", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"], mobileEligible: true, mobileWriteEligible: false, mobileSupportedScopes: ["region", "everything"] },
      // Backs the admin app's Employee "Sub-Dealer View" - hard view-only on
      // mobile. "self" is a meaningful scope here too (unlike Add
      // Distributor above) - fetchUsersAction already has a real branch for
      // a distributor caller + self scope, filtering to just their own
      // connected sub-dealers (distributor_id === caller.id), so a
      // distributor granted self-only mobile access sees exactly their own
      // assigned sub-dealers, not the whole directory.
      { key: "users.add_sub_dealer", label: "Add Sub Dealer", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"], mobileEligible: true, mobileWriteEligible: false, mobileSupportedScopes: ["self", "region", "everything"] },
      { key: "users.add_installer", label: "Add Installer", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"] },
      // Backs the admin app's Distributor "own Sub Dealer List" view.
      { key: "users.dealer_assignment", label: "Dealer Assignment", route: "/dashboard/users", mobileEligible: true },
      { key: "users.reset_password", label: "Reset Password", route: "/dashboard/users" },
      { key: "users.role_management", label: "Role Management", route: "/dashboard/users" },
    ],
  },
  {
    groupKey: "broadcast",
    groupLabel: "Broadcast Notice",
    icon: "HelpCircle",
    items: [{ key: "broadcast", label: "Broadcast Notice", route: "/dashboard/broadcast" }],
  },
  {
    groupKey: "sn_lookup",
    groupLabel: "SN Lookup",
    icon: "Search",
    // Plain grant/no-grant, no self/region/everything filter - per the
    // client's decision this only ever goes to roles who should see a serial
    // number's full chain of custody, not a partial/scoped view of it.
    items: [{ key: "sn_lookup", label: "SN Lookup", route: "/dashboard/sn-lookup", mobileEligible: true }],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.key));
