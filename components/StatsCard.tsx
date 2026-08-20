"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive: boolean;
  subtitle?: string;
}

export default function StatsCard({ title, value, change, isPositive, subtitle }: StatsCardProps) {
  return (
    <div className="bg-white border border-slate-150 rounded-[12px] p-6 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#00B4D8] transition-all duration-200">
      {/* Title */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#00B4D8] mb-1">
          {title}
        </p>
        <p className="text-3xl font-extrabold text-slate-800 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Change indicator */}
      <div className="mt-4 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isPositive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3 mr-0.5" />
          ) : (
            <ArrowDownRight className="w-3 h-3 mr-0.5" />
          )}
          {change}
        </span>
        <span className="text-[10px] text-slate-400 font-medium">vs last month</span>
      </div>

      {/* Background soft gradient overlay on hover */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#F0FAFE] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"></div>
    </div>
  );
}
