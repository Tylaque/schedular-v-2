"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/ThemeProvider";
import type { BookingVolumePoint } from "@/lib/data/analytics";

export function BookingVolumeChart({ data }: { data: BookingVolumePoint[] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const grid = dark ? "#374151" : "#e5e7eb";
  const axis = dark ? "#9ca3af" : "#6b7280";
  const tooltipBg = dark ? "#1f2937" : "#ffffff";
  const tooltipBorder = dark ? "#374151" : "#e5e7eb";
  const tooltipText = dark ? "#f9fafb" : "#111827";

  const hasData = data.some((b) => b.total > 0);
  if (!hasData) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No bookings in the selected range.
      </div>
    );
  }

  return (
    <div data-testid="booking-volume-chart">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: axis, fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: grid }}
        />
        <YAxis
          tick={{ fill: axis, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: 8,
            color: tooltipText,
            fontSize: 12,
          }}
          labelStyle={{ color: tooltipText, fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="confirmed" name="Confirmed" fill="#4338CA" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#F43F5E" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="rescheduled" name="Rescheduled" stroke="#F59E0B" strokeWidth={2} dot={false} />
      </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
