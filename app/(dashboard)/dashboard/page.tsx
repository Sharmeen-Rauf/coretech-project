import React, { Suspense } from "react";
import { createServerComponentClient } from "@/lib/supabase";
import StatsCard from "@/components/StatsCard";
import ProjectionsChart from "@/components/ProjectionsChart";
import RevenueChart from "@/components/RevenueChart";
import SalesDonutChart from "@/components/SalesDonutChart";
import { AlertCircle, Radio, Calendar, CheckSquare, MessageSquare, Wrench } from "lucide-react";
 
export const revalidate = 0; // Disable caching for realtime updates
 
async function DashboardStats() {
  const supabase = createServerComponentClient();
 
  let customersVal = 5;
  let ordersVal = 3;
  let revenueVal = 240000;
  let growthVal = "60.0%";
 
  try {
    // 1. Fetch profiles count (customers)
    const { count: profileCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
 
    if (profileCount !== null && profileCount > 0) {
      customersVal = profileCount;
    }
 
    // 2. Fetch orders count
    const { count: ordCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });
 
    if (ordCount !== null && ordCount > 0) {
      ordersVal = ordCount;
    }
 
    // 3. Fetch revenue sum (orders joined to products)
    const { data: ordPrices } = await supabase
      .from("orders")
      .select(`
        products (
          price
        )
      `);
 
    if (ordPrices && ordPrices.length > 0) {
      const total = ordPrices.reduce((sum, item: any) => {
        const p = item.products?.price ? parseFloat(item.products.price) : 0;
        return sum + p;
      }, 0);
      if (total > 0) {
        revenueVal = total;
      }
    }
 
    // 4. Calculate simulated growth
    if (customersVal > 0) {
      growthVal = `${Math.min(Number((ordersVal / customersVal * 100).toFixed(1)), 100)}%`;
    }
  } catch (err) {
    console.error("Dashboard stats database error, falling back to mock values:", err);
  }
 
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      <StatsCard
        title="Registered Profiles"
        value={customersVal.toLocaleString()}
        change="+12.5%"
        isPositive={true}
      />
      <StatsCard
        title="Buzzcart Orders"
        value={ordersVal.toLocaleString()}
        change="+22.1%"
        isPositive={true}
      />
      <StatsCard
        title="Total Order Value"
        value={`Rs. ${revenueVal.toLocaleString()}`}
        change="+18.4%"
        isPositive={true}
      />
      <StatsCard
        title="Conversion Rate"
        value={growthVal}
        change="+4.2%"
        isPositive={true}
      />
    </div>
  );
}
 
async function ReportingDashboard() {
  const supabase = createServerComponentClient();
  
  let jobsCount = 0;
  let claimsCount = 0;
  let ticketsCount = 0;
 
  try {
    const { count: jCount } = await supabase
      .from("installer_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["assigned", "in_progress"]);
    if (jCount !== null) jobsCount = jCount;
 
    const { count: cCount } = await supabase
      .from("expenses")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (cCount !== null) claimsCount = cCount;
 
    const { count: tCount } = await supabase
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");
    if (tCount !== null) ticketsCount = tCount;
  } catch (err) {
    // fallback
  }
 
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <div className="bg-[#FFFDF5] border border-amber-200 rounded-[10px] p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Installer Active Jobs</p>
          <h4 className="text-xl font-extrabold text-slate-800">{jobsCount} Assigned</h4>
        </div>
        <Wrench className="w-8 h-8 text-amber-400 opacity-60" />
      </div>
      <div className="bg-[#FFF5F6] border border-rose-200 rounded-[10px] p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Pending Expenses</p>
          <h4 className="text-xl font-extrabold text-slate-800">{claimsCount} Claims</h4>
        </div>
        <Calendar className="w-8 h-8 text-rose-400 opacity-60" />
      </div>
      <div className="bg-[#F0FAFE] border border-cyan-200 rounded-[10px] p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider">Open Support Tickets</p>
          <h4 className="text-xl font-extrabold text-slate-800">{ticketsCount} Inquiries</h4>
        </div>
        <MessageSquare className="w-8 h-8 text-[#00B4D8] opacity-60" />
      </div>
    </div>
  );
}
 
