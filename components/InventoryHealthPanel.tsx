"use client";

import React from "react";
import { CalendarRange } from "lucide-react";

interface InventoryHealthPanelProps {
  agingStock?: { name: string; age: string; qty: number; status: string; location: string }[];
}

export default function InventoryHealthPanel({
  agingStock = []
}: InventoryHealthPanelProps) {

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-5 shadow-sm space-y-5 select-none h-full flex flex-col justify-between">
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
