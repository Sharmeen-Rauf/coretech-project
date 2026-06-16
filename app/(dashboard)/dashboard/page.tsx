import React, { Suspense } from "react";
import { createServerComponentClient } from "@/lib/supabase";
import StatsCard from "@/components/StatsCard";
import ProjectionsChart from "@/components/ProjectionsChart";
import RevenueChart from "@/components/RevenueChart";
import SalesDonutChart from "@/components/SalesDonutChart";

export const revalidate = 0; // Disable caching for realtime updates

async function DashboardStats() {
  const supabase = createServerComponentClient();

  let customersVal = 3781;
  let ordersVal = 1219;
  let revenueVal = 695;
  let growthVal = "30.1%";

  try {
    // 1. Fetch profiles count (customers)
    const { count: profileCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    if (profileCount !== null) {
      customersVal = profileCount;
    }

    // 2. Fetch orders count
    const { count: ordCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    if (ordCount !== null) {
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
        revenueVal = Math.round(total);
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
        title="Customers"
        value={customersVal.toLocaleString()}
        change="+11.01%"
        isPositive={true}
      />
      <StatsCard
        title="Orders"
        value={ordersVal.toLocaleString()}
        change="-0.03%"
        isPositive={false}
      />
      <StatsCard
        title="Revenue"
        value={`$${revenueVal.toLocaleString()}`}
        change="+15.03%"
        isPositive={true}
      />
      <StatsCard
        title="Growth"
        value={growthVal}
        change="+6.06%"
        isPositive={true}
      />
    </div>
  );
}

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Home</h1>
        <p className="text-xs text-slate-500">Welcome to your CoreTECH overview dashboard.</p>
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

      {/* Charts Section Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projections vs Actuals */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Projections vs Actuals</h3>
          <ProjectionsChart />
        </div>

        {/* Revenue by Location */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Revenue by Location</h3>
            
            {/* World Map SVG Placeholder */}
            <div className="w-full h-28 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-[6px] mb-4">
              <svg
                viewBox="0 0 200 100"
                className="w-40 h-20 text-slate-300"
                fill="currentColor"
              >
                <path d="M15,20 Q30,15 40,25 T60,20 T70,30 T90,25 Z" />
                <path d="M110,40 Q130,35 150,45 T170,40 T180,50 T190,45 Z" />
                <path d="M30,60 Q50,55 70,65 T80,60 T90,70 T100,65 Z" />
              </svg>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">New York</span>
              <span className="text-slate-800 font-semibold">$72K</span>
            </div>
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">San Francisco</span>
              <span className="text-slate-800 font-semibold">$39K</span>
            </div>
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">Sydney</span>
              <span className="text-slate-800 font-semibold">$25K</span>
            </div>
            <div className="py-2 flex justify-between font-medium">
              <span className="text-slate-600">Singapore</span>
              <span className="text-slate-800 font-semibold">$61K</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 Line & Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Weekly Line Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Revenue</h3>
            <div className="text-xs font-semibold text-slate-400">
              <span className="text-[#00B4D8] font-bold mr-2">$58,211</span> vs $68,768
            </div>
          </div>
          <RevenueChart />
        </div>

        {/* Total Sales Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4">Total Sales</h3>
          <SalesDonutChart />
        </div>
      </div>

      {/* Row 4 Top Selling Products */}
      <div className="bg-white border border-slate-200 rounded-[8px] overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-slate-50/30">
          <h3 className="text-sm font-bold text-slate-800">Top Selling Products</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/10">
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider">Quantity</th>
                <th className="px-5 py-3 font-bold text-slate-400 uppercase tracking-wider text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              <tr className="hover:bg-slate-50/30 transition-colors">
                <td className="px-5 py-3.5">ASOS Ridley High Waist</td>
                <td className="px-5 py-3.5">$79.49</td>
                <td className="px-5 py-3.5">82</td>
                <td className="px-5 py-3.5 text-right font-bold text-[#00B4D8]">$6,518</td>
              </tr>
              <tr className="hover:bg-slate-50/30 transition-colors">
                <td className="px-5 py-3.5">Marco Lightweight Shirt</td>
                <td className="px-5 py-3.5">$128.50</td>
                <td className="px-5 py-3.5">37</td>
                <td className="px-5 py-3.5 text-right font-bold text-[#00B4D8]">$4,754</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