async function AnnouncementsTicker() {
  const supabase = createServerComponentClient();
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
    <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <Radio className="w-4 h-4 text-[#00B4D8]" />
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Company Broadcast Board
        </h3>
      </div>
      <div className="space-y-4 divide-y divide-slate-100 max-h-[260px] overflow-y-auto pr-1">
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
  );
}
 
export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Home</h1>
        <p className="text-xs text-slate-500">Welcome to your CoreTECH operations control panel.</p>
      </div>
 
      {/* KPI Cards Grid with Loader Suspense */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {Array.from({ length: 4 }).map((_, idx) => (
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
        <DashboardStats />
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
          <ProjectionsChart />
        </div>
 
        {/* Revenue by Pakistan Location */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Pakistan Regional Hubs</h3>
            
            {/* Pakistan Map SVG Placeholder */}
            <div className="w-full h-28 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-[6px] mb-4">
              <svg
                viewBox="0 0 100 120"
                className="w-24 h-24 text-emerald-600/30"
                fill="currentColor"
              >
                {/* Simulated Pakistan Borders */}
                <path d="M10,90 L20,80 L35,70 L50,60 L60,40 L70,25 L80,20 L85,40 L75,70 L65,85 L55,100 L30,110 Z" />
                <circle cx="55" cy="70" r="3" fill="#00B4D8" /> {/* Lahore */}
                <circle cx="25" cy="100" r="3" fill="#00B4D8" /> {/* Karachi */}
                <circle cx="68" cy="35" r="3" fill="#00B4D8" /> {/* Islamabad */}
              </svg>
            </div>
          </div>
 
          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">Lahore Central</span>
              <span className="text-slate-800 font-semibold">42% Hub share</span>
            </div>
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">Karachi South</span>
              <span className="text-slate-800 font-semibold">35% Hub share</span>
            </div>
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">Islamabad Capital</span>
              <span className="text-slate-800 font-semibold">18% Hub share</span>
            </div>
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">Peshawar NW</span>
              <span className="text-slate-800 font-semibold">5% Hub share</span>
            </div>
          </div>
        </div>
      </div>
 
      {/* Row 3 Line & Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Weekly Line Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Weekly Sales Volume</h3>
            <div className="text-xs font-semibold text-slate-400">
              <span className="text-[#00B4D8] font-bold mr-2">Rs. 1,480,000</span> Target met
            </div>
          </div>
          <RevenueChart />
        </div>
 
        {/* Total Sales Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Product Category Distribution</h3>
          <SalesDonutChart />
        </div>
      </div>
 
      {/* Row 4 Announcements & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Broadcast Board */}
        <div className="lg:col-span-1">
          <Suspense fallback={<div className="h-64 bg-slate-100 rounded-[8px] animate-pulse"></div>}>
            <AnnouncementsTicker />
          </Suspense>
        </div>
 
        {/* Top Selling Products */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[8px] overflow-hidden shadow-sm flex flex-col justify-between">
          <div className="p-5 border-b border-slate-100 bg-slate-50/30">
            <h3 className="text-sm font-bold text-slate-800">Top Selling Products</h3>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/10">
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Product Name</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Sale Price</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Qty Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-800">Huawei Smart Inverter 10kW</td>
                  <td className="px-5 py-3.5">Rs. 185,000</td>
                  <td className="px-5 py-3.5 uppercase text-[9px] font-bold text-cyan-600">Inverter</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#00B4D8]">38 Units</td>
                </tr>
                <tr className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-slate-800">LiFePO4 Solar Battery 200Ah</td>
                  <td className="px-5 py-3.5">Rs. 145,000</td>
                  <td className="px-5 py-3.5 uppercase text-[9px] font-bold text-indigo-600">Battery</td>
                  <td className="px-5 py-3.5 text-right font-bold text-[#00B4D8]">24 Units</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
