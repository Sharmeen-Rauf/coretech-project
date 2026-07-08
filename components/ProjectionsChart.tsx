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

interface ProjectionsChartProps {
  data?: { name: string; Projections: number; Actuals: number }[];
}

export default function ProjectionsChart({ data: propData }: ProjectionsChartProps) {
  const chartData = propData && propData.length > 0 ? propData : [
    { name: "Jan", Projections: 0, Actuals: 0 },
    { name: "Feb", Projections: 0, Actuals: 0 },
    { name: "Mar", Projections: 0, Actuals: 0 },
    { name: "Apr", Projections: 0, Actuals: 0 },
    { name: "May", Projections: 0, Actuals: 0 },
    { name: "Jun", Projections: 0, Actuals: 0 },
  ];
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
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
            tickFormatter={(v) => String(v)}
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
