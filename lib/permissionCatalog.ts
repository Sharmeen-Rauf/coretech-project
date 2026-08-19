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
    groupLabel: "Product Management",
    icon: "Box",
    items: [{ key: "product", label: "Product Management", route: "/dashboard/product" }],
  },
  {
    groupKey: "purchase",
    groupLabel: "Purchase Management",
    icon: "ShoppingCart",
    items: [
      { key: "purchase.import_stock", label: "Import Stock", route: "/dashboard/purchase/import-stock" },
      { key: "purchase.inventory", label: "Inventory", route: "/dashboard/purchase/inventory", supportedScopes: ["self", "region", "everything"] },
      { key: "purchase.warehouse", label: "Warehouse", route: "/dashboard/purchase/warehouse" },
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
      { key: "sales.st1", label: "ST-1", route: "/dashboard/sales/st1", supportedScopes: ["self", "region", "everything"] },
      { key: "sales.st2", label: "ST-2", route: "/dashboard/sales/st2", supportedScopes: ["self", "region", "everything"] },
      { key: "sales.return", label: "Return", route: "/dashboard/sales/return", supportedScopes: ["self", "region", "everything"] },
      { key: "sales.transfer", label: "Transfer", route: "/dashboard/sales/transfer", supportedScopes: ["self", "region", "everything"] },
      { key: "sales.sellout", label: "Sell Out", route: "/dashboard/sales/sellout", supportedScopes: ["self", "region", "everything"] },
    ],
  },
  {
    groupKey: "buzzcart",
    groupLabel: "Buzzcart",
    icon: "ShoppingBag",
    items: [{ key: "buzzcart", label: "Buzzcart", route: "/dashboard/buzzcart", supportedScopes: ["self", "region", "everything"] }],
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
      { key: "resources", label: "Sales Targets & Incentives", route: "/dashboard/resources" },
      // New capability, starts ungranted for every existing role (only admin
      // has it by default) - assigning targets to anyone is real power that
      // shouldn't silently inherit from whoever could see the old fake tab.
      { key: "resources.create_targets", label: "Create Targets", route: "/dashboard/resources" },
    ],
  },
  {
    groupKey: "users",
    groupLabel: "User Management",
    icon: "Users",
    items: [
      { key: "users.add_employee", label: "Add Employee", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"] },
      { key: "users.add_distributor", label: "Add Distributor", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"] },
      { key: "users.add_sub_dealer", label: "Add Sub Dealer", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"] },
      { key: "users.add_installer", label: "Add Installer", route: "/dashboard/users", supportedScopes: ["self", "region", "everything"] },
      { key: "users.dealer_assignment", label: "Dealer Assignment", route: "/dashboard/users" },
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
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((g) => g.items.map((i) => i.key));
