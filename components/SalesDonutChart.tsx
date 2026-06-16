"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const data = [
  { name: "Inverter", value: 38.5 },
  { name: "Battery", value: 22.4 },
  { name: "AIO", value: 18.1 },
  { name: "Other", value: 21.0 },
];

const COLORS = ["#00B4D8", "#90E0EF", "#0077B6", "#E2E8F0"];

export default function SalesDonutChart() {
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
    <div className="w-full h-64 flex flex-col justify-center">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={75}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${value}%`}
            contentStyle={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4 px-4">
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COLORS[idx] }}
            ></span>
            <span className="font-semibold text-slate-600">{item.name}</span>
            <span className="text-slate-400 font-bold ml-auto">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
