"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { name: "Jan", Projections: 18, Actuals: 12 },
  { name: "Feb", Projections: 24, Actuals: 20 },
  { name: "Mar", Projections: 32, Actuals: 26 },
  { name: "Apr", Projections: 28, Actuals: 22 },
  { name: "May", Projections: 35, Actuals: 30 },
  { name: "Jun", Projections: 40, Actuals: 34 },
];

export default function ProjectionsChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-64 bg-slate-50 flex items-center justify-center rounded-[8px] animate-pulse">
        <span className="text-xs text-slate-400 font-medium">Loading Chart...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis
            dataKey="name"
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94A3B8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}M`}
          />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", paddingBottom: "15px" }}
          />
          <Bar dataKey="Projections" fill="#90E0EF" name="Projections" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Actuals" fill="#00B4D8" name="Actuals" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
