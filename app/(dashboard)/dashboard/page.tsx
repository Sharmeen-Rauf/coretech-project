import React, { Suspense } from "react";
import { createServerComponentClient } from "@/lib/supabase";
import { createClient as createJSClient } from "@supabase/supabase-js";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseServiceKey) {
    return createJSClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return createServerComponentClient();
}
import StatsCard from "@/components/StatsCard";
import ProjectionsChart from "@/components/ProjectionsChart";
import RevenueChart from "@/components/RevenueChart";
import SalesDonutChart from "@/components/SalesDonutChart";
import { 
  AlertCircle, 
  Radio, 
  Calendar, 
  MessageSquare, 
  Wrench, 
  Award, 
  UserCheck, 
  Users, 
  Layers, 
  Sparkles,
  ShoppingBag
} from "lucide-react";
import ReportingDashboardClient from "@/components/ReportingDashboardClient";
import InventoryHealthPanel from "@/components/InventoryHealthPanel";
import HomeDateRangeFilter from "@/components/HomeDateRangeFilter";

export const revalidate = 0; // Disable caching for realtime updates

interface DateRange {
  from: string;
  to: string;
}

// Upper bound applied as an exclusive "< day after `to`" rather than
// "<= to" - safe regardless of whether the underlying column is a plain
// date or a timestamp, which would otherwise silently exclude the whole
// selected end day.
function dayAfter(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

async function DashboardStats({ dateRange }: { dateRange: DateRange | null }) {
  const supabase = getAdminClient();

  let customersVal = 0;
  let ordersVal = 0;
  let st1Val = 0;
  let st2Val = 0;
  let soVal = 0;
  let installationsVal = 0;
  let revenueVal = 0;
  let activeInstallersCount = 0;

  try {
    // Only the genuine activity counts (ST1/ST2/Sell Out/Installer Jobs) move
    // with the date range - Total Accounts, Total Stock Units, Total
    // Valuation, and Registered Installers are point-in-time snapshots
    // ("how many/much exists right now"), not "how much happened in this
    // window", so they stay all-time regardless of the filter. Total
    // Valuation in particular sums every unit currently in stock, sold or
    // not - it was never actually a "revenue in period" metric to begin with.
    let st1Query = supabase.from("sales").select("id", { count: "exact", head: true }).eq("type", "ST1");
    let st2Query = supabase.from("sales").select("id", { count: "exact", head: true }).eq("type", "ST2");
    let soQuery = supabase.from("stock").select("id", { count: "exact", head: true }).eq("status", "sold_out");
    let instQuery = supabase.from("installer_jobs").select("id", { count: "exact", head: true });

    if (dateRange) {
      const toExclusive = dayAfter(dateRange.to);
      st1Query = st1Query.gte("date", dateRange.from).lt("date", toExclusive);
      st2Query = st2Query.gte("date", dateRange.from).lt("date", toExclusive);
      soQuery = soQuery.gte("sold_out_at", dateRange.from).lt("sold_out_at", toExclusive);
      instQuery = instQuery.gte("created_at", dateRange.from).lt("created_at", toExclusive);
    }

    // Execute all 7 statistical database queries concurrently via Promise.all for maximum speed.
    // (Was 8 - the old separate "quantity only" stock query was a strict subset
    // of the "quantity + product price" one below, so ordersVal is now derived
    // from that same result instead of running a second full-table query.)
    const [
      profRes,
      st1Res,
      st2Res,
      soRes,
      instRes,
      stockPricesRes,
      actInstRes
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      st1Query,
      st2Query,
      soQuery,
      instQuery,
      supabase.from("stock").select("quantity, products(price)"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "installer")
    ]);

    if (profRes.count !== null && profRes.count > 0) customersVal = profRes.count;
    if (stockPricesRes.data && stockPricesRes.data.length > 0) {
      ordersVal = stockPricesRes.data.reduce((sum, s) => sum + (s.quantity || 1), 0);
    }
    if (st1Res.count !== null && st1Res.count > 0) st1Val = st1Res.count;
    if (st2Res.count !== null && st2Res.count > 0) st2Val = st2Res.count;
    if (soRes.count !== null && soRes.count > 0) soVal = soRes.count;
    if (instRes.count !== null && instRes.count > 0) installationsVal = instRes.count;
    if (stockPricesRes.data && stockPricesRes.data.length > 0) {
      revenueVal = stockPricesRes.data.reduce((sum, item: any) => {
        const p = item.products?.price ? parseFloat(item.products.price) : 0;
        const q = item.quantity || 1;
        return sum + (p * q);
      }, 0);
    }
    if (actInstRes.count !== null && actInstRes.count > 0) activeInstallersCount = actInstRes.count;
  } catch (err) {
    console.error("Dashboard stats database error:", err);
  }

  const formatRevenue = (num: number) => {
    if (num >= 1000000) {
      return `Rs. ${(num / 1000000).toFixed(1)}M`;
    }
    return `Rs. ${num.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
      <StatsCard
        title="Total Accounts"
        value={customersVal.toLocaleString()}
        change="+11.0%"
        isPositive={true}
        subtitle="Network Users: 100%"
      />
      <StatsCard
        title="Total Stock Units"
        value={ordersVal.toLocaleString()}
        change="+8.45%"
        isPositive={true}
        subtitle="Warehouse Inventory"
      />
      <StatsCard
        title="Total Valuation"
        value={formatRevenue(revenueVal)}
        change="+15.0%"
        isPositive={true}
        subtitle="Inventory Asset Value"
      />
      <StatsCard
        title="Registered Installers"
        value={activeInstallersCount.toLocaleString()}
        change="+22.1%"
        isPositive={true}
        subtitle="Active Technicians"
      />
      <StatsCard
        title="Total ST-1"
        value={st1Val.toLocaleString()}
        change="+14.2%"
        isPositive={true}
        subtitle="Primary Transfers"
      />
      <StatsCard
        title="Total ST-2"
        value={st2Val.toLocaleString()}
        change="+9.5%"
        isPositive={true}
        subtitle="Secondary Transfers"
      />
      <StatsCard
        title="Total Sell Out"
        value={soVal.toLocaleString()}
        change="+6.7%"
        isPositive={true}
        subtitle="Active Deployments"
      />
      <StatsCard
        title="Completed Jobs"
        value={installationsVal.toLocaleString()}
        change="+18.4%"
        isPositive={true}
        subtitle="Installation Projects"
      />
    </div>
  );
}

async function ReportingDashboard() {
  const supabase = getAdminClient();
  
  let jobsCount = 0;
  let claimsCount = 0;
  let activeJobs: any[] = [];

  try {
    const { count: jCount } = await supabase
      .from("installer_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["assigned", "in_progress", "pending_verification", "pending_approval"]);
    if (jCount !== null) jobsCount = jCount;

    const { count: cCount } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (cCount !== null) claimsCount = cCount;

    const { data: jobsData } = await supabase
      .from("installer_jobs")
      .select("*")
      .order("created_at", { ascending: false });
    activeJobs = jobsData || [];
  } catch (err) {
    console.warn("Failed to load operations statistics", err);
  }

  return (
    <ReportingDashboardClient
      jobsCount={jobsCount}
      claimsCount={claimsCount}
      activeJobs={activeJobs}
    />
  );
}

async function LatestApprovedInstallers() {
  const supabase = getAdminClient();
  let list: any[] = [];
  try {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, contact, city, created_at")
      .eq("role", "installer")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5);
    list = data || [];
  } catch (e) {
    console.warn("Failed to fetch latest approved installers:", e);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] overflow-hidden shadow-sm flex flex-col justify-between h-full">
      <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[#00B4D8]" />
          Latest Approved Installers
        </h3>
        <span className="text-[10px] bg-[#00B4D8]/10 text-[#00B4D8] px-2 py-0.5 rounded-full font-bold uppercase">Recent</span>
      </div>
      <div className="flex-1">
        {list.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">No approved installers found.</div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {list.map((inst, idx) => (
              <div key={idx} className="p-3.5 px-5 flex justify-between items-center hover:bg-slate-50/50">
                <div>
                  <p className="font-bold text-slate-800">{inst.first_name} {inst.last_name || ""}</p>
                  <p className="text-[10px] text-slate-450">{inst.contact || "-"}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase border border-emerald-100">{inst.city || "Pakistan"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

async function AnnouncementsTicker() {
  const supabase = getAdminClient();
  let list: any[] = [];

  try {
    const { data } = await supabase
      .from("announcements")
      .select(`
        id,
        title,
        content,
        created_at,
        profile:profiles!created_by(first_name, last_name)
      `)
      .order("created_at", { ascending: false })
      .limit(3);
    if (data) list = data;
  } catch (err) {
    // fallback
  }

  if (list.length === 0) {
    list = [
      {
        id: "1",
        title: "CoreTECH Web Portal Phase 2 Live",
        content: "We have rolled out comprehensive role-based access rules and data isolation policies. Distributors and Employees can now securely manage invoices and claims.",
        created_at: new Date().toISOString(),
        profile: { first_name: "Admin", last_name: "Operations" }
      }
    ];
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm space-y-4 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
          <Radio className="w-4 h-4 text-[#00B4D8]" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Company Broadcast Board
          </h3>
        </div>
        <div className="space-y-4 divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
          {list.map((item, idx) => (
            <div key={item.id} className={`pt-3 ${idx === 0 ? "pt-0" : ""}`}>
              <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{item.content}</p>
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold mt-2">
                <span>By: {item.profile ? `${item.profile.first_name} ${item.profile.last_name || ""}`.trim() : "System"}</span>
                <span>{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function TopSellingProductsTable() {
  const supabase = getAdminClient();
  let topList: any[] = [];

  try {
    const { data: stockItems } = await supabase
      .from("stock")
      .select(`
        quantity,
        products (
          name,
          price
        )
      `);

    if (stockItems && stockItems.length > 0) {
      const prodMap = new Map<string, { name: string; price: number; quantity: number; amount: number }>();
      stockItems.forEach((s: any) => {
        const name = s.products?.name || "CoreTech Stock Product";
        const price = Number(s.products?.price) || 0;
        const qty = Number(s.quantity) || 1;

        if (prodMap.has(name)) {
          const item = prodMap.get(name)!;
          item.quantity += qty;
          item.amount += (price * qty);
        } else {
          prodMap.set(name, {
            name,
            price,
            quantity: qty,
            amount: price * qty
          });
        }
      });

      topList = Array.from(prodMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    }
  } catch (err) {
    console.warn("Failed to fetch top selling products", err);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm space-y-4 h-full flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Top Selling Products</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[#00B4D8] uppercase tracking-wider text-[10px] font-bold">
                <th className="pb-2 font-bold">Name</th>
                <th className="pb-2 font-bold">Price</th>
                <th className="pb-2 font-bold">Quantity</th>
                <th className="pb-2 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {topList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400 italic">No product data found.</td>
                </tr>
              ) : (
                topList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 font-bold text-slate-800">{item.name}</td>
                    <td className="py-2.5 text-slate-500">Rs. {item.price.toLocaleString()}</td>
                    <td className="py-2.5 font-bold text-slate-700">{item.quantity}</td>
                    <td className="py-2.5 text-right font-bold text-[#00B4D8]">Rs. {item.amount.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import dynamic from "next/dynamic";
// Code-split: these two role-specific dashboards are large client components
// that only ever render for sub_dealer/distributor - dynamic-importing them
// keeps their JS out of the bundle every other role has to download for /dashboard.
const SubDealerDashboardHome = dynamic(() => import("@/components/SubDealerDashboardHome"));
const DistributorDashboardHome = dynamic(() => import("@/components/DistributorDashboardHome"));

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const supabase = getAdminClient();
  const serverAuth = createServerComponentClient();
  const { data: { user } } = await serverAuth.auth.getUser();
  let userRole = "";
  if (user) {
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    userRole = prof?.role || "";
  }

  const dateRange: DateRange | null =
    searchParams.from && searchParams.to ? { from: searchParams.from, to: searchParams.to } : null;

  if (userRole === "sub_dealer" || userRole === "distributor") {
    let custCount = 0;
    let ordCount = 0;
    let revTotal = 0;
    let liveTransfers: any[] = [];
    let liveLocations: { name: string; value: string }[] = [];

    try {
      const [cRes, oRes, stRes, trRes, regRes] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("stock").select("*", { count: "exact", head: true }),
        supabase.from("stock").select("quantity, products(price)"),
        supabase.from("sales").select("*, distributor:profiles!distributor_id(first_name, last_name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("regions").select("name, warehouse").limit(4)
      ]);

      if (cRes.count) custCount = cRes.count;
      if (oRes.count) ordCount = oRes.count;
      if (stRes.data) {
        revTotal = stRes.data.reduce((sum, item: any) => sum + ((item.quantity || 1) * (parseFloat(item.products?.price || "0"))), 0);
      }
      if (trRes.data) liveTransfers = trRes.data;
      if (regRes.data && regRes.data.length > 0) {
        liveLocations = regRes.data.map((r: any) => ({
          name: `${r.warehouse} (${r.name})`,
          value: "Active Hub"
        }));
      }
    } catch (dbErr) {
      console.warn("Dashboard db stats fetch warning:", dbErr);
    }

    if (liveLocations.length === 0) {
      liveLocations = [
        { name: "Karachi Central Hub", value: "72K Units" },
        { name: "Lahore Region", value: "39K Units" },
        { name: "Islamabad Capital", value: "25K Units" },
        { name: "Peshawar / KPK", value: "61K Units" }
      ];
    }

    const formattedRev = revTotal >= 1000000 ? `Rs. ${(revTotal / 1000000).toFixed(1)}M` : `Rs. ${revTotal.toLocaleString()}`;

    if (userRole === "sub_dealer") {
      return (
        <SubDealerDashboardHome
          customersCount={custCount}
          ordersCount={ordCount}
          revenueVal={formattedRev}
          transfers={liveTransfers}
          locationStats={liveLocations}
        />
      );
    }

    return (
      <DistributorDashboardHome
        customersCount={custCount}
        ordersCount={ordCount}
        revenueVal={formattedRev}
        transfers={liveTransfers}
        locationStats={liveLocations}
      />
    );
  }

  // 1. Donut Chart: Product Category Distribution
  let inverterQty = 0;
  let batteryQty = 0;
  let aioQty = 0;
  let otherQty = 0;

  try {
    const { data: stockItems } = await supabase
      .from("stock")
      .select(`
        quantity,
        products (
          category
        )
      `);

    if (stockItems && stockItems.length > 0) {
      stockItems.forEach((item: any) => {
        const qty = item.quantity || 0;
        const cat = item.products?.category;
        if (cat === "inverter") inverterQty += qty;
        else if (cat === "battery") batteryQty += qty;
        else if (cat === "aio") aioQty += qty;
        else otherQty += qty;
      });
    }
  } catch (e) {
    console.warn("Error fetching stock distribution:", e);
  }

  const totalQty = inverterQty + batteryQty + aioQty + otherQty;
  const donutData = totalQty > 0 ? [
    { name: "Inverter", value: Math.round((inverterQty / totalQty) * 1000) / 10 },
    { name: "Battery", value: Math.round((batteryQty / totalQty) * 1000) / 10 },
    { name: "AIO", value: Math.round((aioQty / totalQty) * 1000) / 10 },
    { name: "Other", value: Math.round((otherQty / totalQty) * 1000) / 10 },
  ] : [
    { name: "Inverter", value: 0 },
    { name: "Battery", value: 0 },
    { name: "AIO", value: 0 },
    { name: "Other", value: 0 },
  ];

  // 2. Projections vs Actuals (Bar Chart)
  const monthlyActuals: Record<string, number> = {
    Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0
  };

  try {
    const { data: salesRows } = await supabase
      .from("sales")
      .select("date");

    if (salesRows && salesRows.length > 0) {
      salesRows.forEach((row: any) => {
        if (!row.date) return;
        const dateObj = new Date(row.date);
        const monthName = dateObj.toLocaleString("en-US", { month: "short" });
        if (monthName in monthlyActuals) {
          monthlyActuals[monthName] += 1;
        }
      });
    }
  } catch (e) {
    console.warn("Error fetching monthly sales:", e);
  }

  const projectionsData = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(month => {
    const actual = monthlyActuals[month] || 0;
    return {
      name: month,
      Projections: actual > 0 ? Math.round(actual * 1.3) + 2 : 0,
      Actuals: actual
    };
  });

  // 3. Weekly Sales Volume (Line Chart)
  const currentWeekSales: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const previousWeekSales: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

  try {
    const { data: weeklySales } = await supabase
      .from("sales")
      .select("date");

    if (weeklySales && weeklySales.length > 0) {
      const now = new Date();
      const currentMonday = new Date(now);
      const day = currentMonday.getDay();
      const diff = currentMonday.getDate() - day + (day === 0 ? -6 : 1);
      currentMonday.setDate(diff);
      currentMonday.setHours(0, 0, 0, 0);

      const previousMonday = new Date(currentMonday);
      previousMonday.setDate(previousMonday.getDate() - 7);

      weeklySales.forEach((row: any) => {
        if (!row.date) return;
        const saleDate = new Date(row.date);
        const dayName = saleDate.toLocaleString("en-US", { weekday: "short" });
        if (dayName in currentWeekSales) {
          if (saleDate >= currentMonday && saleDate < new Date(currentMonday.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            currentWeekSales[dayName] += 1;
          } else if (saleDate >= previousMonday && saleDate < currentMonday) {
            previousWeekSales[dayName] += 1;
          }
        }
      });
    }
  } catch (e) {
    console.warn("Error fetching weekly sales:", e);
  }

  const weeklyVolumeData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => ({
    name: day,
    current: currentWeekSales[day] || 0,
    previous: previousWeekSales[day] || 0
  }));

  // 4. Regional Sales
  const regionalSales: Record<string, number> = {};
  let totalRegionalSales = 0;

  try {
    const { data: salesWithRegion } = await supabase
      .from("sales")
      .select("warehouse");

    if (salesWithRegion && salesWithRegion.length > 0) {
      salesWithRegion.forEach((row: any) => {
        const wh = row.warehouse || "Unknown Hub";
        regionalSales[wh] = (regionalSales[wh] || 0) + 1;
        totalRegionalSales += 1;
      });
    }
  } catch (e) {
    console.warn("Error fetching regional sales:", e);
  }

  let regionStatsList: { name: string; warehouse: string; units: number; percentage: number }[] = [];
  try {
    const { data: allRegions } = await supabase.from("regions").select("name, warehouse");
    if (allRegions && allRegions.length > 0) {
      regionStatsList = allRegions.map((r: any) => {
        const units = regionalSales[r.warehouse] || 0;
        const percentage = totalRegionalSales > 0 ? Math.round((units / totalRegionalSales) * 100) : 0;
        return {
          name: r.name,
          warehouse: r.warehouse,
          units,
          percentage
        };
      });
    }
  } catch (e) {
    console.warn("Error mapping region stats:", e);
  }

  // 5. Aging Stock
  let agingStock: any[] = [];
  try {
    const { data: oldestStock } = await supabase
      .from("stock")
      .select(`
        quantity,
        warehouse_name,
        created_at,
        products (
          name
        )
      `)
      .order("created_at", { ascending: true })
      .limit(2);

    if (oldestStock) {
      agingStock = oldestStock.map((s: any) => {
        const days = Math.round((new Date().getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return {
          name: s.products?.name || "Unknown Product",
          age: `${days} Days`,
          qty: s.quantity || 0,
          status: days > 90 ? "Slow Moving" : "Awaiting Order",
          location: s.warehouse_name || "Unknown Location"
        };
      });
    }
  } catch (e) {
    console.warn("Error calculating aging stock:", e);
  }

  // 6. Top Performers Register - ranked by real activity volume, not just
  // whichever row happened to come back first.
  let topProduct = "No Sales Yet";
  let topProductQty = 0;
  let topEmployee = "No Employee Standings";
  let topEmployeeVol = 0;
  let topDistributor = "No Distributor Standings";
  let topDistributorVol = 0;
  let topSubDealer = "No Sub Dealer Standings";
  let topSubDealerVol = 0;
  let topInstaller = "No Installer Standings";
  let topInstallerVol = 0;

  function topByCount(counts: Map<string, number>): { id: string; count: number } | null {
    let best: { id: string; count: number } | null = null;
    counts.forEach((count, id) => {
      if (!best || count > best.count) best = { id, count };
    });
    return best;
  }

  try {
    const [stockRes, ordersRes, distSalesRes, subSalesRes, subSelloutRes, jobsRes] = await Promise.all([
      supabase.from("stock").select("quantity, products(name)"),
      supabase.from("orders").select("sales_coordinator_id, items").in("status", ["approved", "invoice_generated", "delivered"]),
      supabase.from("sales").select("id, source_id").eq("type", "ST2").eq("source_type", "distributor"),
      supabase.from("sales").select("id, destination_id").eq("type", "ST2").eq("destination_type", "sub_dealer"),
      supabase.from("stock").select("sub_dealer_id").eq("status", "sold_out").not("sub_dealer_id", "is", null),
      supabase.from("installer_jobs").select("installer_id").eq("status", "approved"),
    ]);

    // Top Product: real aggregate quantity per product, same aggregation the
    // Top Selling Products table already uses.
    if (stockRes.data && stockRes.data.length > 0) {
      const prodQty = new Map<string, number>();
      stockRes.data.forEach((s: any) => {
        const prodData: any = s.products;
        const prod = Array.isArray(prodData) ? prodData[0] : prodData;
        const name = prod?.name;
        if (!name) return;
        prodQty.set(name, (prodQty.get(name) || 0) + (Number(s.quantity) || 1));
      });
      const best = topByCount(prodQty);
      if (best) {
        topProduct = best.id;
        topProductQty = best.count;
      }
    }

    // Top Employee: real Buzzcart order volume attributed to each coordinator.
    let bestEmployee: { id: string; count: number } | null = null;
    if (ordersRes.data && ordersRes.data.length > 0) {
      const empUnits = new Map<string, number>();
      ordersRes.data.forEach((o: any) => {
        if (!o.sales_coordinator_id) return;
        const qty = Array.isArray(o.items) ? o.items.reduce((s: number, it: any) => s + (Number(it?.quantity) || 0), 0) : 0;
        empUnits.set(o.sales_coordinator_id, (empUnits.get(o.sales_coordinator_id) || 0) + qty);
      });
      bestEmployee = topByCount(empUnits);
    }

    // Top Distributor: real outgoing ST-2 unit volume.
    const distSaleIds = (distSalesRes.data || []).map((s: any) => s.id);
    const subSaleIds = (subSalesRes.data || []).map((s: any) => s.id);
    const { data: itemsData } =
      distSaleIds.length + subSaleIds.length > 0
        ? await supabase.from("sale_items").select("sale_id").in("sale_id", [...distSaleIds, ...subSaleIds])
        : { data: [] };
    const itemCountBySale = new Map<string, number>();
    (itemsData || []).forEach((it: any) => itemCountBySale.set(it.sale_id, (itemCountBySale.get(it.sale_id) || 0) + 1));

    let bestDistributor: { id: string; count: number } | null = null;
    if (distSalesRes.data && distSalesRes.data.length > 0) {
      const distUnits = new Map<string, number>();
      distSalesRes.data.forEach((s: any) => {
        distUnits.set(s.source_id, (distUnits.get(s.source_id) || 0) + (itemCountBySale.get(s.id) || 0));
      });
      bestDistributor = topByCount(distUnits);
    }

    // Top Sub Dealer: real incoming ST-2 volume + Sell Out volume combined.
    const subUnits = new Map<string, number>();
    (subSalesRes.data || []).forEach((s: any) => {
      subUnits.set(s.destination_id, (subUnits.get(s.destination_id) || 0) + (itemCountBySale.get(s.id) || 0));
    });
    (subSelloutRes.data || []).forEach((r: any) => {
      subUnits.set(r.sub_dealer_id, (subUnits.get(r.sub_dealer_id) || 0) + 1);
    });
    const bestSubDealer = subUnits.size > 0 ? topByCount(subUnits) : null;

    // Top Installer: real completed job count.
    let bestInstaller: { id: string; count: number } | null = null;
    if (jobsRes.data && jobsRes.data.length > 0) {
      const jobCounts = new Map<string, number>();
      jobsRes.data.forEach((j: any) => {
        if (!j.installer_id) return;
        jobCounts.set(j.installer_id, (jobCounts.get(j.installer_id) || 0) + 1);
      });
      bestInstaller = topByCount(jobCounts);
    }

    // One batched name lookup for all four "best" ids instead of four
    // separate sequential single-row queries.
    const bestIds = [bestEmployee?.id, bestDistributor?.id, bestSubDealer?.id, bestInstaller?.id].filter(
      (id): id is string => !!id
    );
    const nameById = new Map<string, string>();
    if (bestIds.length > 0) {
      const { data: bestProfiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", bestIds);
      (bestProfiles || []).forEach((p: any) => nameById.set(p.id, `${p.first_name} ${p.last_name || ""}`.trim()));
    }

    if (bestEmployee && nameById.has(bestEmployee.id)) {
      topEmployee = nameById.get(bestEmployee.id)!;
      topEmployeeVol = bestEmployee.count;
    }
    if (bestDistributor && nameById.has(bestDistributor.id)) {
      topDistributor = nameById.get(bestDistributor.id)!;
      topDistributorVol = bestDistributor.count;
    }
    if (bestSubDealer && nameById.has(bestSubDealer.id)) {
      topSubDealer = nameById.get(bestSubDealer.id)!;
      topSubDealerVol = bestSubDealer.count;
    }
    if (bestInstaller && nameById.has(bestInstaller.id)) {
      topInstaller = nameById.get(bestInstaller.id)!;
      topInstallerVol = bestInstaller.count;
    }
  } catch (e) {
    console.warn("Error calculating top performers:", e);
  }

  return (
    <div className="space-y-6 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Home</h1>
          <p className="text-xs text-slate-500">Welcome to your CoreTECH operations control panel.</p>
        </div>
        <HomeDateRangeFilter />
      </div>

      {/* KPI Cards Grid with Loader Suspense */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={idx}
                className="h-28 bg-white border border-slate-200 rounded-[8px] p-6 animate-pulse"
              >
                <div className="w-16 h-3 bg-slate-200 rounded mb-2"></div>
                <div className="w-24 h-6 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        }
      >
        <DashboardStats dateRange={dateRange} />
      </Suspense>

      {/* Cross-Role Reporting Operations Summary */}
      <Suspense fallback={<div className="h-20 bg-slate-100 rounded-[10px] animate-pulse mb-6"></div>}>
        <ReportingDashboard />
      </Suspense>

      {/* Charts Section Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projections vs Actuals */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Projections vs Actuals</h3>
          <ProjectionsChart data={projectionsData} />
        </div>

        {/* Units x Regional Sales - Pakistan Location */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Units x Regional Sales</h3>
            
            {/* Pakistan Map SVG */}
            <div className="w-full h-28 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-[6px] mb-4">
              <svg
                viewBox="0 0 100 120"
                className="w-24 h-24 text-emerald-600/30"
                fill="currentColor"
              >
                <path d="M10,90 L20,80 L35,70 L50,60 L60,40 L70,25 L80,20 L85,40 L75,70 L65,85 L55,100 L30,110 Z" />
                <circle cx="55" cy="70" r="3.5" fill="#00B4D8" /> {/* Lahore */}
                <circle cx="25" cy="100" r="3.5" fill="#00B4D8" /> {/* Karachi */}
                <circle cx="68" cy="35" r="3.5" fill="#00B4D8" /> {/* Islamabad */}
                <circle cx="58" cy="45" r="3" fill="#00B4D8" /> {/* Peshawar */}
                <circle cx="48" cy="78" r="3" fill="#00B4D8" /> {/* Multan */}
              </svg>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {regionStatsList.length > 0 ? (
              regionStatsList.map((r, idx) => (
                <div key={idx} className="py-2.5 flex justify-between font-medium">
                  <span className="text-slate-600">{r.warehouse} ({r.name})</span>
                  <span className="text-slate-800 font-bold">{r.units} Units <span className="text-slate-400 font-medium ml-1.5">({r.percentage}%)</span></span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 py-4 text-center">No regions registered.</p>
            )}
          </div>
        </div>
      </div>

      {/* Row 3 Top Selling Products Table & Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Selling Products */}
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-64 bg-slate-100 rounded-[8px] animate-pulse"></div>}>
            <TopSellingProductsTable />
          </Suspense>
        </div>

        {/* Total Sales Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Product Category Distribution</h3>
          <SalesDonutChart data={donutData} />
        </div>
      </div>

      {/* Row 4 Announcements, Low Stock Alerts, & Top Performers Register */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Broadcast Board */}
        <div className="lg:col-span-1">
          <Suspense fallback={<div className="h-64 bg-slate-100 rounded-[8px] animate-pulse"></div>}>
            <AnnouncementsTicker />
          </Suspense>
        </div>

        {/* Inventory & Stock Health Alerts */}
        <div className="lg:col-span-1">
          <Suspense fallback={<div className="h-64 bg-slate-100 rounded-[8px] animate-pulse"></div>}>
            <InventoryHealthPanel agingStock={agingStock} />
          </Suspense>
        </div>

        {/* Top Performers Register */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-[8px] overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-500" />
              Top Performers Register
            </h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">Active Standings</span>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/10">
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Role/Category</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Name / Identity</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Performance metric</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Volume / Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-cyan-500" />
                    Top Product
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{topProduct}</td>
                  <td className="px-5 py-3.5 text-slate-500">Highest inverter units sold</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#00B4D8]">{topProductQty} Units</td>
                </tr>
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Top Employee
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{topEmployee}</td>
                  <td className="px-5 py-3.5 text-slate-500">Buzzcart units coordinated</td>
                  <td className="px-5 py-3.5 text-right font-bold text-indigo-600">{topEmployeeVol} Units</td>
                </tr>
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    Top Distributor
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{topDistributor}</td>
                  <td className="px-5 py-3.5 text-slate-500">ST-2 units sent</td>
                  <td className="px-5 py-3.5 text-right font-bold text-emerald-600">{topDistributorVol} Units</td>
                </tr>
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-500" />
                    Top Sub Dealer
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{topSubDealer}</td>
                  <td className="px-5 py-3.5 text-slate-500">ST-2 received + Sell Out units</td>
                  <td className="px-5 py-3.5 text-right font-bold text-amber-600">{topSubDealerVol} Units</td>
                </tr>
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                    Top Installer
                  </td>
                  <td className="px-5 py-3.5 font-bold text-slate-800">{topInstaller}</td>
                  <td className="px-5 py-3.5 text-slate-500">Completed installation jobs</td>
                  <td className="px-5 py-3.5 text-right font-bold text-rose-600">{topInstallerVol} Jobs</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Latest Approved Installers Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="h-64 bg-slate-100 rounded-[8px] animate-pulse"></div>}>
            <LatestApprovedInstallers />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
