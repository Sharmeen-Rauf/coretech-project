"use client";

import React from "react";
import StatsCard from "@/components/StatsCard";
import ProjectionsChart from "@/components/ProjectionsChart";
import RevenueChart from "@/components/RevenueChart";
import SalesDonutChart from "@/components/SalesDonutChart";
import { Globe } from "lucide-react";

interface SubDealerDashboardHomeProps {
  customersCount?: number;
  ordersCount?: number;
  revenueVal?: string;
  transfers?: any[];
  projectionsData?: any[];
  weeklyVolumeData?: any[];
  donutData?: any[];
  locationStats?: { name: string; value: string }[];
}

export default function SubDealerDashboardHome({
  customersCount = 3781,
  ordersCount = 1219,
  revenueVal = "$695",
  transfers = [],
  projectionsData = [
    { name: "Jan", Projections: 22, Actuals: 18 },
    { name: "Feb", Projections: 25, Actuals: 21 },
    { name: "Mar", Projections: 28, Actuals: 24 },
    { name: "Apr", Projections: 30, Actuals: 26 },
    { name: "May", Projections: 24, Actuals: 20 },
    { name: "Jun", Projections: 29, Actuals: 27 },
  ],
  weeklyVolumeData = [
    { name: "Jan", current: 4000, previous: 3200 },
    { name: "Feb", current: 5200, previous: 4100 },
    { name: "Mar", current: 6100, previous: 4900 },
    { name: "Apr", current: 7800, previous: 6200 },
    { name: "May", current: 9200, previous: 7500 },
    { name: "Jun", current: 11000, previous: 8900 },
  ],
  donutData = [
    { name: "Inverters", value: 45, fill: "#00B4D8" },
    { name: "Batteries", value: 30, fill: "#10B981" },
    { name: "AIO Systems", value: 25, fill: "#F59E0B" }
  ],
  locationStats = [
    { name: "Karachi Central Hub", value: "72K Units" },
    { name: "Lahore Region", value: "39K Units" },
    { name: "Islamabad Capital", value: "25K Units" },
    { name: "Peshawar / KPK", value: "61K Units" }
  ]
}: SubDealerDashboardHomeProps) {
  const defaultTransferRequests = [
    { to: "Shoaib", warehouse: "01", product: "Inverter", quantity: 82, status: "Approved" },
    { to: "Hussain", warehouse: "05", product: "Battery", quantity: 37, status: "Approved" },
    { to: "Ali", warehouse: "06", product: "Inverter", quantity: 44, status: "Approved" },
    { to: "Omair", warehouse: "08", product: "Battery", quantity: 184, status: "Approved" },
    { to: "Shoaib", warehouse: "04", product: "AIO", quantity: 54, status: "Declined" },
  ];

  const displayTransfers = transfers && transfers.length > 0
    ? transfers.map((t: any) => ({
        to: t.distributor ? `${t.distributor.first_name} ${t.distributor.last_name || ""}`.trim() : (t.seller || "Distributor"),
        warehouse: t.warehouse || "01",
        product: t.st_id || t.type || "Product Stock",
        quantity: t.total_items || 1,
        status: t.status === "rejected" ? "Declined" : "Approved"
      }))
    : defaultTransferRequests;

  const displayLocations = locationStats && locationStats.length > 0
    ? locationStats
    : [
        { name: "Karachi Central Hub", value: "72K Units" },
        { name: "Lahore Region", value: "39K Units" },
        { name: "Islamabad Capital", value: "25K Units" },
        { name: "Peshawar / KPK", value: "61K Units" }
      ];

  return (
    <div className="space-y-6">
      {/* Top Header Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-1">
          <span>Sub Dealer</span>
          <span>/</span>
          <span className="text-[#00B4D8]">Home</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Home</h1>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Customers"
          value={customersCount.toLocaleString()}
          change="+11.01%"
          isPositive={true}
          subtitle="Sub Dealer Clients"
        />
        <StatsCard
          title="Orders"
          value={ordersCount.toLocaleString()}
          change="-0.03%"
          isPositive={false}
          subtitle="Total Completed Orders"
        />
        <StatsCard
          title="Revenue"
          value={revenueVal}
          change="+15.03%"
          isPositive={true}
          subtitle="Monthly Sales Revenue"
        />
        <StatsCard
          title="Growth"
          value="30.1%"
          change="+6.08%"
          isPositive={true}
          subtitle="YoY Growth Index"
        />
      </div>

      {/* Middle Section: Projections vs Actuals, Line Chart & Revenue by Location */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projections vs Actuals */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Projections vs Actuals</h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">Monthly View</span>
          </div>
          <ProjectionsChart data={projectionsData} />
        </div>

        {/* Revenue by Location */}
        <div className="bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#00B4D8]" />
              Revenue by Location
            </h3>
            
            {/* World Map Graphic */}
            <div className="w-full h-28 flex items-center justify-center bg-slate-50 border border-slate-100 rounded-[8px] mb-4 p-2">
              <svg viewBox="0 0 200 100" className="w-full h-full text-slate-300 fill-current opacity-70">
                <path d="M20,30 Q30,20 50,25 T90,30 T130,25 T170,30 T190,40 Q180,60 160,70 T120,65 T80,75 T40,60 Z" />
                <circle cx="45" cy="35" r="4" fill="#00B4D8" />
                <circle cx="75" cy="45" r="4" fill="#00B4D8" />
                <circle cx="150" cy="55" r="4" fill="#00B4D8" />
                <circle cx="175" cy="40" r="4" fill="#00B4D8" />
              </svg>
            </div>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-100">
            {displayLocations.map((loc, idx) => (
              <div key={idx} className="pt-2 flex justify-between font-medium">
                <span className="text-slate-600 font-bold">{loc.name}</span>
                <span className="text-slate-800 font-extrabold">{loc.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Line Chart & Bottom Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-800">Revenue Volume</h3>
            <div className="flex gap-4 text-xs font-bold">
              <span className="text-slate-700">Current Week: <span className="text-[#00B4D8]">$58,211</span></span>
              <span className="text-slate-400">Previous Week: $68,768</span>
            </div>
          </div>
          <RevenueChart data={weeklyVolumeData} />
        </div>

        {/* Total Sales Donut Chart */}
        <div className="bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Total Sales</h3>
          <div className="h-44">
            <SalesDonutChart data={donutData} />
          </div>
          <div className="text-center pt-2 border-t border-slate-100">
            <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              38.6% Growth Completed
            </span>
          </div>
        </div>
      </div>

      {/* Transfer Requests Table */}
      <div className="bg-white border border-slate-200 rounded-[10px] p-5 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-800">Transfer Requests</h3>
          <span className="text-[11px] font-bold text-[#00B4D8] hover:underline cursor-pointer">View All</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 uppercase tracking-wider text-[9.5px] font-bold">
                <th className="py-2.5 px-4 font-bold">To</th>
                <th className="py-2.5 px-4 font-bold">Warehouse</th>
                <th className="py-2.5 px-4 font-bold">Product</th>
                <th className="py-2.5 px-4 font-bold">Quantity</th>
                <th className="py-2.5 px-4 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {displayTransfers.map((req: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-800">{req.to}</td>
                  <td className="py-3 px-4 text-slate-500 font-semibold">{req.warehouse}</td>
                  <td className="py-3 px-4 font-bold text-slate-700">{req.product}</td>
                  <td className="py-3 px-4 font-extrabold text-slate-900">{req.quantity}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                      req.status === "Approved"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                        : "bg-rose-50 text-rose-600 border border-rose-200"
                    }`}>
                      • {req.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
