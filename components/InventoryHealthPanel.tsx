"use client";

import React from "react";
import { AlertCircle, CalendarRange, ChevronRight, PackageCheck, ThermometerSnowflake } from "lucide-react";

export default function InventoryHealthPanel() {
  const lowStockAlerts = [
    { name: "Huawei Smart Inverter 10kW", current: 3, reorder: 10, unit: "units", badge: "Critical" },
    { name: "Growatt Lithium Battery 5kW", current: 2, reorder: 8, unit: "units", badge: "Critical" },
    { name: "Solis 3-Phase Inverter 20kW", current: 6, reorder: 12, unit: "units", badge: "Warning" },
  ];

  const agingStock = [
    { name: "Longi Solar Panels 550W", age: "115 Days", qty: 120, status: "Slow Moving", location: "KHI Hub" },
    { name: "Growatt Off-Grid Inverter 3kW", age: "92 Days", qty: 14, status: "Awaiting Order", location: "LHR Central" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm space-y-5 select-none h-full flex flex-col justify-between">
      {/* Reorder Alerts */}
      <div>
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Reorder Level Alerts
          </h3>
        </div>
        <div className="space-y-3">
          {lowStockAlerts.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-50/50 p-2.5 rounded-[6px] border border-slate-100 text-xs">
              <div>
                <h4 className="font-bold text-slate-850">{item.name}</h4>
                <p className="text-[10px] text-slate-450 mt-0.5">
                  Available: <span className="font-bold text-rose-600">{item.current}</span> / Min Limit: {item.reorder} {item.unit}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase ${
                item.badge === "Critical" 
                  ? "bg-rose-50 text-rose-600 border border-rose-100" 
                  : "bg-amber-50 text-amber-600 border border-amber-100"
              }`}>
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Aging Stock */}
      <div className="pt-2">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
          <CalendarRange className="w-4 h-4 text-indigo-500" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Aging Stock Tracking
          </h3>
        </div>
        <div className="space-y-3">
          {agingStock.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-xs">
              <div>
                <h4 className="font-semibold text-slate-700">{item.name}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Location: {item.location} | Qty: <span className="font-bold text-slate-600">{item.qty}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-[4px]">
                  {item.age}
                </span>
                <p className="text-[8px] text-slate-400 font-medium mt-1">{item.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
