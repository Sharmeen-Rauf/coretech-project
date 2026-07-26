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
  CheckSquare,
  FileText,
  CreditCard,
  Download,
  HelpCircle,
  Activity,
} from "lucide-react";
import { createClientComponentClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [userRole, setUserRole] = useState<string>("");

  // Collapsible menu states
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    users: true,
    product: false,
    purchase: false,
    sales: false,
    buzzcart: false,
    installer: false,
  });

  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setUserRole(profile.role);
        }
      } catch (err) {
        console.warn("Failed to fetch sidebar user role", err);
      }
    };
    fetchUserRole();
  }, [supabase]);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
            {userRole === "distributor" ? (
              <>
                {/* Home */}
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Link>

                {/* Consignment */}
                <Link href="/dashboard/purchase/import-stock" className={linkClass("/dashboard/purchase/import-stock")}>
                  <Box className="w-4 h-4 mr-3" />
                  Consignment
                </Link>

                {/* Stock Analysis */}
                <div>
                  <button
                    onClick={() => toggleMenu("product")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 mr-3" />
                      <span>Stock Analysis</span>
                    </div>
                    {openMenus.product ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {openMenus.product && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link href="/dashboard/purchase/inventory" className={linkClass("/dashboard/purchase/inventory")}>
                        Inventory
                      </Link>
                    </div>
                  )}
                </div>

                {/* Delivery Order */}
                <div>
                  <button
                    onClick={() => toggleMenu("buzzcart")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <ShoppingBag className="w-4 h-4 mr-3" />
                      <span>Delivery Order</span>
                    </div>
                    {openMenus.buzzcart ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {openMenus.buzzcart && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link href="/dashboard/buzzcart/orders" className={linkClass("/dashboard/buzzcart/orders")}>
                        Orders
                      </Link>
                      <Link href="/dashboard/buzzcart/create" className={linkClass("/dashboard/buzzcart/create")}>
                        Create Order
                      </Link>
                    </div>
                  )}
                </div>

                {/* Sub Dealers */}
                <div>
                  <button
                    onClick={() => toggleMenu("users")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-3" />
                      <span>Sub Dealers</span>
                    </div>
                    {openMenus.users ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {openMenus.users && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/users?role=sub_dealer"
                        className={linkClass("/dashboard/users", {
                          key: "role",
                          value: "sub_dealer",
                        })}
                      >
                        Connection
                      </Link>
                    </div>
                  )}
                </div>

                {/* Transfer */}
                <div>
                  <button
                    onClick={() => toggleMenu("sales")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 mr-3" />
                      <span>Transfer</span>
                    </div>
                    {openMenus.sales ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {openMenus.sales && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link href="/dashboard/sales/transfer" className={linkClass("/dashboard/sales/transfer")}>
                        List
                      </Link>
                    </div>
                  )}
                </div>

                {/* Return */}
                <div>
                  <button
                    onClick={() => toggleMenu("installer")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <Wrench className="w-4 h-4 mr-3" />
                      <span>Return</span>
                    </div>
                    {openMenus.installer ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {openMenus.installer && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link href="/dashboard/sales/return" className={linkClass("/dashboard/sales/return")}>
                        List
                      </Link>
                    </div>
                  )}
                </div>
              </>
            ) : userRole === "sub_dealer" ? (
              <>
                {/* Home */}
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Link>

                {/* Buzzcart */}
                <div>
                  <button
                    onClick={() => toggleMenu("buzzcart")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <ShoppingBag className="w-4 h-4 mr-3" />
                      <span>Buzzcart</span>
                    </div>
                    {openMenus.buzzcart ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {openMenus.buzzcart && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link href="/dashboard/buzzcart/orders" className={linkClass("/dashboard/buzzcart/orders")}>
                        Orders
                      </Link>
                      <Link href="/dashboard/buzzcart/create" className={linkClass("/dashboard/buzzcart/create")}>
                        Create Order
                      </Link>
                    </div>
                  )}
                </div>

                {/* Support Tickets */}
                <Link href="/dashboard/support" className={linkClass("/dashboard/support")}>
                  <HelpCircle className="w-4 h-4 mr-3" />
                  Support Tickets
                </Link>
              </>
            ) : userRole === "marketing_manager" ? (
              <>
                {/* Home */}
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Link>

                {/* Invoices */}
                <Link href="/dashboard/invoices" className={linkClass("/dashboard/invoices")}>
                  <CreditCard className="w-4 h-4 mr-3" />
                  Invoices & Payments
                </Link>
              </>
            ) : userRole === "rsm" ? (
              <>
                {/* Home */}
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Link>

                {/* Sales */}
                <div>
                  <button
                    onClick={() => toggleMenu("sales")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 mr-3" />
                      <span>Sales</span>
                    </div>
                    {openMenus.sales ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.sales && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/sales/st1"
                        className={linkClass("/dashboard/sales/st1")}
                      >
                        ST-1
                      </Link>
                      <Link
                        href="/dashboard/sales/st2"
                        className={linkClass("/dashboard/sales/st2")}
                      >
                        ST-2
                      </Link>
                      <Link
                        href="/dashboard/sales/return"
                        className={linkClass("/dashboard/sales/return")}
                      >
                        Return
                      </Link>
                      <Link
                        href="/dashboard/sales/transfer"
                        className={linkClass("/dashboard/sales/transfer")}
                      >
                        Transfer
                      </Link>
                    </div>
                  )}
                </div>

                {/* Buzzcart */}
                <div>
                  <button
                    onClick={() => toggleMenu("buzzcart")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <ShoppingBag className="w-4 h-4 mr-3" />
                      <span>Buzzcart</span>
                    </div>
                    {openMenus.buzzcart ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.buzzcart && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/buzzcart/orders"
                        className={linkClass("/dashboard/buzzcart/orders")}
                      >
                        Order
                      </Link>
                      <Link
                        href="/dashboard/buzzcart/create"
                        className={linkClass("/dashboard/buzzcart/create")}
                      >
                        Create Order
                      </Link>
                    </div>
                  )}
                </div>

                {/* Expenses */}
                <Link href="/dashboard/expenses" className={linkClass("/dashboard/expenses")}>
                  <FileText className="w-4 h-4 mr-3" />
                  Expenses
                </Link>

                {/* Invoices */}
                <Link href="/dashboard/invoices" className={linkClass("/dashboard/invoices")}>
                  <CreditCard className="w-4 h-4 mr-3" />
                  Invoices & Payments
                </Link>
              </>
            ) : userRole === "retail_manager" ? (
              <>
                {/* Home */}
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Link>

                {/* Approvals & Passes */}
                <Link href="/dashboard/approvals" className={linkClass("/dashboard/approvals")}>
                  <CheckSquare className="w-4 h-4 mr-3" />
                  Approvals & Passes
                </Link>

                {/* Installer & Job Verification */}
                <div>
                  <button
                    onClick={() => toggleMenu("installer")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <Wrench className="w-4 h-4 mr-3" />
                      <span>Installer Verifications</span>
                    </div>
                    {openMenus.installer ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.installer && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link href="/dashboard/installer/list" className={linkClass("/dashboard/installer/list")}>
                        Verify Installers
                      </Link>
                      <Link href="/dashboard/installer/jobs" className={linkClass("/dashboard/installer/jobs")}>
                        Verify Installations
                      </Link>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Home */}
                <Link href="/dashboard" className={linkClass("/dashboard")}>
                  <Home className="w-4 h-4 mr-3" />
                  Home
                </Link>

                {/* User Management */}
                <div>
                  <button
                    onClick={() => toggleMenu("users")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-3" />
                      <span>User Management</span>
                    </div>
                    {openMenus.users ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.users && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/users?role=employee"
                        className={linkClass("/dashboard/users", {
                          key: "role",
                          value: "employee",
                        })}
                      >
                        Add Employee
                      </Link>
                      <Link
                        href="/dashboard/users?role=distributor"
                        className={linkClass("/dashboard/users", {
                          key: "role",
                          value: "distributor",
                        })}
                      >
                        Add Distributor
                      </Link>
                      <Link
                        href="/dashboard/users?role=sub_dealer"
                        className={linkClass("/dashboard/users", {
                          key: "role",
                          value: "sub_dealer",
                        })}
                      >
                        Add Sub Dealer
                      </Link>
                      <Link
                        href="/dashboard/users?role=installer"
                        className={linkClass("/dashboard/users", {
                          key: "role",
                          value: "installer",
                        })}
                      >
                        Add Installer
                      </Link>
                    </div>
                  )}
                </div>

                {/* Product */}
                <div>
                  <button
                    onClick={() => toggleMenu("product")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <Box className="w-4 h-4 mr-3" />
                      <span>Product</span>
                    </div>
                    {openMenus.product ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.product && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/product/inverter"
                        className={linkClass("/dashboard/product/inverter")}
                      >
                        Inverter
                      </Link>
                      <Link
                        href="/dashboard/product/battery"
                        className={linkClass("/dashboard/product/battery")}
                      >
                        Battery
                      </Link>
                      <Link
                        href="/dashboard/product/aio"
                        className={linkClass("/dashboard/product/aio")}
                      >
                        AIO
                      </Link>
                    </div>
                  )}
                </div>

                {/* Purchase */}
                <div>
                  <button
                    onClick={() => toggleMenu("purchase")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <ShoppingCart className="w-4 h-4 mr-3" />
                      <span>Purchase</span>
                    </div>
                    {openMenus.purchase ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.purchase && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/purchase/import-stock"
                        className={linkClass("/dashboard/purchase/import-stock")}
                      >
                        Import Stock
                      </Link>
                      <Link
                        href="/dashboard/purchase/inventory"
                        className={linkClass("/dashboard/purchase/inventory")}
                      >
                        Inventory
                      </Link>
                      <Link
                        href="/dashboard/purchase/warehouse"
                        className={linkClass("/dashboard/purchase/warehouse")}
                      >
                        Warehouse
                      </Link>
                      <Link
                        href="/dashboard/purchase/sellout"
                        className={linkClass("/dashboard/purchase/sellout")}
                      >
                        Sell Out
                      </Link>
                    </div>
                  )}
                </div>

                {/* Region */}
                <Link href="/dashboard/region" className={linkClass("/dashboard/region")}>
                  <MapPin className="w-4 h-4 mr-3" />
                  Region
                </Link>

                {/* Sales */}
                <div>
                  <button
                    onClick={() => toggleMenu("sales")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 mr-3" />
                      <span>Sales</span>
                    </div>
                    {openMenus.sales ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.sales && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/sales/st1"
                        className={linkClass("/dashboard/sales/st1")}
                      >
                        ST-1
                      </Link>
                      <Link
                        href="/dashboard/sales/st2"
                        className={linkClass("/dashboard/sales/st2")}
                      >
                        ST-2
                      </Link>
                      <Link
                        href="/dashboard/sales/return"
                        className={linkClass("/dashboard/sales/return")}
                      >
                        Return
                      </Link>
                      <Link
                        href="/dashboard/sales/transfer"
                        className={linkClass("/dashboard/sales/transfer")}
                      >
                        Transfer
                      </Link>
                    </div>
                  )}
                </div>

                {/* Buzzcart */}
                <div>
                  <button
                    onClick={() => toggleMenu("buzzcart")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <ShoppingBag className="w-4 h-4 mr-3" />
                      <span>Buzzcart</span>
                    </div>
                    {openMenus.buzzcart ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.buzzcart && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/buzzcart/orders"
                        className={linkClass("/dashboard/buzzcart/orders")}
                      >
                        Order
                      </Link>
                      <Link
                        href="/dashboard/buzzcart/create"
                        className={linkClass("/dashboard/buzzcart/create")}
                      >
                        Create Order
                      </Link>
                    </div>
                  )}
                </div>

                {/* Installer */}
                <div>
                  <button
                    onClick={() => toggleMenu("installer")}
                    className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <div className="flex items-center">
                      <Wrench className="w-4 h-4 mr-3" />
                      <span>Installer</span>
                    </div>
                    {openMenus.installer ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {openMenus.installer && (
                    <div className="mt-1 pl-7 space-y-1 border-l border-slate-100 ml-6">
                      <Link
                        href="/dashboard/installer/list"
                        className={linkClass("/dashboard/installer/list")}
                      >
                        List
                      </Link>
                      <Link
                        href="/dashboard/installer/jobs"
                        className={linkClass("/dashboard/installer/jobs")}
                      >
                        Job Assignment
                      </Link>
                      <Link
                        href="/dashboard/installer/performance"
                        className={linkClass("/dashboard/installer/performance")}
                      >
                        Performance Logs
                      </Link>
                    </div>
                  )}
                </div>

                {/* Gate Pass & Approvals */}
                <Link href="/dashboard/approvals" className={linkClass("/dashboard/approvals")}>
                  <CheckSquare className="w-4 h-4 mr-3" />
                  Approvals & Passes
                </Link>

                {/* Expenses */}
                <Link href="/dashboard/expenses" className={linkClass("/dashboard/expenses")}>
                  <FileText className="w-4 h-4 mr-3" />
                  Expenses
                </Link>

                {/* Invoices */}
                <Link href="/dashboard/invoices" className={linkClass("/dashboard/invoices")}>
                  <CreditCard className="w-4 h-4 mr-3" />
                  Invoices & Payments
                </Link>

                {/* Resources & Targets */}
                <Link href="/dashboard/resources" className={linkClass("/dashboard/resources")}>
                  <Download className="w-4 h-4 mr-3" />
                  Resources & Targets
                </Link>

                {/* Support Tickets */}
                <Link href="/dashboard/support" className={linkClass("/dashboard/support")}>
                  <HelpCircle className="w-4 h-4 mr-3" />
                  Support Tickets
                </Link>

                {/* Activity Logs */}
                <Link href="/dashboard/activity-logs" className={linkClass("/dashboard/activity-logs")}>
                  <Activity className="w-4 h-4 mr-3" />
                  Activity Logs
                </Link>

                {/* Broadcast Notice */}
                <Link href="/dashboard/broadcast" className={linkClass("/dashboard/broadcast")}>
                  <HelpCircle className="w-4 h-4 mr-3" />
                  Broadcast Notice
                </Link>
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
