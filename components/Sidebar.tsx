"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Home,
  Users,
  Box,
  ShoppingCart,
  ShoppingBag,
  MapPin,
  TrendingUp,
  Wrench,
  LogOut,
  FileText,
  Download,
  HelpCircle,
  Search,
} from "lucide-react";
import { createClientComponentClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { getMyPermissionKeysAction } from "@/app/actions/roles";
import { PERMISSION_CATALOG } from "@/lib/permissionCatalog";

const ICONS: Record<string, any> = {
  Box, ShoppingCart, MapPin, TrendingUp, ShoppingBag, Wrench, FileText, Download, Users, HelpCircle, Search,
};

// Sub-items that link to the same /dashboard/users route via a query param, and how
// each maps to its permission key + link label + query value. Kept separate from the
// generic catalog rendering below because these all share one URL and need their
// query-param value (not just their route) to render correctly.
const USER_SUBVIEWS: { key: string; label: string; roleParam: string }[] = [
  { key: "users.add_employee", label: "Add Employee", roleParam: "employee" },
  { key: "users.add_distributor", label: "Add Distributor", roleParam: "distributor" },
  { key: "users.add_sub_dealer", label: "Add Sub Dealer", roleParam: "sub_dealer" },
  { key: "users.add_installer", label: "Add Installer", roleParam: "installer" },
  { key: "users.dealer_assignment", label: "Dealer Assignment", roleParam: "dealer_assignment" },
  { key: "users.reset_password", label: "Reset Password", roleParam: "reset_password" },
  { key: "users.role_management", label: "Role Management", roleParam: "role_management" },
];

interface SidebarProps {
  profile?: { role?: string } | null;
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [grantedKeys, setGrantedKeys] = useState<Set<string>>(new Set());
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  // Role now comes from DashboardLayout (one shared fetch instead of Sidebar
  // and Topbar each independently re-fetching the same session + profile).
  const userRole = profile?.role || "";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getMyPermissionKeysAction();
        setGrantedKeys(new Set(res.keys));
      } catch (err) {
        console.warn("Failed to fetch sidebar permissions", err);
        setGrantedKeys(new Set()); // default-deny on failure, matches middleware
      } finally {
        setPermissionsLoaded(true);
      }
    };
    load();
  }, []);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Which group (if any) the current page belongs to - used both to
  // auto-expand that group on load/navigation (refresh, deep link, or a
  // Topbar "Quick Add" shortcut previously landed you inside a collapsed
  // section with no visual indication) and to highlight its header even
  // while collapsed.
  const activeGroupKey = (() => {
    if (pathname === "/dashboard/users") return "users";
    const group = PERMISSION_CATALOG.find((g) => g.items.some((item) => pathname.startsWith(item.route)));
    return group?.groupKey || null;
  })();

  useEffect(() => {
    if (activeGroupKey && !openMenus[activeGroupKey]) {
      setOpenMenus((prev) => ({ ...prev, [activeGroupKey]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupKey]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (path: string, queryParam?: { key: string; value: string }) => {
    if (queryParam) {
      return pathname === path && searchParams.get(queryParam.key) === queryParam.value;
    }
    return pathname === path;
  };

  const linkClass = (path: string, queryParam?: { key: string; value: string }) => {
    const active = isActive(path, queryParam);
    return `flex items-center px-4 py-2 text-xs font-semibold rounded-r-md border-l-2 transition-all duration-200 ${
      active
        ? "border-[#00B4D8] bg-[#F0FAFE] text-[#00B4D8]"
        : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800"
    }`;
  };

  const isGranted = (key: string) => userRole === "admin" || grantedKeys.has(key);

  return (
    <aside className="w-56 h-screen bg-white border-r border-slate-200 flex flex-col fixed left-0 top-0 z-30 select-none overflow-y-auto">
      {/* Brand Logo */}
      <div className="h-16 px-6 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0077B6] to-[#00B4D8] flex items-center justify-center text-white font-extrabold text-sm shadow">
          CT
        </div>
        <span className="text-lg font-bold text-slate-800 tracking-tight">
          Core<span className="text-[#00B4D8]">TECH</span>
        </span>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-2 py-4 space-y-6">
        <div>
          <span className="px-4 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Dashboards
          </span>
          <div className="mt-2 space-y-1">
            {/* Home - universal, always visible regardless of role/permissions */}
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              <Home className="w-4 h-4 mr-3" />
              Home
            </Link>

            {!permissionsLoaded ? null : (
              <>
                {PERMISSION_CATALOG.map((group) => {
                  if (group.groupKey === "users") {
                    const visibleSubviews = USER_SUBVIEWS.filter((sv) => isGranted(sv.key));
                    if (visibleSubviews.length === 0) return null;
                    const Icon = ICONS[group.icon];
                    return (
                      <div key={group.groupKey}>
                        <button
                          onClick={() => toggleMenu(group.groupKey)}
                          className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                            activeGroupKey === group.groupKey ? "text-[#00B4D8]" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center">
                            <Icon className="w-4 h-4 mr-3" />
                            <span>{group.groupLabel}</span>
                          </div>
                          {openMenus[group.groupKey] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        {openMenus[group.groupKey] && (
                          <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                            {visibleSubviews.map((sv) => (
                              <Link
                                key={sv.key}
                                href={`/dashboard/users?role=${sv.roleParam}`}
                                className={linkClass("/dashboard/users", { key: "role", value: sv.roleParam })}
                              >
                                {sv.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const visibleItems = group.items.filter((item) => isGranted(item.key));
                  if (visibleItems.length === 0) return null;
                  const Icon = ICONS[group.icon];

                  if (visibleItems.length === 1 && group.items.length === 1) {
                    // Single-item group renders as a direct top-level link, matching today's UI
                    const item = visibleItems[0];
                    return (
                      <Link key={item.key} href={item.route} className={linkClass(item.route)}>
                        <Icon className="w-4 h-4 mr-3" />
                        {group.groupLabel}
                      </Link>
                    );
                  }

                  return (
                    <div key={group.groupKey}>
                      <button
                        onClick={() => toggleMenu(group.groupKey)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
                          activeGroupKey === group.groupKey ? "text-[#00B4D8]" : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center">
                          <Icon className="w-4 h-4 mr-3" />
                          <span>{group.groupLabel}</span>
                        </div>
                        {openMenus[group.groupKey] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                      {openMenus[group.groupKey] && (
                        <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                          {visibleItems.map((item) => (
                            <Link key={item.key} href={item.route} className={linkClass(item.route)}>
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Logout
        </button>
      </div>
    </aside>
  );
}
