"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import type { AdminUtilizationPoint } from "@/lib/data/analytics";

const BAR_COLORS = [
  "#4338CA",
  "#10B981",
  "#F59E0B",
  "#F43F5E",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#84CC16",
];

export function AdminUtilizationChart({ data }: { data: AdminUtilizationPoint[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const grid = dark ? "#374151" : "#e5e7eb";
  const axis = dark ? "#9ca3af" : "#6b7280";
  const tooltipBg = dark ? "#1f2937" : "#ffffff";
  const tooltipBorder = dark ? "#374151" : "#e5e7eb";
  const tooltipText = dark ? "#f9fafb" : "#111827";

  if (data.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No utilization data yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, rate: Math.round(d.utilizationRate * 100) }));

  return (
    <div data-testid="admin-utilization-chart">
      <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
        />
        <YAxis
          type="category"
          dataKey="adminName"
          width={130}
          tick={{ fill: axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: dark ? "#1f2937" : "#f3f4f6" }}
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 8,
            color: tooltipText,
            fontSize: 12,
          }}
          labelStyle={{ color: tooltipText, fontWeight: 600 }}
          formatter={(value) => [`${value}%`, "Utilization"]}
        />
        <Bar dataKey="rate" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry, i) => (
            <Cell key={entry.adminId} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
