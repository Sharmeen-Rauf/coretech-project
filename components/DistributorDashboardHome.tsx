"use client";

import React from "react";
import StatsCard from "@/components/StatsCard";
import RevenueChart from "@/components/RevenueChart";
import SalesDonutChart from "@/components/SalesDonutChart";

interface DistributorDashboardHomeProps {
  inventoryCount?: number;
  subDealerCount?: number;
  soCount?: number;
  st2Count?: number;
  soTrendData?: { name: string; current: number; previous: number }[];
  inventoryDonutData?: { name: string; value: number }[];
}

export default function DistributorDashboardHome({
  inventoryCount = 0,
  subDealerCount = 0,
  soCount = 0,
  st2Count = 0,
  soTrendData = [
    { name: "Mon", current: 0, previous: 0 },
    { name: "Tue", current: 0, previous: 0 },
    { name: "Wed", current: 0, previous: 0 },
    { name: "Thu", current: 0, previous: 0 },
    { name: "Fri", current: 0, previous: 0 },
    { name: "Sat", current: 0, previous: 0 },
    { name: "Sun", current: 0, previous: 0 },
  ],
  inventoryDonutData = [
    { name: "Inverter", value: 0 },
    { name: "Battery", value: 0 },
    { name: "AIO", value: 0 },
    { name: "Other", value: 0 },
  ],
}: DistributorDashboardHomeProps) {
  return (
    <div className="space-y-6">
      {/* Top Header Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-1">
          <span>Distributor</span>
          <span>/</span>
          <span className="text-[#00B4D8]">Home</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Home</h1>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard title="Total Inventory" value={inventoryCount.toLocaleString()} subtitle="Current Units On Hand" />
        <StatsCard title="Total Sub Dealers" value={subDealerCount.toLocaleString()} subtitle="Your Dealer Network" />
        <StatsCard title="Total SO" value={soCount.toLocaleString()} subtitle="Units Sold Out" />
        <StatsCard title="Total ST-2" value={st2Count.toLocaleString()} subtitle="Secondary Transfers" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Sell Out Trend</h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">This Week vs Last Week</span>
          </div>
          <RevenueChart data={soTrendData} />
        </div>

        <div className="bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Inventory by Category</h3>
          <div className="h-44">
            <SalesDonutChart data={inventoryDonutData} />
          </div>
        </div>
      </div>
    </div>
  );
}
