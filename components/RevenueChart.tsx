"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface RevenueChartProps {
  data?: { name: string; current: number; previous: number }[];
}

export default function RevenueChart({ data: propData }: RevenueChartProps) {
  const chartData = propData && propData.length > 0 ? propData : [
    { name: "Mon", current: 0, previous: 0 },
    { name: "Tue", current: 0, previous: 0 },
    { name: "Wed", current: 0, previous: 0 },
    { name: "Thu", current: 0, previous: 0 },
    { name: "Fri", current: 0, previous: 0 },
    { name: "Sat", current: 0, previous: 0 },
    { name: "Sun", current: 0, previous: 0 },
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
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          <Line
            type="monotone"
            dataKey="current"
            stroke="#00B4D8"
            name="Current Week"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="#94A3B8"
            name="Previous Week"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
